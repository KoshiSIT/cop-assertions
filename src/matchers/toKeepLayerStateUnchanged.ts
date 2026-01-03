/**
 * toKeepLayerStateUnchanged マッチャー
 * 
 * 関数実行中に Layer の活性化状態が変化しないことを検証
 * 
 * @example
 * expect(() => {
 *     enemy.move();
 * }).toKeepLayerStateUnchanged();
 */

import EMA from '../ema/EMA.js';
import { MatcherResult } from '../core/types.js';

/**
 * getCurrentConfig を取得するための型
 */
type GetCurrentConfigFn = () => { layers: any[] } | null;

/**
 * toKeepLayerStateUnchanged のファクトリ関数
 */
export function createToKeepLayerStateUnchanged(getCurrentConfig: GetCurrentConfigFn) {
    return function toKeepLayerStateUnchanged(received: () => void): MatcherResult {
        if (typeof received !== 'function') {
            return {
                pass: false,
                message: () => 
                    `expect(received).toKeepLayerStateUnchanged()\n\n` +
                    `Error: received must be a function.`
            };
        }
        
        const deployedLayers = (EMA as any)._deployedLayers || [];
        const config = getCurrentConfig();
        const declaredLayers = config?.layers || [];
        
        // 宣言された層の現在の状態を保存
        const beforeState = new Map<any, boolean>();
        for (const deployedLayer of deployedLayers) {
            const originalLayer = deployedLayer.__original__;
            if (declaredLayers.includes(originalLayer)) {
                beforeState.set(originalLayer, deployedLayer._active);
            }
        }
        
        // 関数を実行
        received();
        
        // 実行後の状態をチェック
        const changes: string[] = [];
        for (const deployedLayer of deployedLayers) {
            const originalLayer = deployedLayer.__original__;
            if (!beforeState.has(originalLayer)) continue;
            
            const wasBefore = beforeState.get(originalLayer);
            const isNow = deployedLayer._active;
            
            if (wasBefore !== isNow) {
                const layerName = originalLayer?.name || 'unknown';
                if (isNow) {
                    changes.push(`Layer '${layerName}' was activated`);
                } else {
                    changes.push(`Layer '${layerName}' was deactivated`);
                }
            }
        }
        
        const pass = changes.length === 0;
        
        return {
            pass,
            message: () => {
                if (pass) {
                    // .not で失敗した場合
                    return `expect(fn).not.toKeepLayerStateUnchanged()\n\n` +
                           `Expected: layer state to change during execution\n` +
                           `Received: layer state remained unchanged`;
                } else {
                    return `expect(fn).toKeepLayerStateUnchanged()\n\n` +
                           `Expected: layer state to remain unchanged during execution\n` +
                           `Received: layer state changed\n\n` +
                           `Changes:\n${changes.map(c => `  - ${c}`).join('\n')}`;
                }
            }
        };
    };
}
