/**
 * assertNoConflictingMethodCalled
 * 
 * 複数の層が同じメソッドを同時に活性化してコンフリクトを起こしていないかを検証する。
 * 
 * @example
 * assertNoConflictingMethodCalled(() => {
 *     player.takeDamage(10);  // 複数の層が同時に活性化していたらエラー
 * });
 */

import EMA from '../ema/EMA.js';
import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import { CopHooks } from '../core/CopHooks';

// getCurrentConfig は describeCop から import する必要があるが、循環参照を避けるため引数で渡す
export function createAssertNoConflictingMethodCalled(getCurrentConfig: () => { layers: any[] } | undefined) {
    return function assertNoConflictingMethodCalled(fn: () => void): void {
        const config = getCurrentConfig();
        const declaredLayers = config?.layers || [];
        const deployedLayers = (EMA as any)._deployedLayers || [];
        const pool = (PartialMethodsPool as any)._partialMethods || [];
        
        // Layer 名を取得するヘルパー
        const getLayerName = (layer: any): string => layer?.name || 'unknown';
        
        // 1. 宣言された層の中から、同じ (obj, methodName) を refine している層のグループを探す
        const methodToLayers = new Map<string, { obj: any; methodName: string; layers: any[] }>();
        
        for (const pm of pool) {
            const [obj, methodName, , originalLayer] = pm;
            
            // 宣言された層のみ対象
            if (!declaredLayers.includes(originalLayer)) {
                continue;
            }
            
            const key = `${obj.constructor?.name || 'Object'}#${methodName}`;
            
            if (!methodToLayers.has(key)) {
                methodToLayers.set(key, { obj, methodName, layers: [] });
            }
            
            const entry = methodToLayers.get(key)!;
            if (!entry.layers.includes(originalLayer)) {
                entry.layers.push(originalLayer);
            }
        }
        
        // 2. 複数の層が同じメソッドを refine しているケースのみ抽出
        const conflictingMethods: Array<{ obj: any; methodName: string; layers: any[] }> = [];
        for (const entry of methodToLayers.values()) {
            if (entry.layers.length > 1) {
                conflictingMethods.push(entry);
            }
        }
        
        // 競合するメソッドがなければ何もしない
        if (conflictingMethods.length === 0) {
            fn();
            return;
        }
        
        // フック解除関数を収集
        const unregisterFns: Array<() => void> = [];
        
        // 3. 競合するメソッドに CopHooks で before フックを設定
        for (const { obj, methodName, layers } of conflictingMethods) {
            CopHooks.install(obj, methodName);
            
            const unregister = CopHooks.register(obj, methodName, 'before', () => {
                // 呼び出し時点で、このメソッドを refine している層の中で活性化しているものを探す
                const activeLayers: any[] = [];
                
                for (const layer of layers) {
                    const deployed = deployedLayers.find((l: any) => l.__original__ === layer);
                    if (deployed && deployed._active) {
                        activeLayers.push(layer);
                    }
                }
                
                // 複数の層が活性化していたらエラー
                if (activeLayers.length > 1) {
                    const layerNames = activeLayers.map(getLayerName).join(', ');
                    throw new Error(
                        `Conflicting method call detected:\n` +
                        `  Method: ${obj.constructor?.name || 'Object'}.${methodName}\n` +
                        `  Active layers with this method: [${layerNames}]\n` +
                        `  Multiple layers are refining the same method and are all active.`
                    );
                }
            });
            
            unregisterFns.push(unregister);
        }
        
        // 4. _installPartialMethod に CopHooks で after フックを設定
        for (const deployedLayer of deployedLayers) {
            const originalLayer = deployedLayer.__original__;
            
            // 宣言された層のみ対象
            if (!declaredLayers.includes(originalLayer)) {
                continue;
            }
            
            CopHooks.install(deployedLayer, '_installPartialMethod');
            
            const unregister = CopHooks.register(deployedLayer, '_installPartialMethod', 'after', () => {
                // インストール後、競合メソッドを再インストール
                for (const { obj, methodName } of conflictingMethods) {
                    CopHooks.reinstall(obj, methodName);
                }
            });
            
            unregisterFns.push(unregister);
        }
        
        // 5. fn() 実行
        try {
            fn();
        } finally {
            // 6. フックを解除
            for (const unregister of unregisterFns) {
                unregister();
            }
            
            // 7. CopHooks をアンインストール
            for (const { obj, methodName } of conflictingMethods) {
                CopHooks.uninstall(obj, methodName);
            }
            
            for (const deployedLayer of deployedLayers) {
                if (!declaredLayers.includes(deployedLayer.__original__)) continue;
                CopHooks.uninstall(deployedLayer, '_installPartialMethod');
            }
        }
    };
}

export default createAssertNoConflictingMethodCalled;
