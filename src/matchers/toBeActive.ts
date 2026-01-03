/**
 * toBeActive マッチャー
 * 
 * 層がアクティブ（活性化）されているかを検証する。
 */

import EMA from '../ema/EMA.js';
import { MatcherResult } from '../core/types.js';

/**
 * 層がアクティブであるかを検証
 * 
 * @example
 * EMA.activate(NightLayer);
 * expect(NightLayer).toBeActive();
 * expect(DayLayer).not.toBeActive();
 */
export function toBeActive(received: any): MatcherResult {
    // received = Layer オブジェクト（originalLayer）
    const deployedLayers = (EMA as any).getLayers((l: any) => 
        l.__original__ === received
    );
    
    if (deployedLayers.length === 0) {
        // 全ての活性化している Layer を取得
        const allActiveLayers = (EMA as any).getLayers((l: any) => l._active);
        const activeLayerNames = allActiveLayers
            .map((l: any) => l.__original__?.name || l.name || 'unknown')
            .filter((name: string) => name !== 'unknown');
        
        return {
            pass: false,
            message: () => {
                let msg = `expect(received).toBeActive()\n\n` +
                          `Expected: ${received.name || 'Layer'} to be active\n` +
                          `Received: ${received.name || 'Layer'} is not deployed`;
                
                if (activeLayerNames.length > 0) {
                    msg += `\nActive Layers: [${activeLayerNames.join(', ')}]`;
                }
                
                return msg;
            },
        };
    }
    
    const deployedLayer = deployedLayers[0];
    const isActive = deployedLayer._active;
    const condition = deployedLayer._cond?.expression || 'unknown';
    const layerName = received.name || 'Layer';
    
    // 全ての活性化している Layer を取得
    const allActiveLayers = (EMA as any).getLayers((l: any) => l._active);
    const activeLayerNames = allActiveLayers
        .map((l: any) => l.__original__?.name || l.name || 'unknown')
        .filter((name: string) => name !== 'unknown');
    
    return {
        pass: isActive,
        message: () => {
            if (isActive) {
                // .not で失敗した場合
                let msg = `expect(received).not.toBeActive()\n\n` +
                          `Expected: ${layerName} to be inactive\n` +
                          `Received: ${layerName} is active (Condition: ${condition})`;
                
                if (activeLayerNames.length > 0) {
                    msg += `\nActive Layers: [${activeLayerNames.join(', ')}]`;
                }
                
                return msg;
            } else {
                // 通常の失敗
                let msg = `expect(received).toBeActive()\n\n` +
                          `Expected: ${layerName} to be active\n` +
                          `Received: ${layerName} is inactive (Condition: ${condition})`;
                
                if (activeLayerNames.length > 0) {
                    msg += `\nActive Layers: [${activeLayerNames.join(', ')}]`;
                } else {
                    msg += `\nActive Layers: (none)`;
                }
                
                return msg;
            }
        },
    };
}

export default toBeActive;
