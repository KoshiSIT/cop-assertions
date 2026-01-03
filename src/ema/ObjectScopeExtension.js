/**
 * EMA オブジェクトスコープ拡張モジュール
 * 
 * 既存の EMA を変更せず、オブジェクトスコープ機能を後付けで追加する。
 * 
 * @example
 * import { installObjectScopeExtension } from './ObjectScopeExtension.js';
 * installObjectScopeExtension();
 * 
 * // 特定オブジェクトに対してのみ層を活性化
 * EMA.activateFor(NightLayer, screen1);
 * EMA.isActiveFor(NightLayer, screen1);  // true
 * EMA.isActiveFor(NightLayer, screen2);  // false
 * 
 * // 非活性化
 * EMA.deactivateFor(NightLayer, screen1);
 */

import EMA from './EMA.js';
import PartialMethodsPool from './PartialMethodsPool.js';
import Layer from './Layer.js';

let installed = false;

/**
 * オブジェクトスコープ拡張をインストール
 */
export function installObjectScopeExtension() {
    if (installed) {
        return; // 二重インストール防止
    }
    
    // ========================================
    // 1. PartialMethodsPool を拡張
    // ========================================
    
    /**
     * 指定した層がオブジェクトのプロトタイプに部分メソッドを持っているか確認
     */
    PartialMethodsPool.hasPartialMethodsFor = function(originalLayer, prototype) {
        return this._partialMethods.some(pm => 
            pm[0] === prototype && pm[3] === originalLayer
        );
    };
    
    /**
     * 指定した層とプロトタイプに対する全ての部分メソッドを取得
     */
    PartialMethodsPool.getPartialMethodsFor = function(originalLayer, prototype) {
        return this._partialMethods
            .filter(pm => pm[0] === prototype && pm[3] === originalLayer)
            .map(pm => [pm[1], pm[2]]);  // [methodName, partialMethodImpl]
    };
    
    // ========================================
    // 2. EMA に新メソッドを追加
    // ========================================
    
    // オブジェクトスコープ活性化を追跡する WeakMap
    // key: target object
    // value: Map<methodName, Array<{layer, layerName, partialMethodImpl, originalMethod}>> (スタック)
    const objectScopeStacks = new WeakMap();
    
    /**
     * スタックの先頭の層のメソッドをインストール
     */
    function installTopLayerMethod(target, methodName, stack) {
        if (stack.length === 0) {
            // スタックが空なら削除（prototype のメソッドが見える）
            delete target[methodName];
            return;
        }
        
        const topEntry = stack[stack.length - 1];
        const { layer, partialMethodImpl, originalMethod } = topEntry;
        
        target[methodName] = createObjectScopeMethod(
            target, methodName, partialMethodImpl, originalMethod, layer
        );
        target[methodName].__layer__ = layer;
        target[methodName].__objectScope__ = true;
    }
    
    /**
     * オブジェクトスコープ用のメソッドラッパーを作成
     */
    function createObjectScopeMethod(target, methodName, partialMethodImpl, originalMethod, originalLayer) {
        return function(...args) {
            // proceed を設定
            const savedProceed = Layer.proceed;
            Layer.proceed = function() {
                return originalMethod.apply(target, arguments);
            };
            
            const result = partialMethodImpl.apply(this, args);
            
            Layer.proceed = savedProceed;
            return result;
        };
    }
    
    /**
     * 特定のオブジェクトに対してのみ層を活性化
     * 
     * @param {object} layer - 活性化する層
     * @param {object|object[]} targets - 対象オブジェクト（単一または配列）
     * @throws {TypeError} targets がオブジェクトでない場合
     * @throws {Error} 層が対象オブジェクトに部分メソッドを持っていない場合
     */
    EMA.activateFor = function(layer, targets) {
        const targetArray = Array.isArray(targets) ? targets : [targets];
        
        // バリデーション
        for (const target of targetArray) {
            if (typeof target !== 'object' || target === null) {
                throw new TypeError(
                    `EMA.activateFor: 'targets' must be object(s), got ${target === null ? 'null' : typeof target}`
                );
            }
            
            const prototype = Object.getPrototypeOf(target);
            if (!PartialMethodsPool.hasPartialMethodsFor(layer, prototype)) {
                const className = target.constructor?.name || 'Object';
                throw new Error(
                    `EMA.activateFor: Layer '${layer.name}' has no partial methods for ${className}. ` +
                    `Use EMA.addPartialMethod() to define partial methods first.`
                );
            }
        }
        
        // デプロイされた層を取得
        let deployedLayer = null;
        this.getLayers(function(l) {
            if (l._name === layer.name) {
                deployedLayer = l;
            }
        });
        
        if (!deployedLayer) {
            throw new Error(
                `EMA.activateFor: Layer '${layer.name}' is not deployed. ` +
                `Use EMA.deploy() first.`
            );
        }
        
        // 各ターゲットに部分メソッドをインストール
        for (const target of targetArray) {
            const prototype = Object.getPrototypeOf(target);
            const partialMethods = PartialMethodsPool.getPartialMethodsFor(layer, prototype);
            
            // スタックを初期化
            if (!objectScopeStacks.has(target)) {
                objectScopeStacks.set(target, new Map());
            }
            const methodStacks = objectScopeStacks.get(target);
            
            for (const [methodName, partialMethodImpl] of partialMethods) {
                // 元のメソッドを保存（prototype から取得）
                const originalMethod = prototype[methodName];
                
                // メソッドごとのスタックを初期化
                if (!methodStacks.has(methodName)) {
                    methodStacks.set(methodName, []);
                }
                const stack = methodStacks.get(methodName);
                
                // 既に同じ層が活性化されていたらスキップ
                if (stack.some(entry => entry.layerName === layer.name)) {
                    continue;
                }
                
                // スタックに追加
                stack.push({
                    layer: layer,
                    layerName: layer.name,
                    partialMethodImpl: partialMethodImpl,
                    originalMethod: originalMethod
                });
                
                // インスタンスに直接部分メソッドをインストール（スタックの先頭）
                installTopLayerMethod(target, methodName, stack);
            }
        }
    };
    
    /**
     * 特定のオブジェクトに対する層の活性化を解除
     * @param {object} layer - 非活性化する層
     * @param {object|object[]} targets - 対象オブジェクト（単一または配列）
     */
    EMA.deactivateFor = function(layer, targets) {
        const targetArray = Array.isArray(targets) ? targets : [targets];
        
        for (const target of targetArray) {
            if (!objectScopeStacks.has(target)) {
                continue;
            }
            
            const methodStacks = objectScopeStacks.get(target);
            
            // 各メソッドのスタックから該当層を除去
            for (const [methodName, stack] of methodStacks.entries()) {
                const index = stack.findIndex(entry => entry.layerName === layer.name);
                
                if (index !== -1) {
                    stack.splice(index, 1);
                    
                    // スタックの先頭を再インストール
                    installTopLayerMethod(target, methodName, stack);
                    
                    // スタックが空なら削除
                    if (stack.length === 0) {
                        methodStacks.delete(methodName);
                    }
                }
            }
            
            // 全メソッドのスタックが空なら削除
            if (methodStacks.size === 0) {
                objectScopeStacks.delete(target);
            }
        }
    };
    
    /**
     * 層が特定のオブジェクトに対して活性化されているか確認
     * @param {object} layer - 確認する層
     * @param {object} obj - 対象オブジェクト
     * @returns {boolean}
     */
    EMA.isActiveFor = function(layer, obj) {
        if (!objectScopeStacks.has(obj)) {
            return false;
        }
        
        const methodStacks = objectScopeStacks.get(obj);
        
        // いずれかのメソッドスタックに該当層があれば true
        for (const stack of methodStacks.values()) {
            if (stack.some(entry => entry.layerName === layer.name)) {
                return true;
            }
        }
        
        return false;
    };
    
    installed = true;
}

/**
 * オブジェクトスコープ拡張をアンインストール
 * （主にテスト用）
 */
export function uninstallObjectScopeExtension() {
    if (!installed) {
        return;
    }
    
    // PartialMethodsPool から追加メソッドを削除
    delete PartialMethodsPool.hasPartialMethodsFor;
    delete PartialMethodsPool.getPartialMethodsFor;
    
    // EMA から追加メソッドを削除
    delete EMA.activateFor;
    delete EMA.deactivateFor;
    delete EMA.isActiveFor;
    
    installed = false;
}

/**
 * 拡張がインストール済みか確認
 */
export function isObjectScopeExtensionInstalled() {
    return installed;
}

export default installObjectScopeExtension;
