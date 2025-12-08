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

// @ts-ignore - JavaScript modules
import PartialMethodsPool from '../ema/PartialMethodsPool.js';
// @ts-ignore - JavaScript modules
import OriginalMethodsPool from '../ema/OriginalMethodsPool.js';

/**
 * 指定した層に関連する部分メソッドを取得
 */
function getPartialMethodsForLayers(targetLayers: any[]): Array<{
    obj: any;
    methodName: string;
    impl: Function;
    layer: any;
}> {
    const result: Array<{ obj: any; methodName: string; impl: Function; layer: any }> = [];

    (PartialMethodsPool._partialMethods || []).forEach((pm: any[]) => {
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
function getAllPartialMethodNames(): Map<any, Set<string>> {
    const methodsByObj = new Map<any, Set<string>>();

    (PartialMethodsPool._partialMethods || []).forEach((pm: any[]) => {
        const [obj, methodName] = pm;
        if (!methodsByObj.has(obj)) {
            methodsByObj.set(obj, new Set());
        }
        methodsByObj.get(obj)!.add(methodName);
    });

    return methodsByObj;
}

/**
 * 部分メソッドのテスト用関数
 * 
 * @param name テスト名
 * @param targetLayers テストで有効にする層の配列（空配列でベースメソッドのみ）
 * @param testFunction テスト関数
 */
export function testPartial(
    name: string,
    targetLayers: any[],
    testFunction: () => void | Promise<void>
): void {
    test(name, async () => {
        // 1. 現在のメソッドを保存
        const savedMethods = new Map<any, Map<string, Function>>();
        const methodsByObj = getAllPartialMethodNames();

        methodsByObj.forEach((methodNames, obj) => {
            const methods = new Map<string, Function>();
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
                obj[methodName] = function(this: any, ...args: any[]) {
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
testPartial.base = function(
    name: string,
    testFunction: () => void | Promise<void>
): void {
    testPartial(name, [], testFunction);
};

export default testPartial;
