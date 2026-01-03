class PartialMethodsPool {

    constructor() {
        if (!PartialMethodsPool.instance) {
            PartialMethodsPool.instance = this;
            this.init();
        }
        return PartialMethodsPool.instance;
    }

    init() {
        this._partialMethods = [];
    }

    add(obj, methodName, partialMethodImpl, originalLayer) {
        this._partialMethods.push([obj, methodName, partialMethodImpl, originalLayer]);
    }

    _get(deployedLayer) {
        return this._partialMethods.filter(function (partialMethod) {
            let originalLayer = partialMethod[3];
            return deployedLayer.__original__ === originalLayer;
        });
    }

    /**
     * 特定のオブジェクト、メソッド、層に対する部分メソッドを取得
     */
    getPartialMethod(obj, methodName, originalLayer) {
        const found = this._partialMethods.find(function (pm) {
            return pm[0] === obj && pm[1] === methodName && pm[3] === originalLayer;
        });
        return found ? found[2] : null;
    }

    forEachByLayer(deployedLayer, fun) {
        let partialMethods = this._get(deployedLayer);

        partialMethods.forEach(function (pm) {
            let obj = pm[0];
            let methodName = pm[1];
            let partialMethodImpl = pm[2];
            let originalLayer = pm[3];

            fun(obj, methodName, partialMethodImpl, originalLayer);
        });
    }
}

export default new PartialMethodsPool();
