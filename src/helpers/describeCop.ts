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
