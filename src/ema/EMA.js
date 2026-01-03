import Layer from './Layer.js';
import PartialMethodsPool from './PartialMethodsPool.js';
import OriginalMethodsPool from './OriginalMethodsPool.js';

class EMA {

    constructor() {
        if (!EMA.instance) {
            EMA.instance = this;
            this.init();
        }
        return EMA.instance;
    }

    init() {
        this._deployedLayers = [];
        this._signalInterfacePool = [];
        this._config = {
            proceedMode: 'original'  // 'original' or 'chain'
        };
        this._conflictResolutions = [];  // { obj, methodName, layers[] }
    }

    /**
     * EMA の設定を変更
     * @param {Object} options - 設定オプション
     * @param {string} options.proceedMode - 'original' (デフォルト) or 'chain'
     */
    config(options) {
        if (options.proceedMode !== undefined) {
            if (options.proceedMode !== 'original' && options.proceedMode !== 'chain') {
                throw new Error("proceedMode must be 'original' or 'chain'");
            }
            this._config.proceedMode = options.proceedMode;
        }
        return this._config;
    }

    /**
     * 現在の設定を取得
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * コンフリクト解決を登録
     * @param {Object} obj - 対象オブジェクト（通常は prototype）
     * @param {string} methodName - メソッド名
     * @param {Array} layers - 層の優先順位（左が優先）
     * @param {Function} [callback] - カスタム動作を定義するコールバック
     *   callback(partialMethods: Object, originalMethod: Function) => Function
     *   - partialMethods: { layerName: method } の形式で各層の部分メソッド
     *   - originalMethod: オリジナルメソッド
     *   - 戻り値: 新しい動作を定義した関数
     */
    resolveConflict(obj, methodName, layers, callback) {
        // 既存の解決があれば更新
        const existing = this._conflictResolutions.find(
            r => r.obj === obj && r.methodName === methodName
        );
        
        if (existing) {
            existing.layers = layers;
            existing.callback = callback || null;
        } else {
            this._conflictResolutions.push({ 
                obj, 
                methodName, 
                layers,
                callback: callback || null
            });
        }
    }

    /**
     * コンフリクト解決を取得
     */
    getConflictResolution(obj, methodName) {
        return this._conflictResolutions.find(
            r => r.obj === obj && r.methodName === methodName
        );
    }

    /**
     * コンフリクト解決をクリア
     */
    clearConflictResolutions() {
        this._conflictResolutions = [];
    }

    deploy(originalLayer) {
        let layer = new Layer(originalLayer);
        layer._name = layer._name !== "_" ? layer._name : "Layer_" + (this._deployedLayers.length + 1);

        this._deployedLayers.push(layer);
        this._receiveSignalsForSignalInterfaces(layer);
    }

    undeploy(originalLayer) {
        this._deployedLayers = this._deployedLayers.filter(function (layer) {
            if (layer.__original__ === originalLayer) {
                layer.cleanCondition();
                layer._uninstallPartialMethods();
                return false;
            }
            return true;
        });
    }

    exhibit(object, signalInterface) {
        this._signalInterfacePool.push([object, signalInterface]);
        this._addIdSignal(signalInterface);
        this._exhibitAnInterface(signalInterface);
    }

    addPartialMethod(originalLayer, objs, methodName, partialMethodImpl) {
        objs = Array.isArray(objs)? objs: [objs];
        objs.forEach(obj => {
            OriginalMethodsPool.add(obj, methodName);
            PartialMethodsPool.add(obj, methodName, partialMethodImpl, originalLayer);
        });
    }

    _receiveSignalsForSignalInterfaces(deployedLayer) {
        this._signalInterfacePool.forEach(function (si) {
            for (let field in si[1]) {
                if (si[1].hasOwnProperty(field)) {
                    deployedLayer.addSignal(si[1][field]);
                }
            }
        });
    }

    _addIdSignal(signalInterface) {
        for (let field in signalInterface) {
            if (signalInterface.hasOwnProperty(field)) {
                signalInterface[field].id = field;
            }
        }
    }

    _exhibitAnInterface(signalInterface) {
        for (let field in signalInterface) {
            if (signalInterface.hasOwnProperty(field)) {
                this._deployedLayers.forEach(function (layer) {
                    layer.addSignal(signalInterface[field]);
                });
            }
        }
    }

    getLayers(filter) {
        filter = filter || function () {
            return true;
        };
        return this._deployedLayers.filter(filter);
    }

    getActiveLayers() {
        return this.getLayers(function (layer) {
            return layer.isActive()
        })
    };

    activate(originalLayer) {
        this.getLayers(function (layer) {
            if(layer._name === originalLayer.name) {
                layer._active = true;
                layer._enter();
                layer._installPartialMethod();
            }
        });
    }

    deactivate(originalLayer) {
        this.getLayers(function (layer) {
            if (layer._name === originalLayer.name) {
                layer._active = false;
                layer._exit();
                layer.cleanCondition();
                layer._uninstallPartialMethods();
            }
        });
    }

    getInactiveLayers() {
        return this.getLayers(function (layer) {
            return !layer.isActive()
        })
    };
}

const emaInstance = new EMA();

// Layer に EMA への参照を設定（循環参照を避けるため）
Layer.setEMA(emaInstance);

export default emaInstance;
