/**
 * toCallConflictingMethod マッチャー
 * 
 * 複数の層が同じメソッドを同時に活性化してコンフリクトを起こしていないかを検証する。
 * 通常は .not と一緒に使う。
 * 
 * @example
 * expect(() => {
 *     player.takeDamage(10);  // 複数の層が同時に活性化していたらエラー
 * }).not.toCallConflictingMethod();
 */

import EMA from '../ema/EMA.js';
import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import { CopHooks } from '../core/CopHooks.js';
import { MatcherResult } from '../core/types.js';

/**
 * getCurrentConfig を取得するための型
 */
type GetCurrentConfigFn = () => { layers: any[] } | undefined;

/**
 * toCallConflictingMethod のファクトリ関数
 */
export function createToCallConflictingMethod(getCurrentConfig: GetCurrentConfigFn) {
    return function toCallConflictingMethod(received: () => void): MatcherResult {
        if (typeof received !== 'function') {
            return {
                pass: false,
                message: () =>
                    `expect(received).not.toCallConflictingMethod()\n\n` +
                    `Error: received must be a function.`
            };
        }
        
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
        
        // 競合するメソッドがなければ、コンフリクトは起きない
        if (conflictingMethods.length === 0) {
            received();
            return {
                pass: false,
                message: () =>
                    `expect(fn).toCallConflictingMethod()\n\n` +
                    `Expected: conflicting method to be called\n` +
                    `Received: no conflicting methods exist`
            };
        }
        
        // フック解除関数を収集
        const unregisterFns: Array<() => void> = [];
        let conflictError: Error | null = null;
        
        // 3. 競合するメソッドに CopHooks で before フックを設定
        for (const { obj, methodName, layers } of conflictingMethods) {
            CopHooks.install(obj, methodName);
            
            const unregister = CopHooks.register(obj, methodName, 'before', () => {
                const activeLayers: any[] = [];
                
                for (const layer of layers) {
                    const deployed = deployedLayers.find((l: any) => l.__original__ === layer);
                    if (deployed && deployed._active) {
                        activeLayers.push(layer);
                    }
                }
                
                if (activeLayers.length > 1) {
                    const layerNames = activeLayers.map(getLayerName).join(', ');
                    conflictError = new Error(
                        `Conflicting method call detected:\n` +
                        `  Method: ${obj.constructor?.name || 'Object'}.${methodName}\n` +
                        `  Active layers with this method: [${layerNames}]\n` +
                        `  Multiple layers are refining the same method and are all active.`
                    );
                    throw conflictError;
                }
            });
            
            unregisterFns.push(unregister);
        }
        
        // 4. _installPartialMethod に CopHooks で after フックを設定
        for (const deployedLayer of deployedLayers) {
            const originalLayer = deployedLayer.__original__;
            
            if (!declaredLayers.includes(originalLayer)) {
                continue;
            }
            
            CopHooks.install(deployedLayer, '_installPartialMethod');
            
            const unregister = CopHooks.register(deployedLayer, '_installPartialMethod', 'after', () => {
                for (const { obj, methodName } of conflictingMethods) {
                    CopHooks.reinstall(obj, methodName);
                }
            });
            
            unregisterFns.push(unregister);
        }
        
        // 5. fn() 実行
        let executionError: Error | null = null;
        try {
            received();
        } catch (e) {
            if (e === conflictError) {
                // コンフリクトエラーは想定内
            } else {
                executionError = e as Error;
            }
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
        
        // コンフリクト以外のエラーは再スロー
        if (executionError) {
            throw executionError;
        }
        
        const pass = conflictError !== null;
        
        return {
            pass,
            message: () => {
                if (pass) {
                    // .not で失敗した場合（コンフリクトが発生した）
                    return `expect(fn).not.toCallConflictingMethod()\n\n` +
                           `Expected: no conflicting method calls\n` +
                           `Received: ${conflictError!.message}`;
                } else {
                    // 通常の失敗（コンフリクトが発生しなかった）
                    return `expect(fn).toCallConflictingMethod()\n\n` +
                           `Expected: conflicting method to be called\n` +
                           `Received: no conflict occurred`;
                }
            }
        };
    };
}

export default createToCallConflictingMethod;
