/**
 * CopHooks: COP のフック一元管理
 * 
 * EMA や Layer のメソッドにフックを追加して、
 * 活性化・非活性化などのイベントを監視できるようにする。
 */

import { HookTiming, HookContext, HookCallback, RegisteredHook } from './types.js';

// ターゲットとメソッドのキーを生成（WeakMap で ID を管理）
const targetIdMap = new WeakMap<object, string>();
let nextTargetId = 1;

function getHookKey(target: any, methodName: string): string {
    if (!targetIdMap.has(target)) {
        targetIdMap.set(target, `target_${nextTargetId++}`);
    }
    return `${targetIdMap.get(target)}#${methodName}`;
}

// CopHooks シングルトン
export const CopHooks = {
    // キー: "target#methodName" → フックの配列
    hooks: new Map<string, RegisteredHook[]>(),
    // 元のメソッドを保存
    originalMethods: new Map<string, Function>(),
    // インストール済みの情報（キー → { target, methodName }）
    installed: new Map<string, { target: any; methodName: string }>(),
    // ID管理
    nextHookId: 1,
    
    /**
     * フックを登録
     * @param target 対象オブジェクト
     * @param methodName メソッド名
     * @param timing 'before' | 'after'
     * @param callback コールバック
     * @param filter 実行条件（省略時は常に実行）
     * @returns 解除用の関数
     */
    register(
        target: any, 
        methodName: string, 
        timing: HookTiming, 
        callback: HookCallback,
        filter?: (context: HookContext) => boolean
    ): () => void {
        const key = getHookKey(target, methodName);
        const id = this.nextHookId++;
        
        if (!this.hooks.has(key)) {
            this.hooks.set(key, []);
        }
        
        this.hooks.get(key)!.push({ id, timing, callback, filter });
        
        // 解除関数を返す
        return () => this.unregister(target, methodName, id);
    },
    
    /**
     * フックを解除
     */
    unregister(target: any, methodName: string, id: number): void {
        const key = getHookKey(target, methodName);
        const hooks = this.hooks.get(key);
        if (hooks) {
            const index = hooks.findIndex(h => h.id === id);
            if (index >= 0) {
                hooks.splice(index, 1);
            }
        }
    },
    
    /**
     * 特定のターゲット・メソッドの全フックを解除
     */
    clearFor(target: any, methodName: string): void {
        const key = getHookKey(target, methodName);
        this.hooks.delete(key);
    },
    
    /**
     * 全フックを解除
     */
    clear(): void {
        this.hooks.clear();
    },
    
    /**
     * 指定タイミングのフックを取得
     */
    getHooks(target: any, methodName: string, timing: HookTiming): RegisteredHook[] {
        const key = getHookKey(target, methodName);
        const hooks = this.hooks.get(key) || [];
        return hooks.filter(h => h.timing === timing);
    },
    
    /**
     * フックを実行
     */
    executeHooks(target: any, methodName: string, timing: HookTiming, context: HookContext): void {
        const hooks = this.getHooks(target, methodName, timing);
        for (const hook of hooks) {
            // フィルターがあれば条件チェック
            if (hook.filter && !hook.filter(context)) {
                continue;
            }
            hook.callback(context);
        }
    },
    
    /**
     * メソッドにフックをインストール
     */
    install(target: any, methodName: string, contextBuilder?: (args: any[]) => Record<string, any>): void {
        const key = getHookKey(target, methodName);
        
        if (this.installed.has(key)) return;
        
        const self = this;
        const originalMethod = target[methodName];
        
        if (typeof originalMethod !== 'function') {
            throw new Error(`${methodName} is not a function`);
        }
        
        this.originalMethods.set(key, originalMethod);
        
        target[methodName] = function(this: any, ...args: any[]) {
            // コンテキストを構築
            const context: HookContext = {
                target,
                methodName,
                args,
                extra: contextBuilder ? contextBuilder(args) : {},
            };
            
            // before フック実行
            self.executeHooks(target, methodName, 'before', context);
            
            // 元のメソッドを実行
            const result = originalMethod.apply(this, args);
            context.result = result;
            
            // contextBuilder があれば after 用に再構築（状態が変わっている可能性）
            if (contextBuilder) {
                const afterExtra = contextBuilder(args);
                // before の extra を保持しつつ after を追加
                context.extra = {
                    ...context.extra,
                    after: afterExtra,
                };
            }
            
            // after フック実行
            self.executeHooks(target, methodName, 'after', context);
            
            return result;
        };
        
        this.installed.set(key, { target, methodName });
    },
    
    /**
     * メソッドを再インストール（外部でメソッドが置き換えられた後に呼ぶ）
     * フックは保持したまま、新しいメソッドをラップ
     */
    reinstall(target: any, methodName: string, contextBuilder?: (args: any[]) => Record<string, any>): void {
        const key = getHookKey(target, methodName);
        
        if (!this.installed.has(key)) {
            // 未インストールなら通常の install
            this.install(target, methodName, contextBuilder);
            return;
        }
        
        // フックは保持したまま、新しいメソッドをラップ
        const self = this;
        const newOriginalMethod = target[methodName];
        
        if (typeof newOriginalMethod !== 'function') {
            return;
        }
        
        // 新しいメソッドを保存
        this.originalMethods.set(key, newOriginalMethod);
        
        // 再ラップ
        target[methodName] = function(this: any, ...args: any[]) {
            const context: HookContext = {
                target,
                methodName,
                args,
                extra: contextBuilder ? contextBuilder(args) : {},
            };
            
            self.executeHooks(target, methodName, 'before', context);
            
            const result = newOriginalMethod.apply(this, args);
            context.result = result;
            
            if (contextBuilder) {
                const afterExtra = contextBuilder(args);
                context.extra = {
                    ...context.extra,
                    after: afterExtra,
                };
            }
            
            self.executeHooks(target, methodName, 'after', context);
            
            return result;
        };
    },
    
    /**
     * メソッドのフックをアンインストール
     */
    uninstall(target: any, methodName: string): void {
        const key = getHookKey(target, methodName);
        
        if (!this.installed.has(key)) return;
        
        const originalMethod = this.originalMethods.get(key);
        
        if (originalMethod) {
            // インスタンスプロパティを削除してプロトタイプのメソッドを使う
            // または元のメソッドを復元
            delete target[methodName];
            
            // プロトタイプにメソッドがない場合は復元
            if (typeof target[methodName] !== 'function') {
                target[methodName] = originalMethod;
            }
        }
        
        this.originalMethods.delete(key);
        this.installed.delete(key);
        this.clearFor(target, methodName);
    },
    
    /**
     * 全てをアンインストール
     */
    uninstallAll(): void {
        // インストール済みの全メソッドを復元
        for (const [key, { target, methodName }] of this.installed) {
            const originalMethod = this.originalMethods.get(key);
            if (originalMethod) {
                delete target[methodName];
                if (typeof target[methodName] !== 'function') {
                    target[methodName] = originalMethod;
                }
            }
            this.clearFor(target, methodName);
        }
        this.hooks.clear();
        this.originalMethods.clear();
        this.installed.clear();
    },
    
    /**
     * リセット（テスト間で状態をクリア）
     */
    reset(): void {
        // 全てアンインストールしてからクリア
        this.uninstallAll();
        this.nextHookId = 1;
    }
};

export default CopHooks;
