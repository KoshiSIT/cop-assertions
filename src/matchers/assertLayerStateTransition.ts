/**
 * assertLayerStateTransition
 * 
 * 関数実行前後で Layer の活性化状態が期待通りに遷移することをアサート
 */

import EMA from '../ema/EMA.js';

/**
 * 層の状態期待値
 */
export interface LayerStateExpectation {
    active?: any[];
    inactive?: any[];
}

/**
 * getCurrentConfig を取得するための型
 */
type GetCurrentConfigFn = () => { layers: any[] } | null;

/**
 * assertLayerStateTransition のファクトリ関数
 * describeCop の getCurrentConfig を注入して使用
 */
export function createAssertLayerStateTransition(getCurrentConfig: GetCurrentConfigFn) {
    return function assertLayerStateTransition(
        before: LayerStateExpectation,
        after: LayerStateExpectation,
        fn: () => void
    ): void {
        const deployedLayers = (EMA as any)._deployedLayers || [];
        
        // Layer 名を取得するヘルパー
        const getLayerName = (layer: any): string => layer?.name || 'unknown';
        
        // 1. use.layer() で宣言された Layer を取得
        const config = getCurrentConfig();
        const declaredLayers = config?.layers || [];
        
        // 2. before/after に指定された Layer が宣言されているか検証
        const allSpecifiedLayers = [
            ...(before.active || []),
            ...(before.inactive || []),
            ...(after.active || []),
            ...(after.inactive || []),
        ];
        
        const undeclaredLayers: string[] = [];
        for (const layer of allSpecifiedLayers) {
            if (!declaredLayers.includes(layer)) {
                const name = getLayerName(layer);
                if (!undeclaredLayers.includes(name)) {
                    undeclaredLayers.push(name);
                }
            }
        }
        
        if (undeclaredLayers.length > 0) {
            throw new Error(
                `assertLayerStateTransition: The following layers are not declared with use.layer():\n` +
                undeclaredLayers.map(name => `  - ${name}`).join('\n') +
                `\n\nDeclared layers: [${declaredLayers.map(getLayerName).join(', ')}]`
            );
        }
        
        // Layer の活性化状態を取得するヘルパー
        const isLayerActive = (originalLayer: any): boolean => {
            const deployed = deployedLayers.find((l: any) => l.__original__ === originalLayer);
            return deployed ? deployed._active : false;
        };
        
        // 状態を検証するヘルパー
        const validateState = (
            expectation: LayerStateExpectation, 
            phase: 'before' | 'after'
        ): string[] => {
            const errors: string[] = [];
            
            // active であるべき Layer を検証
            if (expectation.active) {
                for (const layer of expectation.active) {
                    if (!isLayerActive(layer)) {
                        errors.push(`${getLayerName(layer)} should be active ${phase} execution, but was inactive`);
                    }
                }
            }
            
            // inactive であるべき Layer を検証
            if (expectation.inactive) {
                for (const layer of expectation.inactive) {
                    if (isLayerActive(layer)) {
                        errors.push(`${getLayerName(layer)} should be inactive ${phase} execution, but was active`);
                    }
                }
            }
            
            return errors;
        };
        
        // 予期しない Layer の変化を検出するヘルパー
        const detectUnexpectedChanges = (
            beforeState: Map<any, boolean>,
            afterExpectation: LayerStateExpectation
        ): string[] => {
            const errors: string[] = [];
            const expectedActive = new Set(afterExpectation.active || []);
            const expectedInactive = new Set(afterExpectation.inactive || []);
            
            for (const [layer, wasBefore] of beforeState) {
                const originalLayer = layer.__original__;
                const isNow = layer._active;
                
                // 状態が変化した場合
                if (wasBefore !== isNow) {
                    const isExpected = isNow 
                        ? expectedActive.has(originalLayer)
                        : expectedInactive.has(originalLayer);
                    
                    if (!isExpected) {
                        const change = isNow ? 'activated' : 'deactivated';
                        errors.push(`${getLayerName(originalLayer)} was unexpectedly ${change}`);
                    }
                }
            }
            
            return errors;
        };
        
        // 1. 処理前の状態を保存
        const beforeState = new Map<any, boolean>();
        for (const layer of deployedLayers) {
            beforeState.set(layer, layer._active);
        }
        
        // 2. 処理前の状態を検証
        const beforeErrors = validateState(before, 'before');
        if (beforeErrors.length > 0) {
            throw new Error(
                `Layer state mismatch before execution:\n` +
                beforeErrors.map(e => `  - ${e}`).join('\n')
            );
        }
        
        // 3. 処理を実行
        fn();
        
        // 4. 処理後の状態を検証
        const afterErrors = validateState(after, 'after');
        if (afterErrors.length > 0) {
            throw new Error(
                `Layer state mismatch after execution:\n` +
                afterErrors.map(e => `  - ${e}`).join('\n')
            );
        }
        
        // 5. 予期しない Layer の変化を検出
        const unexpectedErrors = detectUnexpectedChanges(beforeState, after);
        if (unexpectedErrors.length > 0) {
            throw new Error(
                `Unexpected layer state changes:\n` +
                unexpectedErrors.map(e => `  - ${e}`).join('\n')
            );
        }
    };
}
