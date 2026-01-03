/**
 * 層の状態を扱うヘルパー関数
 */

import EMA from '../ema/EMA.js';

// 層の状態
export interface LayerState {
    name: string;
    active: boolean;
}

// 層の状態期待値
export interface LayerStateExpectation {
    active?: any[];
    inactive?: any[];
}

/**
 * 特定の層を除いた他の層の状態をキャプチャ
 */
export function captureOtherLayerStates(excludeLayer: any): LayerState[] {
    const deployedLayers = (EMA as any)._deployedLayers || [];
    return deployedLayers
        .filter((l: any) => l.__original__ !== excludeLayer && l._name !== excludeLayer.name)
        .map((l: any) => ({ name: l._name, active: l._active }));
}

/**
 * 層の状態が変化したかどうかを判定
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
 * 変化した層の一覧を取得
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
 * 層の活性化状態を取得
 */
export function getLayerActivationState(layers: any[]): LayerState[] {
    const deployedLayers = (EMA as any)._deployedLayers || [];
    
    return layers.map(originalLayer => {
        const deployed = deployedLayers.find((l: any) => l.__original__ === originalLayer);
        return {
            name: originalLayer.name || 'unknown',
            active: deployed ? deployed._active : false
        };
    });
}
