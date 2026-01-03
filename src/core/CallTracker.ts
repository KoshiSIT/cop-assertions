/**
 * CallTracker: メソッド呼び出し履歴の追跡
 * 
 * COP のテストで、どの層のメソッドがいつ呼ばれたかを記録・検証する。
 */

import { CallRecord, MethodInfo } from './types.js';

// CallTracker シングルトン
export const CallTracker = {
    records: [] as CallRecord[],
    methodRegistry: new WeakMap<Function, MethodInfo>(),
    
    // チェーン追跡用
    currentChain: [] as any[],
    currentChainTarget: null as { obj: any; methodName: string } | null,
    
    reset() {
        this.records = [];
        // methodRegistry はクリアしない（セットアップ時に登録されたメソッド情報を保持）
        this.currentChain = [];
        this.currentChainTarget = null;
        this.chainDepth = 0;
        this.pendingConflictResolution = null;
    },
    
    /**
     * 完全にリセット（methodRegistry も含む）
     */
    fullReset() {
        this.records = [];
        this.methodRegistry = new WeakMap();
        this.currentChain = [];
        this.currentChainTarget = null;
        this.chainDepth = 0;
        this.pendingConflictResolution = null;
    },
    
    record(entry: CallRecord) {
        // チェーンがあれば追加
        if (this.currentChain.length > 0) {
            entry.chain = [...this.currentChain];
        }
        
        // コンフリクト解決情報があれば追加
        if (this.pendingConflictResolution && 
            this.pendingConflictResolution.obj === entry.obj &&
            this.pendingConflictResolution.methodName === entry.methodName) {
            entry.conflictResolution = true;
            entry.conflictLayers = [...this.pendingConflictResolution.layers];
            this.pendingConflictResolution = null;
        }
        
        this.records.push(entry);
    },
    
    registerMethod(fn: Function, obj: any, methodName: string) {
        this.methodRegistry.set(fn, { obj, methodName });
    },
    
    getMethodInfo(fn: Function): MethodInfo | undefined {
        // まず registry から検索
        const info = this.methodRegistry.get(fn);
        if (info) return info;
        
        // フォールバック: records から (obj, methodName) を探して、
        // 現在の obj[methodName] === fn かチェック
        const checkedKeys = new Set<string>();
        for (const record of this.records) {
            const key = `${record.obj?.constructor?.name || 'Object'}.${record.methodName}`;
            if (checkedKeys.has(key)) continue;
            checkedKeys.add(key);
            
            if (record.obj[record.methodName] === fn) {
                // 見つかったら登録して返す
                this.methodRegistry.set(fn, { obj: record.obj, methodName: record.methodName });
                return { obj: record.obj, methodName: record.methodName };
            }
        }
        
        return undefined;
    },
    
    // チェーン追跡のネスト深度
    chainDepth: 0,
    
    // チェーン追跡: 開始（ネスト対応）
    startChain(obj: any, methodName: string) {
        if (this.chainDepth === 0) {
            // 最初の呼び出し時のみリセット
            this.currentChain = [];
            this.currentChainTarget = { obj, methodName };
        }
        this.chainDepth++;
    },
    
    // チェーン追跡: 層を追加
    addToChain(layer: any) {
        if (this.currentChainTarget) {
            this.currentChain.push(layer);
        }
    },
    
    // チェーン追跡: 終了（ネスト対応）
    endChain() {
        this.chainDepth--;
        if (this.chainDepth === 0) {
            // 最後の呼び出し時のみリセット
            this.currentChain = [];
            this.currentChainTarget = null;
        }
    },
    
    // コンフリクト解決の追跡用
    pendingConflictResolution: null as { obj: any; methodName: string; layers: any[] } | null,
    
    // コンフリクト解決が使われたことをマーク（次の record で使用）
    markConflictResolution(obj: any, methodName: string, layers: any[]) {
        this.pendingConflictResolution = { obj, methodName, layers };
    },
    
    // 特定の (obj, methodName) の呼び出し履歴を取得
    getCallsFor(obj: any, methodName: string): CallRecord[] {
        return this.records.filter(r => r.obj === obj && r.methodName === methodName);
    },
    
    // 最後の呼び出しを取得
    getLastCallFor(obj: any, methodName: string): CallRecord | null {
        const calls = this.getCallsFor(obj, methodName);
        return calls.length > 0 ? calls[calls.length - 1] : null;
    },
    
    // n番目の呼び出しを取得 (1-indexed)
    getNthCallFor(obj: any, methodName: string, n: number): CallRecord | null {
        const calls = this.getCallsFor(obj, methodName);
        return (n > 0 && n <= calls.length) ? calls[n - 1] : null;
    },
    
    // 呼び出し回数を取得
    getCallCountFor(obj: any, methodName: string): number {
        return this.getCallsFor(obj, methodName).length;
    }
};

/**
 * メソッド追跡用のラップ関数を作成するヘルパー
 */
export function createMethodWrapper(obj: any, methodName: string): (method: Function) => Function {
    return (method: Function): Function => {
        // 既にラップ済みならそのまま返す
        if ((method as any).__callTracked__) {
            return method;
        }
        
        const wrapped = function(this: any, ...args: any[]) {
            // チェーン追跡開始
            CallTracker.startChain(obj, methodName);
            
            // wrapped 自身の __layer__ を参照（attachLayerMetadata が設定する）
            const layer = (wrapped as any).__layer__ || null;
            
            let result;
            let error: any = null;
            
            try {
                result = method.apply(this, args);
            } catch (e) {
                error = e;
            }
            
            // record は endChain の前に呼ぶ（chain がクリアされる前）
            CallTracker.record({
                obj,
                methodName,
                layer,
                thisArg: this,
                args,
                result
            });
            
            // チェーン追跡終了
            CallTracker.endChain();
            
            // 例外があれば再スロー
            if (error) {
                throw error;
            }
            
            return result;
        };
        
        // メタ情報を引き継ぐ
        (wrapped as any).__layer__ = (method as any).__layer__;
        (wrapped as any).__callTracked__ = true;
        // 元のメソッドへの参照を保持（toBeOriginalMethod 用）
        (wrapped as any).__wrappedMethod__ = method;
        
        // 逆引き用に登録
        CallTracker.registerMethod(wrapped, obj, methodName);
        
        return wrapped;
    };
}

export default CallTracker;
