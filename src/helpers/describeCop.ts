import EMA from '../ema/EMA.js';
import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import OriginalMethodsPool from '../ema/OriginalMethodsPool.js';

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
}

// 設定のスタック（ネスト対応）
const configStack: Config[] = [];

// ディープスナップショットを取得（オブジェクトの全プロパティを再帰的に取得）
function deepSnapshot(obj: any, seen: WeakSet<object> = new WeakSet(), path: string = 'root', depth: number = 0): any {
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
    
    // 配列
    if (Array.isArray(obj)) {
        return obj.map((item, i) => deepSnapshot(item, seen, `${path}[${i}]`, depth + 1));
    }
    
    // DOM 要素やその他の特殊オブジェクトはスキップ
    if (obj.constructor && ['HTMLElement', 'Window', 'Document'].includes(obj.constructor.name)) {
        return `[${obj.constructor.name}]`;
    }
    
    // 通常のオブジェクト
    const result: Record<string, any> = {};
    
    // 全てのプロパティを取得（enumerable でないものも含む）
    const allKeys = new Set([
        ...Object.keys(obj),
        ...Object.getOwnPropertyNames(obj),
    ]);
    
    // 特定のプロパティは除外（関数、内部実装詳細など）
    const excludePatterns = [
        /^__proto__$/,
        /^constructor$/,
        /^_timestamp$/,      // EMA 内部のタイムスタンプ（毎回変わる）
        /^_cond$/,           // cleanCondition() で再生成されるため復元不可
        /^condition$/,       // _cond へのゲッター
    ];
    
    for (const key of Array.from(allKeys).sort()) {
        // 除外パターンにマッチしたらスキップ
        if (excludePatterns.some(p => p.test(key))) continue;
        
        try {
            const value = obj[key];
            result[key] = deepSnapshot(value, seen, `${path}.${key}`, depth + 1);
        } catch (e) {
            // getter でエラーが発生した場合
            result[key] = '[Error accessing property]';
        }
    }
    
    return result;
}

// EMA 関連の全状態をスナップショット（deepSnapshot を使用）
function getFullEMASnapshot(EMA: any): any {
    return {
        ema: deepSnapshot(EMA),
        partialMethodsPool: deepSnapshot(PartialMethodsPool),
        originalMethodsPool: deepSnapshot(OriginalMethodsPool),
    };
}

// スナップショットを比較してエラーメッセージを生成
function compareDeepSnapshots(before: any, after: any, path: string = ''): string[] {
    const differences: string[] = [];
    
    // 型が違う
    if (typeof before !== typeof after) {
        differences.push(`${path}: type ${typeof before} → ${typeof after}`);
        return differences;
    }
    
    // プリミティブ値の比較
    if (before === null || after === null || typeof before !== 'object') {
        if (before !== after) {
            differences.push(`${path}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
        }
        return differences;
    }
    
    // 配列の比較
    if (Array.isArray(before) && Array.isArray(after)) {
        if (before.length !== after.length) {
            differences.push(`${path}.length: ${before.length} → ${after.length}`);
        }
        const maxLen = Math.max(before.length, after.length);
        for (let i = 0; i < maxLen; i++) {
            differences.push(...compareDeepSnapshots(before[i], after[i], `${path}[${i}]`));
        }
        return differences;
    }
    
    // オブジェクトの比較
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of allKeys) {
        const beforeVal = before[key];
        const afterVal = after[key];
        
        if (!(key in before)) {
            differences.push(`${path}.${key}: [undefined] → ${JSON.stringify(afterVal)}`);
        } else if (!(key in after)) {
            differences.push(`${path}.${key}: ${JSON.stringify(beforeVal)} → [undefined]`);
        } else {
            differences.push(...compareDeepSnapshots(beforeVal, afterVal, `${path}.${key}`));
        }
    }
    
    return differences;
}

// インストールされた関数にメタ情報を付与する関数
function attachLayerMetadata(deployedLayer: any): void {
    const originalLayer = deployedLayer.__original__;
    (PartialMethodsPool as any).forEachByLayer(deployedLayer, (obj: any, methodName: string) => {
        if (obj[methodName]) {
            obj[methodName].__layer__ = originalLayer;
        }
    });
}

// メタ情報を削除する関数
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
        
        beforeEach(() => {
            // config をスタックにプッシュ
            configStack.push(config);
            
            // テスト前の EMA 状態をディープスナップショット
            initialSnapshot = getFullEMASnapshot(EMA);
            
            // 状態を保存し、独立環境をセットアップ
            savedState = setupIsolatedEnvironment(config);
        });
        
        afterEach(() => {
            // 状態を復元
            if (savedState) {
                restoreEnvironment(savedState);
            }
            
            // スタックからポップ
            configStack.pop();
            
            // 復元後の EMA 状態を検証
            if (initialSnapshot) {
                const afterSnapshot = getFullEMASnapshot(EMA);
                const differences = compareDeepSnapshots(initialSnapshot, afterSnapshot, 'EMA');
                if (differences.length > 0) {
                    throw new Error(`EMA state not properly restored:\n${differences.join('\n')}`);
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
    const state: SavedState = {
        signals: [],
        prototypes: [],
        deployedLayers: [...(EMA as any)._deployedLayers],
        signalInterfacePool: [...(EMA as any)._signalInterfacePool],
        originalInstallMethods: [],
        layerActiveStates: [],
    };
    
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
            // 指定した Layer: 元の処理を実行 + メタ情報付与
            deployedLayer._installPartialMethod = function() {
                originalInstall.call(this);
                attachLayerMetadata(this);
            };
            
            deployedLayer._uninstallPartialMethods = function() {
                clearLayerMetadata(this);
                originalUninstall.call(this);
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
function restoreEnvironment(state: SavedState): void {
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
}

// テスト用: 現在の設定を取得
export function getCurrentConfig(): Config | null {
    return configStack[configStack.length - 1] || null;
}

// カスタムマッチャー: toBePartialMethodOf
export function toBePartialMethodOf(received: any, layer: any): { pass: boolean; message: () => string } {
    const pool = (PartialMethodsPool as any)._partialMethods || [];
    
    // received（関数）が layer の部分メソッドかどうかを判定
    let foundMethodName: string | null = null;
    let foundClassName: string | null = null;
    let isOriginalMethod = false;
    
    // まず、received がどのメソッドかを特定
    for (const pm of pool) {
        const [obj, methodName] = pm;
        
        if (obj[methodName] === received) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            break;
        }
        
        // 元のメソッドかどうか確認
        const original = (OriginalMethodsPool as any).get(obj, methodName);
        if (original === received) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            isOriginalMethod = true;
        }
    }
    
    // received の __layer__ メタ情報から現在インストールされている Layer を取得
    const installedLayer = received?.__layer__ || null;
    
    // pass: 指定した Layer の部分メソッドがインストールされている
    const pass = installedLayer === layer;
    const methodInfo = foundMethodName 
        ? `${foundClassName}.${foundMethodName}` 
        : 'unknown method';
    const layerName = layer.name || 'Layer';
    
    return {
        pass,
        message: () => {
            if (isOriginalMethod && !installedLayer) {
                return `expect(received).toBePartialMethodOf(${layerName})\n\n` +
                       `Expected: ${methodInfo} to be a partial method of ${layerName}\n` +
                       `Received: ${methodInfo} is the original method (no Layer applied)`;
            }
            
            if (!installedLayer) {
                return `expect(received).toBePartialMethodOf(${layerName})\n\n` +
                       `Expected: ${methodInfo} to be a partial method of ${layerName}\n` +
                       `Received: ${methodInfo} is not a partial method`;
            }
            
            if (installedLayer !== layer) {
                return `expect(received).toBePartialMethodOf(${layerName})\n\n` +
                       `Expected: ${methodInfo} to be a partial method of ${layerName}\n` +
                       `Received: ${methodInfo} is a partial method of ${installedLayer?.name || 'unknown'}`;
            }
            
            // pass: true の場合（.not で失敗した場合）
            return `expect(received).not.toBePartialMethodOf(${layerName})\n\n` +
                   `Expected: ${methodInfo} not to be a partial method of ${layerName}\n` +
                   `Received: ${methodInfo} is a partial method of ${layerName}`;
        },
    };
}

// カスタムマッチャー: toBeActive
export function toBeActive(received: any): { pass: boolean; message: () => string } {
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

// Layer の活性化状態を取得
function getLayerActivationState(): Map<string, boolean> {
    const state = new Map<string, boolean>();
    const deployedLayers = (EMA as any)._deployedLayers || [];
    for (const layer of deployedLayers) {
        state.set(layer._name, layer._active);
    }
    return state;
}

/**
 * 関数実行中に Layer の活性化状態が変化しないことをアサート
 * 変更された瞬間にエラーを投げ、スタックトレースで原因箇所を特定できる
 * 
 * @example
 * assertLayerStateUnchanged(() => {
 *     enemy.update();
 * });
 */
export function assertLayerStateUnchanged(fn: () => void): void {
    const initialState = getLayerActivationState();
    const deployedLayers = (EMA as any)._deployedLayers || [];
    
    // 各 Layer の _active プロパティを監視
    const originalDescriptors: Array<{ layer: any; descriptor: PropertyDescriptor | undefined }> = [];
    
    for (const layer of deployedLayers) {
        const layerName = layer._name;
        const initialActive = initialState.get(layerName);
        
        // 元の descriptor を保存
        const descriptor = Object.getOwnPropertyDescriptor(layer, '_active');
        originalDescriptors.push({ layer, descriptor });
        
        // 現在の値を保持
        let currentValue = layer._active;
        
        // setter を上書きして監視
        Object.defineProperty(layer, '_active', {
            get: function() {
                return currentValue;
            },
            set: function(newValue: boolean) {
                currentValue = newValue;
                
                // 初期状態から変化したかチェック
                if (newValue !== initialActive) {
                    const change = newValue ? 'activated' : 'deactivated';
                    const error = new Error(
                        `Layer activation state changed during execution:\n` +
                        `  Layer '${layerName}' was ${change}\n` +
                        `  (${initialActive} → ${newValue})`
                    );
                    // エラーを保存して後で投げる（復元後に投げる必要がある）
                    (assertLayerStateUnchanged as any)._pendingError = error;
                }
            },
            configurable: true,
            enumerable: true,
        });
    }
    
    // 元の descriptor を復元する関数
    function restoreDescriptors() {
        for (const { layer, descriptor } of originalDescriptors) {
            const savedValue = initialState.get(layer._name);
            if (descriptor) {
                Object.defineProperty(layer, '_active', descriptor);
            } else {
                // descriptor がなかった場合は delete して再設定
                delete layer._active;
            }
            // 元の値に戻す
            layer._active = savedValue;
        }
    }
    
    try {
        fn();
    } finally {
        // 復元
        restoreDescriptors();
    }
    
    // 保存されたエラーがあれば投げる
    const pendingError = (assertLayerStateUnchanged as any)._pendingError;
    if (pendingError) {
        (assertLayerStateUnchanged as any)._pendingError = null;
        throw pendingError;
    }
}

// カスタムマッチャー: toBeOriginalMethod
export function toBeOriginalMethod(received: any): { pass: boolean; message: () => string } {
    const pool = (PartialMethodsPool as any)._partialMethods || [];
    
    // received（関数）が元のメソッドかどうかを判定
    let foundMethodName: string | null = null;
    let foundClassName: string | null = null;
    let originalMethod: any = null;
    let installedLayer: any = null;
    
    // まず、received がどのメソッドかを特定
    for (const pm of pool) {
        const [obj, methodName] = pm;
        
        // 現在インストールされているメソッドと比較
        if (obj[methodName] === received) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            originalMethod = (OriginalMethodsPool as any).get(obj, methodName);
            installedLayer = received?.__layer__ || null;
            break;
        }
        
        // 元のメソッドと比較
        const original = (OriginalMethodsPool as any).get(obj, methodName);
        if (original === received) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            originalMethod = original;
            break;
        }
    }
    
    // received の __layer__ メタ情報があれば部分メソッド
    const hasLayerMetadata = received?.__layer__ != null;
    
    // pass: 元のメソッドである（__layer__ がない、かつ OriginalMethodsPool のメソッドと一致）
    const isOriginal = !hasLayerMetadata && (originalMethod === received);
    
    const methodInfo = foundMethodName 
        ? `${foundClassName}.${foundMethodName}` 
        : 'unknown method';
    
    return {
        pass: isOriginal,
        message: () => {
            if (isOriginal) {
                // pass: true の場合（.not で失敗した場合）
                return `expect(received).not.toBeOriginalMethod()\n\n` +
                       `Expected: ${methodInfo} not to be the original method\n` +
                       `Received: ${methodInfo} is the original method`;
            }
            
            if (hasLayerMetadata) {
                const layerName = received.__layer__?.name || 'unknown';
                return `expect(received).toBeOriginalMethod()\n\n` +
                       `Expected: ${methodInfo} to be the original method\n` +
                       `Received: ${methodInfo} is a partial method of ${layerName}`;
            }
            
            if (originalMethod && originalMethod !== received) {
                return `expect(received).toBeOriginalMethod()\n\n` +
                       `Expected: ${methodInfo} to be the original method\n` +
                       `Received: ${methodInfo} is not the original method (modified)`;
            }
            
            return `expect(received).toBeOriginalMethod()\n\n` +
                   `Expected: ${methodInfo} to be the original method\n` +
                   `Received: ${methodInfo} is not a registered method`;
        },
    };
}

// Layer 状態の期待値を表す型
interface LayerStateExpectation {
    active?: any[];
    inactive?: any[];
}

/**
 * 関数実行前後で Layer の活性化状態が期待通りに遷移することをアサート
 * 
 * @example
 * assertLayerStateTransition(
 *     { active: [TutorialLayer], inactive: [HardModeLayer] },  // before
 *     { active: [TutorialLayer, HardModeLayer], inactive: [] },  // after
 *     () => {
 *         difficultySignal.value = 'hard';
 *     }
 * );
 */
export function assertLayerStateTransition(
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
}

/**
 * 複数の層が同じメソッドを refine している場合、
 * 両方活性化している状態でそのメソッドが呼ばれたらエラーを投げる
 * 
 * @example
 * assertNoConflictingMethodCalled(() => {
 *     player.update();  // takeDamage が呼ばれたら、複数層が活性化していればエラー
 * });
 */
export function assertNoConflictingMethodCalled(fn: () => void): void {
    const config = getCurrentConfig();
    const declaredLayers = config?.layers || [];
    const deployedLayers = (EMA as any)._deployedLayers || [];
    const pool = (PartialMethodsPool as any)._partialMethods || [];
    
    // Layer 名を取得するヘルパー
    const getLayerName = (layer: any): string => layer?.name || 'unknown';
    
    // 1. 宣言された層の中から、同じ (obj, methodName) を refine している層のグループを探す
    // Map<string, { obj, methodName, layers: originalLayer[] }>
    const methodToLayers = new Map<string, { obj: any; methodName: string; layers: any[] }>();
    
    for (const pm of pool) {
        const [obj, methodName, , originalLayer] = pm;
        
        // 宣言された層のみ対象
        if (!declaredLayers.includes(originalLayer)) {
            continue;
        }
        
        // obj と methodName のキーを作成（オブジェクト参照を含む）
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
    
    // チェック付きでメソッドをラップするヘルパー
    const wrapMethodWithCheck = (obj: any, methodName: string, layers: any[]) => {
        const currentMethod = obj[methodName];
        
        obj[methodName] = function(this: any, ...args: any[]) {
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
            
            return currentMethod.apply(this, args);
        };
    };
    
    // 3. 初期状態で競合するメソッドをラップ
    const originalMethods: Array<{ obj: any; methodName: string; original: any }> = [];
    
    for (const { obj, methodName, layers } of conflictingMethods) {
        originalMethods.push({ obj, methodName, original: obj[methodName] });
        wrapMethodWithCheck(obj, methodName, layers);
    }
    
    // 4. _installPartialMethod をラップして、途中で層が活性化しても再度チェックを追加
    const originalInstallMethods: Array<{ layer: any; original: any }> = [];
    
    for (const deployedLayer of deployedLayers) {
        const originalLayer = deployedLayer.__original__;
        
        // 宣言された層のみ対象
        if (!declaredLayers.includes(originalLayer)) {
            continue;
        }
        
        const originalInstall = deployedLayer._installPartialMethod;
        originalInstallMethods.push({ layer: deployedLayer, original: originalInstall });
        
        deployedLayer._installPartialMethod = function() {
            // 元のインストール処理を実行
            originalInstall.call(this);
            
            // インストール後、競合メソッドに再度チェックを追加
            for (const { obj, methodName, layers } of conflictingMethods) {
                wrapMethodWithCheck(obj, methodName, layers);
            }
        };
    }
    
    // 5. fn() 実行
    try {
        fn();
    } finally {
        // 6. _installPartialMethod を元に戻す
        for (const { layer, original } of originalInstallMethods) {
            layer._installPartialMethod = original;
        }
        
        // 7. メソッドを元に戻す
        for (const { obj, methodName, original } of originalMethods) {
            obj[methodName] = original;
        }
    }
}

// Jest にマッチャーを登録
declare global {
    namespace jest {
        interface Matchers<R> {
            toBePartialMethodOf(layer: any): R;
            toBeActive(): R;
            toBeOriginalMethod(): R;
        }
    }
}

// expect.extend があれば登録
if (typeof expect !== 'undefined' && typeof expect.extend === 'function') {
    expect.extend({
        toBePartialMethodOf,
        toBeActive,
        toBeOriginalMethod,
    });
}
