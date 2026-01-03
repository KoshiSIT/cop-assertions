import SignalComp from './SignalComp.js';
import PartialMethodsPool from './PartialMethodsPool.js';
import OriginalMethodsPool from './OriginalMethodsPool.js';

// EMA への参照（循環参照を避けるため、動的にインポート）
let EMA = null;

function Layer(originalLayer) {

    this._cond = originalLayer.condition === undefined ?
        new SignalComp("false") : typeof (originalLayer.condition) === "string" ?
            new SignalComp(originalLayer.condition) : originalLayer.condition;

    this._enter = originalLayer.enter || function () {};
    this._exit = originalLayer.exit || function () {};

    this._active = false;
    this._name = originalLayer.name || "_";
    this.__original__ = originalLayer;

    Object.defineProperty(this,'name', {
        set: function(name) {
            this._name = name;
        },
        get: function() {
            return this._name;
        }
    });

    Object.defineProperty(this,'condition', {
        get: function() {
            return this._cond;
        }
    });

    this.cleanCondition = function() {
        this._cond = new SignalComp(this._cond.expression);
    };

    this._installPartialMethod = function() {
        const currentDeployedLayer = this;
        const currentOriginalLayer = this.__original__;

        PartialMethodsPool.forEachByLayer(this, function (obj, methodName, partialMethodImpl) {
            // chain モードかつ resolveConflict が定義されている場合、特別な処理
            if (EMA && EMA.getConfig().proceedMode === 'chain') {
                const resolution = EMA.getConflictResolution(obj, methodName);
                
                if (resolution) {
                    // resolveConflict の順序で最初のアクティブな層を見つける
                    const firstActiveLayer = Layer._findFirstActiveLayer(resolution.layers);
                    
                    // 現在の層が最初のアクティブな層でない場合、インストールしない
                    if (firstActiveLayer !== currentOriginalLayer) {
                        return;  // スキップ
                    }
                    
                    // コールバックがある場合、カスタム動作をインストール
                    if (resolution.callback) {
                        obj[methodName] = Layer._createCallbackMethod(obj, methodName, resolution);
                        return;
                    }
                }
            }
            
            obj[methodName] = function () {
                let instance = this;  // Capture the actual instance
                
                // proceed の動作を設定に応じて切り替え
                Layer.proceed = function () {
                    return Layer._executeProceed(instance, obj, methodName, currentDeployedLayer, arguments);
                };

                let args = arguments;
                let result = function() {
                    let res = partialMethodImpl.apply(instance, args);  // Use instance, not prototype
                    return res;
                }();

                Layer.proceed = undefined;
                return result;
            };
        });
    };

    this._uninstallPartialMethods = function() {
        const currentOriginalLayer = this.__original__;
        
        PartialMethodsPool.forEachByLayer(this, function (obj, methodName) {
            // chain モードかつ resolveConflict が定義されている場合、特別な処理
            if (EMA && EMA.getConfig().proceedMode === 'chain') {
                const resolution = EMA.getConflictResolution(obj, methodName);
                
                if (resolution) {
                    // 次のアクティブな層を見つける（現在の層を除く）
                    const nextActiveLayer = Layer._findFirstActiveLayerExcluding(resolution.layers, currentOriginalLayer);
                    
                    if (nextActiveLayer) {
                        // 次の層のメソッドをインストール
                        const nextDeployedLayer = EMA.getLayers(l => l.__original__ === nextActiveLayer)[0];
                        if (nextDeployedLayer) {
                            nextDeployedLayer._installPartialMethod();
                        }
                        return;  // オリジナルに戻さない
                    }
                }
            }
            
            obj[methodName] = OriginalMethodsPool.get(obj, methodName);
        });
    };

    this.enableCondition = function() {
        let thiz = this;
        this._cond.on(function (active) {
            if (active !== thiz._active) {
                thiz._active = active;
                if (thiz._active) {
                    thiz._enter();
                    thiz._installPartialMethod();
                } else {
                    thiz._exit();
                    thiz._uninstallPartialMethods();
                }
            }
        });
    };

    this.addSignal = function(signal) {
        this._cond.addSignal(signal);
    };

    this.isActive = function() {
        return this._active;
    };

    this.enableCondition();
}

/**
 * EMA への参照を設定（循環参照を避けるため）
 */
Layer.setEMA = function(emaInstance) {
    EMA = emaInstance;
};

/**
 * resolveConflict の順序で最初のアクティブな層を見つける
 */
Layer._findFirstActiveLayer = function(layers) {
    if (!EMA) return null;
    
    for (const originalLayer of layers) {
        const deployedLayer = EMA.getLayers(l => l.__original__ === originalLayer)[0];
        if (deployedLayer && deployedLayer._active) {
            return originalLayer;
        }
    }
    return null;
};

/**
 * resolveConflict の順序で最初のアクティブな層を見つける（特定の層を除く）
 */
Layer._findFirstActiveLayerExcluding = function(layers, excludeLayer) {
    if (!EMA) return null;
    
    for (const originalLayer of layers) {
        if (originalLayer === excludeLayer) continue;
        
        const deployedLayer = EMA.getLayers(l => l.__original__ === originalLayer)[0];
        if (deployedLayer && deployedLayer._active) {
            return originalLayer;
        }
    }
    return null;
};

/**
 * コールバックを使ってカスタム動作のメソッドを作成
 * partialMethods は呼び出し時に動的に収集される
 */
Layer._createCallbackMethod = function(obj, methodName, resolution) {
    return function() {
        // 呼び出し時に動的に partialMethods を収集（アクティブな層のみ）
        const partialMethods = {};
        
        for (const originalLayer of resolution.layers) {
            const deployedLayer = EMA.getLayers(l => l.__original__ === originalLayer)[0];
            
            if (deployedLayer && deployedLayer._active) {
                const partialMethod = PartialMethodsPool.getPartialMethod(obj, methodName, originalLayer);
                if (partialMethod) {
                    const layerName = originalLayer.name || 'unnamed';
                    partialMethods[layerName] = partialMethod;
                }
            }
        }
        
        // オリジナルメソッドを取得
        const originalMethod = OriginalMethodsPool.get(obj, methodName);
        
        // コールバックを呼び出して新しいメソッドを取得
        const customMethod = resolution.callback(partialMethods, originalMethod);
        
        // 実行
        return customMethod.apply(this, arguments);
    };
};

/**
 * オリジナルメソッドを実行
 */
Layer._executeOriginalMethod = function(instance, methodName, args) {
    let originalMethod = OriginalMethodsPool.get(Object.getPrototypeOf(instance), methodName);
    if (originalMethod === undefined) throw "No original method found";

    return originalMethod.apply(instance, args);
};

/**
 * proceed の実行（設定に応じて動作を切り替え）
 */
Layer._executeProceed = function(instance, obj, methodName, currentDeployedLayer, args) {
    // EMA が設定されていない、または 'original' モードの場合は従来通り
    if (!EMA || EMA.getConfig().proceedMode === 'original') {
        return Layer._executeOriginalMethod(instance, methodName, args);
    }
    
    // 'chain' モードの場合
    const resolution = EMA.getConflictResolution(obj, methodName);
    
    if (!resolution) {
        // コンフリクト解決が定義されていない場合はオリジナルへ
        return Layer._executeOriginalMethod(instance, methodName, args);
    }
    
    // 現在の層の位置を見つける
    const currentOriginalLayer = currentDeployedLayer.__original__;
    const layerIndex = resolution.layers.indexOf(currentOriginalLayer);
    
    if (layerIndex === -1) {
        // 現在の層がリストにない場合はオリジナルへ
        return Layer._executeOriginalMethod(instance, methodName, args);
    }
    
    // 次の層を探す（アクティブな層のみ）
    for (let i = layerIndex + 1; i < resolution.layers.length; i++) {
        const nextOriginalLayer = resolution.layers[i];
        const nextDeployedLayer = EMA.getLayers(l => l.__original__ === nextOriginalLayer)[0];
        
        if (nextDeployedLayer && nextDeployedLayer._active) {
            // 次の層の部分メソッドを取得して実行
            const nextPartialMethod = PartialMethodsPool.getPartialMethod(obj, methodName, nextOriginalLayer);
            
            if (nextPartialMethod) {
                // proceed を次の層用に再設定
                const savedProceed = Layer.proceed;
                Layer.proceed = function() {
                    return Layer._executeProceed(instance, obj, methodName, nextDeployedLayer, arguments);
                };
                
                const result = nextPartialMethod.apply(instance, args);
                
                Layer.proceed = savedProceed;
                return result;
            }
        }
    }
    
    // 次の層がない場合はオリジナルへ
    return Layer._executeOriginalMethod(instance, methodName, args);
};

export default Layer;
