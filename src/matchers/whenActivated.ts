/**
 * toChangeOtherLayersWhenActivating / toChangeOtherLayersWhenDeactivating マッチャー
 * 
 * 関数実行中に層が活性化/非活性化されたとき、他の層が変わらないことを検証
 * 
 * @example
 * expect(() => {
 *     difficultySignal.value = 'hard';
 * }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
 * 
 * expect(() => {
 *     player.enterBossRoom();  // 内部で BossWaveLayer が活性化
 * }).not.toChangeOtherLayersWhenActivating(BossWaveLayer);
 * 
 * expect(() => {
 *     EMA.deactivate(LayerA);
 * }).not.toChangeOtherLayersWhenDeactivating(LayerA);
 */

import EMA from '../ema/EMA.js';
import { CopHooks } from '../core/CopHooks.js';
import { MatcherResult } from '../core/types.js';

/**
 * getCurrentConfig を取得するための型
 */
type GetCurrentConfigFn = () => { layers: any[] } | null;

/**
 * 他の層の状態をキャプチャ
 */
function captureOtherLayersState(targetLayer: any, declaredLayers: any[]): Map<any, boolean> {
    const state = new Map<any, boolean>();
    const deployedLayers = (EMA as any)._deployedLayers || [];
    
    for (const deployedLayer of deployedLayers) {
        const originalLayer = deployedLayer.__original__;
        // ターゲット層以外で、宣言された層のみ
        if (originalLayer !== targetLayer && declaredLayers.includes(originalLayer)) {
            state.set(originalLayer, deployedLayer._active);
        }
    }
    
    return state;
}

/**
 * 状態の変化を検出
 */
function detectChanges(before: Map<any, boolean>, after: Map<any, boolean>): string[] {
    const changes: string[] = [];
    
    for (const [layer, wasBefore] of before) {
        const isNow = after.get(layer);
        if (wasBefore !== isNow) {
            const name = layer?.name || 'unknown';
            if (isNow) {
                changes.push(`Layer '${name}' was activated`);
            } else {
                changes.push(`Layer '${name}' was deactivated`);
            }
        }
    }
    
    return changes;
}

/**
 * ターゲット層の deployed layer を取得
 */
function getDeployedLayer(targetLayer: any): any {
    const deployedLayers = (EMA as any)._deployedLayers || [];
    return deployedLayers.find((l: any) => l.__original__ === targetLayer);
}

/**
 * toChangeOtherLayersWhenActivating マッチャーのファクトリ関数
 * 
 * expect(fn).not.toChangeOtherLayersWhenActivating(Layer) 形式
 */
export function createToChangeOtherLayersWhenActivating(getCurrentConfig: GetCurrentConfigFn) {
    return function toChangeOtherLayersWhenActivating(
        received: () => void,
        targetLayer: any
    ): MatcherResult {
        if (typeof received !== 'function') {
            return {
                pass: false,
                message: () =>
                    `expect(received).not.toChangeOtherLayersWhenActivating(Layer)\n\n` +
                    `Error: received must be a function.`
            };
        }
        
        const config = getCurrentConfig();
        const declaredLayers = config?.layers || [];
        const targetLayerName = targetLayer?.name || 'unknown';
        const deployedLayer = getDeployedLayer(targetLayer);
        
        if (!deployedLayer) {
            return {
                pass: false,
                message: () =>
                    `expect(fn).not.toChangeOtherLayersWhenActivating(${targetLayerName})\n\n` +
                    `Error: Layer '${targetLayerName}' is not deployed.`
            };
        }
        
        let wasActivated = false;
        let changesDetected: string[] = [];
        let beforeState: Map<any, boolean> | null = null;
        
        // _enter にフックをインストール
        CopHooks.install(deployedLayer, '_enter');
        
        const unregisterBefore = CopHooks.register(
            deployedLayer,
            '_enter',
            'before',
            () => {
                beforeState = captureOtherLayersState(targetLayer, declaredLayers);
            }
        );
        
        const unregisterAfter = CopHooks.register(
            deployedLayer,
            '_enter',
            'after',
            () => {
                wasActivated = true;
                if (beforeState) {
                    const afterState = captureOtherLayersState(targetLayer, declaredLayers);
                    changesDetected = detectChanges(beforeState, afterState);
                }
            }
        );
        
        // 関数を実行
        try {
            received();
        } finally {
            // フックを解除
            unregisterBefore();
            unregisterAfter();
            CopHooks.uninstall(deployedLayer, '_enter');
        }
        
        // 活性化されなかった場合、変化なしとみなす（pass = false で .not が成功）
        if (!wasActivated) {
            return {
                pass: false,
                message: () =>
                    `expect(fn).toChangeOtherLayersWhenActivating(${targetLayerName})\n\n` +
                    `Expected: other layers to change when activating '${targetLayerName}'\n` +
                    `Received: Layer '${targetLayerName}' was not activated during execution`
            };
        }
        
        // pass = true なら「他の層が変わった」（.not で失敗）
        // pass = false なら「他の層が変わらなかった」（.not で成功）
        const pass = changesDetected.length > 0;
        
        return {
            pass,
            message: () => {
                if (pass) {
                    // 変化があった（.not で使うと失敗）
                    return `expect(fn).not.toChangeOtherLayersWhenActivating(${targetLayerName})\n\n` +
                           `Expected: other layers NOT to change when activating '${targetLayerName}'\n` +
                           `Received: other layers changed\n\n` +
                           `Changes:\n${changesDetected.map(c => `  - ${c}`).join('\n')}`;
                } else {
                    // 変化がなかった（.not なしで使うと失敗）
                    return `expect(fn).toChangeOtherLayersWhenActivating(${targetLayerName})\n\n` +
                           `Expected: other layers to change when activating '${targetLayerName}'\n` +
                           `Received: no other layers changed`;
                }
            }
        };
    };
}

/**
 * toChangeOtherLayersWhenDeactivating マッチャーのファクトリ関数
 * 
 * expect(fn).not.toChangeOtherLayersWhenDeactivating(Layer) 形式
 */
export function createToChangeOtherLayersWhenDeactivating(getCurrentConfig: GetCurrentConfigFn) {
    return function toChangeOtherLayersWhenDeactivating(
        received: () => void,
        targetLayer: any
    ): MatcherResult {
        if (typeof received !== 'function') {
            return {
                pass: false,
                message: () =>
                    `expect(received).not.toChangeOtherLayersWhenDeactivating(Layer)\n\n` +
                    `Error: received must be a function.`
            };
        }
        
        const config = getCurrentConfig();
        const declaredLayers = config?.layers || [];
        const targetLayerName = targetLayer?.name || 'unknown';
        const deployedLayer = getDeployedLayer(targetLayer);
        
        if (!deployedLayer) {
            return {
                pass: false,
                message: () =>
                    `expect(fn).not.toChangeOtherLayersWhenDeactivating(${targetLayerName})\n\n` +
                    `Error: Layer '${targetLayerName}' is not deployed.`
            };
        }
        
        let wasDeactivated = false;
        let changesDetected: string[] = [];
        let beforeState: Map<any, boolean> | null = null;
        
        // _exit にフックをインストール
        CopHooks.install(deployedLayer, '_exit');
        
        const unregisterBefore = CopHooks.register(
            deployedLayer,
            '_exit',
            'before',
            () => {
                beforeState = captureOtherLayersState(targetLayer, declaredLayers);
            }
        );
        
        const unregisterAfter = CopHooks.register(
            deployedLayer,
            '_exit',
            'after',
            () => {
                wasDeactivated = true;
                if (beforeState) {
                    const afterState = captureOtherLayersState(targetLayer, declaredLayers);
                    changesDetected = detectChanges(beforeState, afterState);
                }
            }
        );
        
        // 関数を実行
        try {
            received();
        } finally {
            // フックを解除
            unregisterBefore();
            unregisterAfter();
            CopHooks.uninstall(deployedLayer, '_exit');
        }
        
        // 非活性化されなかった場合
        if (!wasDeactivated) {
            return {
                pass: false,
                message: () =>
                    `expect(fn).toChangeOtherLayersWhenDeactivating(${targetLayerName})\n\n` +
                    `Expected: other layers to change when deactivating '${targetLayerName}'\n` +
                    `Received: Layer '${targetLayerName}' was not deactivated during execution`
            };
        }
        
        const pass = changesDetected.length > 0;
        
        return {
            pass,
            message: () => {
                if (pass) {
                    return `expect(fn).not.toChangeOtherLayersWhenDeactivating(${targetLayerName})\n\n` +
                           `Expected: other layers NOT to change when deactivating '${targetLayerName}'\n` +
                           `Received: other layers changed\n\n` +
                           `Changes:\n${changesDetected.map(c => `  - ${c}`).join('\n')}`;
                } else {
                    return `expect(fn).toChangeOtherLayersWhenDeactivating(${targetLayerName})\n\n` +
                           `Expected: other layers to change when deactivating '${targetLayerName}'\n` +
                           `Received: no other layers changed`;
                }
            }
        };
    };
}

