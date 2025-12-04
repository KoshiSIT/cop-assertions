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

export default new EMA();
