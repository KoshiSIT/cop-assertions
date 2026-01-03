/**
 * COP テスト用のユーティリティ関数
 */

import { LayerState } from './types.js';

/**
 * 層の状態が変化したかを判定
 */
export function hasLayerStateChanged(before: LayerState[], after: LayerState[]): boolean {
    if (before.length !== after.length) return true;
    
    for (let i = 0; i < before.length; i++) {
        if (before[i].name !== after[i].name || before[i].active !== after[i].active) {
            return true;
        }
    }
    return false;
}

/**
 * 変化した層を取得
 */
export function getChangedLayers(before: LayerState[], after: LayerState[]): string[] {
    const changed: string[] = [];
    
    for (let i = 0; i < before.length; i++) {
        const b = before[i];
        const a = after.find(x => x.name === b.name);
        
        if (a && b.active !== a.active) {
            changed.push(`${b.name}: ${b.active} → ${a.active}`);
        }
    }
    
    return changed;
}

/**
 * ディープスナップショットを取得（オブジェクトの全プロパティを再帰的に取得）
 */
export function deepSnapshot(
    obj: any, 
    excludeKeys: string[] = [], 
    seen: WeakSet<object> = new WeakSet(), 
    path: string = 'root', 
    depth: number = 0
): any {
    // 深さ制限（無限ループ防止）
    if (depth > 10) {
        return '[MAX_DEPTH]';
    }
    
    // プリミティブ値
    if (obj === null) return null;
    if (obj === undefined) return undefined;
    if (typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean') {
        return obj;
    }
    
    // 関数は toString() で中身も比較
    if (typeof obj === 'function') {
        return `[Function: ${obj.toString()}]`;
    }
    
    // 循環参照チェック
    if (typeof obj === 'object') {
        if (seen.has(obj)) {
            return '[Circular]';
        }
        seen.add(obj);
    }
    
    // Node.js 内部オブジェクトや DOM オブジェクトはスキップ
    const skipTypes = [
        'Console', 'WritableStream', 'ReadableStream', 'Socket', 
        'Process', 'Window', 'Document', 'HTMLElement'
    ];
    const constructorName = obj.constructor?.name;
    if (constructorName && skipTypes.some(t => constructorName.includes(t))) {
        return `[${constructorName}]`;
    }
    
    // 配列
    if (Array.isArray(obj)) {
        return obj.map((item, index) => 
            deepSnapshot(item, excludeKeys, seen, `${path}[${index}]`, depth + 1)
        );
    }
    
    // オブジェクト
    const result: Record<string, any> = {};
    
    // 除外パターン（内部プロパティやフック関連）
    const excludePatterns = [
        '__copHookId',
        '__callTracked__',
        '__wrappedMethod__',
        '__layer__',
        '_sessionHistory',  // EMA内部のセッション履歴
        '_window',          // Node.js グローバル参照
        ...excludeKeys
    ];
    
    for (const key of Object.keys(obj)) {
        if (excludePatterns.some(pattern => key.includes(pattern))) {
            continue;
        }
        
        try {
            result[key] = deepSnapshot(obj[key], excludeKeys, seen, `${path}.${key}`, depth + 1);
        } catch (e) {
            result[key] = '[Error accessing property]';
        }
    }
    
    return result;
}

/**
 * ディープスナップショットを比較
 */
export function compareDeepSnapshots(before: any, after: any): { 
    changed: boolean; 
    differences: string[] 
} {
    const differences: string[] = [];
    
    function compare(a: any, b: any, path: string = 'root') {
        // 型が異なる
        if (typeof a !== typeof b) {
            differences.push(`${path}: type changed from ${typeof a} to ${typeof b}`);
            return;
        }
        
        // プリミティブ
        if (typeof a !== 'object' || a === null) {
            if (a !== b) {
                differences.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
            }
            return;
        }
        
        // 配列
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) {
                differences.push(`${path}: array length ${a.length} → ${b.length}`);
            }
            const maxLen = Math.max(a.length, b.length);
            for (let i = 0; i < maxLen; i++) {
                compare(a[i], b[i], `${path}[${i}]`);
            }
            return;
        }
        
        // オブジェクト
        const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of allKeys) {
            if (!(key in a)) {
                differences.push(`${path}.${key}: added`);
            } else if (!(key in b)) {
                differences.push(`${path}.${key}: removed`);
            } else {
                compare(a[key], b[key], `${path}.${key}`);
            }
        }
    }
    
    compare(before, after);
    
    return {
        changed: differences.length > 0,
        differences
    };
}

/**
 * 他の層の状態をキャプチャ
 * @param deployedLayers デプロイされた層の配列
 * @param excludeLayer 除外する層
 */
export function captureOtherLayerStates(deployedLayers: any[], excludeLayer: any): LayerState[] {
    return deployedLayers
        .filter((l: any) => l.__original__ !== excludeLayer && l._name !== excludeLayer?.name)
        .map((l: any) => ({ name: l._name, active: l._active }));
}

/**
 * 層のアクティベーション状態を取得（EMA インスタンスを受け取る）
 */
export function getLayerActivationState(EMA: any, layer: any): boolean {
    let isActive = false;
    EMA.getLayers(function(deployedLayer: any) {
        if (deployedLayer._name === layer.name || deployedLayer.__original__ === layer) {
            isActive = deployedLayer._active;
        }
    });
    return isActive;
}
