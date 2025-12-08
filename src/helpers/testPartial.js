/**
 * testPartial - 部分メソッドのテスト用ヘルパー
 * 
 * 指定した層の部分メソッドだけをスコープ内で有効にし、
 * 他の層や暗黙的活性化の影響を受けずにテストできる。
 * 
 * @example
 * testPartial('HardModeLayerのgetEnemyHPは3を返す', [HardModeLayer], () => {
 *     const enemy = new Enemy(mockCanvas);
 *     expect(enemy.getEnemyHP()).toBe(3);
 * });
 * 
 * testPartial.base('ベースメソッドのgetEnemyHPは1を返す', () => {
 *     const enemy = new Enemy(mockCanvas);
 *     expect(enemy.getEnemyHP()).toBe(1);
 * });
 */

import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import OriginalMethodsPool from '../ema/OriginalMethodsPool.js';

/**
 * 指定した層に関連する部分メソッドを取得
 */
function getPartialMethodsForLayers(targetLayers) {
    const result = [];

    PartialMethodsPool._partialMethods.forEach((pm) => {
        const [obj, methodName, impl, layer] = pm;
        if (targetLayers.includes(layer)) {
            result.push({ obj, methodName, impl, layer });
        }
    });

    return result;
}

/**
 * 全ての部分メソッドが定義されているメソッド名を取得（オブジェクトごと）
 */
function getAllPartialMethodNames() {
    const methodsByObj = new Map();

    PartialMethodsPool._partialMethods.forEach((pm) => {
        const [obj, methodName] = pm;
        if (!methodsByObj.has(obj)) {
            methodsByObj.set(obj, new Set());
        }
        methodsByObj.get(obj).add(methodName);
    });

    return methodsByObj;
}

/**
 * 部分メソッドのテスト用関数
 * 
 * @param {string} name テスト名
 * @param {Array} targetLayers テストで有効にする層の配列（空配列でベースメソッドのみ）
 * @param {Function} testFunction テスト関数
 */
export function testPartial(name, targetLayers, testFunction) {
    test(name, async () => {
        // 1. 現在のメソッドを保存
        const savedMethods = new Map();
        const methodsByObj = getAllPartialMethodNames();

        methodsByObj.forEach((methodNames, obj) => {
            const methods = new Map();
            methodNames.forEach((methodName) => {
                methods.set(methodName, obj[methodName]);
            });
            savedMethods.set(obj, methods);
        });

        try {
            // 2. 全てのメソッドをベースに戻す
            methodsByObj.forEach((methodNames, obj) => {
                methodNames.forEach((methodName) => {
                    const originalMethod = OriginalMethodsPool.get(obj, methodName);
                    if (originalMethod) {
                        obj[methodName] = originalMethod;
                    }
                });
            });

            // 3. 指定した層の部分メソッドだけ適用
            const partialMethods = getPartialMethodsForLayers(targetLayers);
            partialMethods.forEach(({ obj, methodName, impl }) => {
                obj[methodName] = function(...args) {
                    return impl.apply(this, args);
                };
            });

            // 4. テスト実行
            await testFunction();

        } finally {
            // 5. 元に戻す
            savedMethods.forEach((methods, obj) => {
                methods.forEach((method, methodName) => {
                    obj[methodName] = method;
                });
            });
        }
    });
}

/**
 * ベースメソッドのテスト用ショートカット
 */
testPartial.base = function(name, testFunction) {
    testPartial(name, [], testFunction);
};

export default testPartial;
