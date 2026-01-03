/**
 * assertLayerStateUnchanged
 * 
 * 関数実行中に Layer の活性化状態が変化しないことをアサート
 */

import EMA from '../ema/EMA.js';

/**
 * getCurrentConfig を取得するための型
 */
type GetCurrentConfigFn = () => { layers: any[] } | null;

/**
 * assertLayerStateUnchanged のファクトリ関数
 */
export function createAssertLayerStateUnchanged(getCurrentConfig: GetCurrentConfigFn) {
    return function assertLayerStateUnchanged(fn: () => void): void {
        const deployedLayers = (EMA as any)._deployedLayers || [];
        
        // use.layer() で宣言された層のみ対象
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
        fn();
        
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
        
        if (changes.length > 0) {
            throw new Error(
                `Layer state changed during execution:\n` +
                changes.map(c => `  - ${c}`).join('\n')
            );
        }
    };
}
