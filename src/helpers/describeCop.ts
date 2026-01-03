import EMA from '../ema/EMA.js';
import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import OriginalMethodsPool from '../ema/OriginalMethodsPool.js';
import Layer from '../ema/Layer.js';

// コア機能（分離モジュールから）
import { CallTracker, createMethodWrapper } from '../core/CallTracker.js';
import { deepSnapshot, compareDeepSnapshots } from '../core/utils.js';
import { CopHooks } from '../core/CopHooks.js';

// マッチャー（分離モジュールから再エクスポート）
export { toBeActive } from '../matchers/toBeActive.js';
export { toBeActiveFor } from '../matchers/toBeActiveFor.js';
export { toBePartialMethodOf } from '../matchers/toBePartialMethodOf.js';
export { toBeOriginalMethod } from '../matchers/toBeOriginalMethod.js';
export { toHaveLastExecutedBehaviorOf } from '../matchers/toHaveLastExecutedBehaviorOf.js';
export { toHaveNthExecutedBehaviorOf } from '../matchers/toHaveNthExecutedBehaviorOf.js';
export { toHaveAllExecutedBehaviorOf } from '../matchers/toHaveAllExecutedBehaviorOf.js';
export { toExecuteInOrder } from '../matchers/toExecuteInOrder.js';
export { toHaveUsedConflictResolution } from '../matchers/toHaveUsedConflictResolution.js';
// 旧 API（後方互換性のため残す）
import { createAssertNoConflictingMethodCalled } from '../matchers/assertNoConflictingMethodCalled.js';
import { createAssertLayerStateTransition, LayerStateExpectation } from '../matchers/assertLayerStateTransition.js';
import { createAssertLayerStateUnchanged } from '../matchers/assertLayerStateUnchanged.js';
import { 
    createToChangeOtherLayersWhenActivating,
    createToChangeOtherLayersWhenDeactivating
} from '../matchers/whenActivated.js';
// 新 API（expect 形式）
import { createToTransitionLayerState } from '../matchers/toTransitionLayerState.js';
import { createToKeepLayerStateUnchanged } from '../matchers/toKeepLayerStateUnchanged.js';
import { createToCallConflictingMethod } from '../matchers/toCallConflictingMethod.js';

// 型定義
interface Use {
    layer: (layer: any | any[]) => void;
}

// グローバルに use を追加するための型拡張
declare global {
    var use: Use;
}

// 設定を保持する型
interface Config {
    layers: any[];
}

// 保存する状態の型
interface SavedState {
    signals: Array<{ ref: any; value: any }>;
    prototypes: Array<{ obj: any; methodName: string; method: any }>;
    deployedLayers: any[];
    signalInterfacePool: any[];
    originalInstallMethods: Array<{ layer: any; original: any }>;
    layerActiveStates: Array<{ layer: any; active: boolean }>;
    // EMA 設定の保存
    emaConfig: any;
    emaConflictResolutions: any[];
    // プール状態の保存
    partialMethodsPoolSnapshot: any[];
    originalMethodsPoolSnapshot: any[];
    // Layer._executeProceed の元の関数
    originalExecuteProceed: Function | null;
    // Layer._createCallbackMethod の元の関数
    originalCreateCallbackMethod: Function | null;
}

// 設定のスタック（ネスト対応）
const configStack: Config[] = [];

// deepSnapshot は core/utils.js からインポート済み

// EMA 関連の全状態をスナップショット（deepSnapshot を使用）
function getFullEMASnapshot(EMA: any): any {
    // EMA 内部のタイムスタンプや条件式など、毎回変わるプロパティを除外
    // activate/deactivate は whenActivated/whenDeactivated でラップされる可能性がある
    const excludeKeys = ['_timestamp', '_cond', 'condition', 'activate', 'deactivate'];
    
    // プールのスナップショット（obj の中身は走査しない）
    const snapshotPool = (pool: any[]): any => {
        return {
            length: pool.length,
            // 各エントリの構造だけ保存（obj の参照は保持するが中身は走査しない）
            entries: pool.map((entry, i) => ({
                index: i,
                objType: entry[0]?.constructor?.name || 'unknown',
                methodName: entry[1],
                entryLength: entry.length,
            })),
        };
    };
    
    return {
        ema: deepSnapshot(EMA, excludeKeys),
        partialMethodsPool: snapshotPool((PartialMethodsPool as any)._partialMethods || []),
        originalMethodsPool: snapshotPool((OriginalMethodsPool as any)._originalMethods || []),
    };
}

// compareDeepSnapshots は core/utils.js からインポート済み

// プール内の全 obj のメソッド状態をキャプチャ
function capturePoolObjectMethods(): Array<{ obj: any; methodName: string; method: any; existed: boolean }> {
    const result: Array<{ obj: any; methodName: string; method: any; existed: boolean }> = [];
    const savedObjMethods = new Set<string>();
    
    const partialPool = (PartialMethodsPool as any)._partialMethods || [];
    const originalPool = (OriginalMethodsPool as any)._originalMethods || [];
    
    // PartialMethodsPool から obj とメソッド名を収集
    for (const pm of partialPool) {
        const [obj, methodName] = pm;
        const key = `${obj.constructor?.name || 'unknown'}#${methodName}`;
        if (!savedObjMethods.has(key)) {
            savedObjMethods.add(key);
            const existed = Object.prototype.hasOwnProperty.call(obj, methodName);
            result.push({
                obj,
                methodName,
                method: obj[methodName],
                existed,
            });
        }
    }
    
    // OriginalMethodsPool から obj とメソッド名を収集
    for (const om of originalPool) {
        const [obj, methodName] = om;
        const key = `${obj.constructor?.name || 'unknown'}#${methodName}`;
        if (!savedObjMethods.has(key)) {
            savedObjMethods.add(key);
            const existed = Object.prototype.hasOwnProperty.call(obj, methodName);
            result.push({
                obj,
                methodName,
                method: obj[methodName],
                existed,
            });
        }
    }
    
    return result;
}

// インストールされた関数にメタ情報を付与
function attachLayerMetadata(deployedLayer: any): void {
    const originalLayer = deployedLayer.__original__;
    (PartialMethodsPool as any).forEachByLayer(deployedLayer, (obj: any, methodName: string) => {
        if (obj[methodName]) {
            obj[methodName].__layer__ = originalLayer;
        }
    });
}

// メタ情報を削除
function clearLayerMetadata(deployedLayer: any): void {
    (PartialMethodsPool as any).forEachByLayer(deployedLayer, (obj: any, methodName: string) => {
        if (obj[methodName] && obj[methodName].__layer__) {
            delete obj[methodName].__layer__;
        }
    });
}

export function describeCop(name: string, fn: () => void): void {
    describe(name, () => {
        // 設定を初期化
        const config: Config = {
            layers: [],
        };
        
        // スタックにプッシュ
        configStack.push(config);
        
        // use オブジェクトを提供
        global.use = {
            layer: (layer: any | any[]) => {
                const currentConfig = configStack[configStack.length - 1];
                if (Array.isArray(layer)) {
                    currentConfig.layers.push(...layer);
                } else {
                    currentConfig.layers.push(layer);
                }
            },
        };
        
        fn();
        
        // 状態の保存/復元
        let savedState: SavedState | null = null;
        let initialSnapshot: any = null;
        let initialPoolObjectMethods: Array<{ obj: any; methodName: string; method: any; existed: boolean }> = [];
        
        beforeEach(() => {
            // config をスタックにプッシュ
            configStack.push(config);
            
            // テスト前の EMA 状態をディープスナップショット
            initialSnapshot = getFullEMASnapshot(EMA);
            
            // テスト前のプール内 obj のメソッド状態を保存（initialSnapshot と同じタイミング）
            initialPoolObjectMethods = capturePoolObjectMethods();
            
            // 状態を保存し、独立環境をセットアップ
            savedState = setupIsolatedEnvironment(config);
        });
        
        afterEach(() => {
            // 状態を復元
            if (savedState) {
                restoreEnvironment(savedState, initialPoolObjectMethods);
            }
            
            // スタックからポップ
            configStack.pop();
            
            // 復元後の EMA 状態を検証
            if (initialSnapshot) {
                const afterSnapshot = getFullEMASnapshot(EMA);
                const result = compareDeepSnapshots(initialSnapshot, afterSnapshot);
                if (result.changed) {
                    throw new Error(`EMA state not properly restored:\n${result.differences.join('\n')}`);
                }
            }
        });
    });
}

// 全ての prototype を元に戻す
function resetAllPrototypes(): void {
    const pool = (PartialMethodsPool as any)._partialMethods || [];
    
    for (const pm of pool) {
        const [obj, methodName] = pm;
        const original = (OriginalMethodsPool as any).get(obj, methodName);
        if (original) {
            obj[methodName] = original;
        }
    }
}

// 全ての Signal を取得
function getAllSignals(): any[] {
    const signals: any[] = [];
    const signalPool = (EMA as any)._signalInterfacePool || [];
    
    for (const [_, signalInterface] of signalPool) {
        for (const key in signalInterface) {
            if (signalInterface.hasOwnProperty(key)) {
                const signal = signalInterface[key];
                // 重複チェック
                if (!signals.includes(signal)) {
                    signals.push(signal);
                }
            }
        }
    }
    
    return signals;
}

// Layer から関連する Signal を取得
function getSignalsFromLayer(originalLayer: any): any[] {
    const signals: any[] = [];
    
    // EMA._signalInterfacePool から condition に含まれる Signal を探す
    const deployedLayers = (EMA as any).getLayers((layer: any) => 
        layer.__original__ === originalLayer
    );
    
    if (deployedLayers.length > 0) {
        const deployedLayer = deployedLayers[0];
        const conditionExpr = deployedLayer._cond?.expression || '';
        const signalPool = (EMA as any)._signalInterfacePool || [];
        
        for (const [_, signalInterface] of signalPool) {
            for (const key in signalInterface) {
                if (conditionExpr.includes(key)) {
                    signals.push(signalInterface[key]);
                }
            }
        }
    }
    
    return signals;
}

// 独立した環境をセットアップ
function setupIsolatedEnvironment(config: Config): SavedState {
    // プールの深いコピーを作成
    const copyPartialMethodsPool = (pool: any[]): any[] => {
        return pool.map(pm => [...pm]);
    };
    const copyOriginalMethodsPool = (pool: any[]): any[] => {
        return pool.map(entry => [...entry]);
    };

    const partialPool = (PartialMethodsPool as any)._partialMethods || [];
    const originalPool = (OriginalMethodsPool as any)._originalMethods || [];

    const state: SavedState = {
        signals: [],
        prototypes: [],
        deployedLayers: [...(EMA as any)._deployedLayers],
        signalInterfacePool: [...(EMA as any)._signalInterfacePool],
        originalInstallMethods: [],
        layerActiveStates: [],
        // EMA 設定を保存
        emaConfig: (EMA as any)._config ? { ...(EMA as any)._config } : null,
        emaConflictResolutions: [...((EMA as any)._conflictResolutions || [])],
        // プール状態を保存
        partialMethodsPoolSnapshot: copyPartialMethodsPool(partialPool),
        originalMethodsPoolSnapshot: copyOriginalMethodsPool(originalPool),
        // Layer._executeProceed の元の関数
        originalExecuteProceed: (Layer as any)._executeProceed || null,
        // Layer._createCallbackMethod の元の関数
        originalCreateCallbackMethod: (Layer as any)._createCallbackMethod || null,
    };
    
    // 0. CallTracker の呼び出し履歴をリセット
    CallTracker.reset();
    
    // 0.5. Layer._executeProceed をラップして chain 追跡を追加
    const originalExecuteProceed = (Layer as any)._executeProceed;
    if (originalExecuteProceed) {
        (Layer as any)._executeProceed = function(instance: any, obj: any, methodName: string, currentDeployedLayer: any, args: any[]) {
            // 現在の層を chain に追加
            const currentOriginalLayer = currentDeployedLayer?.__original__;
            if (currentOriginalLayer) {
                CallTracker.addToChain(currentOriginalLayer);
            }
            // オリジナルの処理を実行
            return originalExecuteProceed.call(this, instance, obj, methodName, currentDeployedLayer, args);
        };
    }
    
    // 0.6. Layer._createCallbackMethod をラップしてコンフリクト解決の追跡を追加
    const originalCreateCallbackMethod = (Layer as any)._createCallbackMethod;
    if (originalCreateCallbackMethod) {
        (Layer as any)._createCallbackMethod = function(obj: any, methodName: string, resolution: any) {
            // オリジナルの処理でカスタムメソッドを生成
            const customMethod = originalCreateCallbackMethod.call(this, obj, methodName, resolution);
            
            // コンフリクト解決情報付きのメソッドを作成
            const conflictAwareMethod = function(this: any, ...args: any[]) {
                // コンフリクト解決が使われたことをマーク
                CallTracker.markConflictResolution(obj, methodName, resolution.layers);
                
                // カスタムメソッドを実行
                return customMethod.apply(this, args);
            };
            
            // CallTracker でラップして返す
            const wrapper = createMethodWrapper(obj, methodName);
            return wrapper(conflictAwareMethod);
        };
    }
    
    // 1. 全ての Signal の値を保存（EMA の状態を完全に復元するため）
    const allSignals = getAllSignals();
    for (const signal of allSignals) {
        state.signals.push({
            ref: signal,
            value: signal._val,
        });
    }
    
    // 1.5. 全ての Layer の _active 状態を保存
    const deployedLayersForActiveState = (EMA as any)._deployedLayers || [];
    for (const layer of deployedLayersForActiveState) {
        state.layerActiveStates.push({
            layer,
            active: layer._active,
        });
    }
    
    // 2. 全ての prototype の現在の状態を保存
    const pool = (PartialMethodsPool as any)._partialMethods || [];
    const savedPrototypes = new Map<string, any>();
    
    for (const pm of pool) {
        const [obj, methodName] = pm;
        const key = `${obj.constructor?.name || 'unknown'}.${methodName}`;
        if (!savedPrototypes.has(key)) {
            state.prototypes.push({
                obj,
                methodName,
                method: obj[methodName],
            });
            savedPrototypes.set(key, true);
        }
    }
    
    // 3. 全ての prototype を元に戻す（全ての Layer の影響を除去）
    resetAllPrototypes();
    
    // 3.5. 指定された層が refine するメソッドを CallTracker でラップ（オリジナル版も追跡）
    const trackedMethods = new Set<string>();
    for (const pm of pool) {
        const [obj, methodName, , originalLayer] = pm;
        // 指定された層のメソッドのみ対象
        if (!config.layers.includes(originalLayer)) continue;
        
        const key = `${obj.constructor?.name || 'unknown'}.${methodName}`;
        if (trackedMethods.has(key)) continue;
        trackedMethods.add(key);
        
        // オリジナルメソッドを CallTracker でラップ
        const original = obj[methodName];
        if (original && !(original as any).__callTracked__) {
            const wrapper = createMethodWrapper(obj, methodName);
            obj[methodName] = wrapper(original);
        }
    }
    
    // 4. 全ての Layer の _installPartialMethod と _uninstallPartialMethods をラップ
    //    - 指定した Layer: 元の処理を実行 + メタ情報付与
    //    - 指定外の Layer: 無効化（何もしない）
    const allDeployedLayers = (EMA as any)._deployedLayers || [];
    
    for (const deployedLayer of allDeployedLayers) {
        const originalLayer = deployedLayer.__original__;
        const isSpecifiedLayer = config.layers.includes(originalLayer);
        
        // 元のメソッドを保存
        const originalInstall = deployedLayer._installPartialMethod;
        const originalUninstall = deployedLayer._uninstallPartialMethods;
        
        state.originalInstallMethods.push({
            layer: deployedLayer,
            original: {
                install: originalInstall,
                uninstall: originalUninstall,
            },
        });
        
        if (isSpecifiedLayer) {
            // 指定した Layer: 元の処理を実行 + メタ情報付与 + CallTracker ラップ
            deployedLayer._installPartialMethod = function() {
                originalInstall.call(this);
                attachLayerMetadata(this);
                
                // install 後、部分メソッドを CallTracker でラップ
                (PartialMethodsPool as any).forEachByLayer(this, (obj: any, methodName: string) => {
                    const current = obj[methodName];
                    if (current && !(current as any).__callTracked__) {
                        const wrapper = createMethodWrapper(obj, methodName);
                        obj[methodName] = wrapper(current);
                    }
                });
            };
            
            deployedLayer._uninstallPartialMethods = function() {
                clearLayerMetadata(this);
                originalUninstall.call(this);
                
                // uninstall 後、オリジナルメソッドを CallTracker でラップ
                (PartialMethodsPool as any).forEachByLayer(this, (obj: any, methodName: string) => {
                    const current = obj[methodName];
                    if (current && !(current as any).__callTracked__) {
                        const wrapper = createMethodWrapper(obj, methodName);
                        obj[methodName] = wrapper(current);
                    }
                });
            };
            
            // 現在活性化している場合はインストール
            if (deployedLayer._active) {
                deployedLayer._installPartialMethod();
            }
        } else {
            // 指定外の Layer: 無効化（何もしない）
            deployedLayer._installPartialMethod = function() {
                // 何もしない（部分メソッドをインストールしない）
            };
            
            deployedLayer._uninstallPartialMethods = function() {
                // 何もしない（既にインストールされていないので）
            };
        }
    }
    
    return state;
}

// 環境を復元
function restoreEnvironment(
    state: SavedState, 
    initialPoolObjectMethods: Array<{ obj: any; methodName: string; method: any; existed: boolean }>
): void {
    // 0. CopHooks をリセット（インストールしたメソッドを元に戻す）
    CopHooks.reset();
    
    // 0.5. Layer._executeProceed を復元
    if (state.originalExecuteProceed) {
        (Layer as any)._executeProceed = state.originalExecuteProceed;
    }
    
    // 0.6. Layer._createCallbackMethod を復元
    if (state.originalCreateCallbackMethod) {
        (Layer as any)._createCallbackMethod = state.originalCreateCallbackMethod;
    }
    
    // 1. ラップしたメソッドを元に戻す（Signal 復元前に戻す必要がある）
    for (const item of state.originalInstallMethods) {
        item.layer._installPartialMethod = item.original.install;
        item.layer._uninstallPartialMethods = item.original.uninstall;
    }
    
    // 2. 全ての Layer の _active 状態を復元
    for (const las of state.layerActiveStates) {
        las.layer._active = las.active;
    }
    
    // 3. Signal の値を復元（setter を使って Layer に通知）
    for (const s of state.signals) {
        s.ref.value = s.value;
    }
    
    // 4. prototype を復元
    for (const p of state.prototypes) {
        p.obj[p.methodName] = p.method;
    }
    
    // 5. EMA 設定を復元
    if (state.emaConfig !== null) {
        (EMA as any)._config = state.emaConfig;
    }
    (EMA as any)._conflictResolutions = state.emaConflictResolutions;
    
    // 6. プール状態を復元
    (PartialMethodsPool as any)._partialMethods = state.partialMethodsPoolSnapshot;
    (OriginalMethodsPool as any)._originalMethods = state.originalMethodsPoolSnapshot;
    
    // 7. プール内の obj のメソッド状態を復元（initialSnapshot と同じ時点の状態に）
    for (const item of initialPoolObjectMethods) {
        if (item.existed) {
            // 元々存在していたメソッドは復元
            item.obj[item.methodName] = item.method;
        } else {
            // 元々存在しなかったメソッドは削除
            delete item.obj[item.methodName];
        }
    }
}

// テスト用: 現在の設定を取得
export function getCurrentConfig(): Config | null {
    return configStack[configStack.length - 1] || null;
}

// toBePartialMethodOf は matchers/ から再エクスポート済み

// toBeOriginalMethod は matchers/ から再エクスポート済み

/**
 * 複数の層が同じメソッドを refine している場合、
 * 両方活性化している状態でそのメソッドが呼ばれたらエラーを投げる
 * 
 * @example
 * assertNoConflictingMethodCalled(() => {
 *     player.update();  // takeDamage が呼ばれたら、複数層が活性化していればエラー
 * });
 */
// 旧 API（後方互換性のため残す）
export const assertNoConflictingMethodCalled = createAssertNoConflictingMethodCalled(
    () => getCurrentConfig() ?? undefined
);

export const assertLayerStateUnchanged = createAssertLayerStateUnchanged(
    () => getCurrentConfig() ?? { layers: [] }
);

export const assertLayerStateTransition = createAssertLayerStateTransition(
    () => getCurrentConfig() ?? { layers: [] }
);

// 新 API（expect 形式のマッチャー）
export const toTransitionLayerState = createToTransitionLayerState(
    () => getCurrentConfig() ?? { layers: [] }
);

export const toKeepLayerStateUnchanged = createToKeepLayerStateUnchanged(
    () => getCurrentConfig() ?? { layers: [] }
);

export const toCallConflictingMethod = createToCallConflictingMethod(
    () => getCurrentConfig() ?? undefined
);

// toChangeOtherLayersWhenActivating / toChangeOtherLayersWhenDeactivating
export const toChangeOtherLayersWhenActivating = createToChangeOtherLayersWhenActivating(
    () => getCurrentConfig() ?? { layers: [] }
);

export const toChangeOtherLayersWhenDeactivating = createToChangeOtherLayersWhenDeactivating(
    () => getCurrentConfig() ?? { layers: [] }
);