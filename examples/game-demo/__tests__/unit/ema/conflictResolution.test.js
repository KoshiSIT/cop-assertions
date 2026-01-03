/**
 * EMA.js のコンフリクト解決とチェーンモードのテスト
 */
import { EMA } from '../../../../../dist/ema/index.js';
import Layer from '../../../../../dist/ema/Layer.js';

describe('EMA.config - proceedMode', () => {
    
    beforeEach(() => {
        // 設定をリセット
        EMA.config({ proceedMode: 'original' });
        EMA.clearConflictResolutions();
    });
    
    test('デフォルトは original モード', () => {
        expect(EMA.getConfig().proceedMode).toBe('original');
    });
    
    test('chain モードに変更できる', () => {
        EMA.config({ proceedMode: 'chain' });
        expect(EMA.getConfig().proceedMode).toBe('chain');
    });
    
    test('不正な値はエラー', () => {
        expect(() => {
            EMA.config({ proceedMode: 'invalid' });
        }).toThrow("proceedMode must be 'original' or 'chain'");
    });
});

describe('EMA.resolveConflict', () => {
    
    beforeEach(() => {
        EMA.clearConflictResolutions();
    });
    
    test('コンフリクト解決を登録できる', () => {
        const obj = {};
        const LayerA = { name: 'LayerA' };
        const LayerB = { name: 'LayerB' };
        
        EMA.resolveConflict(obj, 'method', [LayerA, LayerB]);
        
        const resolution = EMA.getConflictResolution(obj, 'method');
        expect(resolution).toBeDefined();
        expect(resolution.layers).toEqual([LayerA, LayerB]);
    });
    
    test('既存の解決は更新される', () => {
        const obj = {};
        const LayerA = { name: 'LayerA' };
        const LayerB = { name: 'LayerB' };
        const LayerC = { name: 'LayerC' };
        
        EMA.resolveConflict(obj, 'method', [LayerA, LayerB]);
        EMA.resolveConflict(obj, 'method', [LayerC, LayerA]);
        
        const resolution = EMA.getConflictResolution(obj, 'method');
        expect(resolution.layers).toEqual([LayerC, LayerA]);
    });
});

describe('proceed チェーンモード', () => {
    
    let callOrder;
    let TestClass;
    let LayerA;
    let LayerB;
    let LayerC;
    
    beforeEach(() => {
        callOrder = [];
        
        // テスト用のクラス
        TestClass = function() {};
        TestClass.prototype.action = function() {
            callOrder.push('original');
            return 'original';
        };
        
        // 層を定義
        LayerA = { name: 'LayerA' };
        LayerB = { name: 'LayerB' };
        LayerC = { name: 'LayerC' };
        
        // 部分メソッドを登録
        EMA.addPartialMethod(LayerA, TestClass.prototype, 'action', function() {
            callOrder.push('LayerA');
            return 'A:' + Layer.proceed();
        });
        
        EMA.addPartialMethod(LayerB, TestClass.prototype, 'action', function() {
            callOrder.push('LayerB');
            return 'B:' + Layer.proceed();
        });
        
        EMA.addPartialMethod(LayerC, TestClass.prototype, 'action', function() {
            callOrder.push('LayerC');
            return 'C:' + Layer.proceed();
        });
        
        // 層をデプロイ
        EMA.deploy(LayerA);
        EMA.deploy(LayerB);
        EMA.deploy(LayerC);
        
        // 設定をリセット
        EMA.config({ proceedMode: 'original' });
        EMA.clearConflictResolutions();
    });
    
    afterEach(() => {
        EMA.deactivate(LayerA);
        EMA.deactivate(LayerB);
        EMA.deactivate(LayerC);
        EMA.undeploy(LayerA);
        EMA.undeploy(LayerB);
        EMA.undeploy(LayerC);
    });
    
    test('original モード: proceed() はオリジナルへ直接', () => {
        EMA.config({ proceedMode: 'original' });
        EMA.activate(LayerA);
        EMA.activate(LayerB);
        
        const instance = new TestClass();
        const result = instance.action();
        
        // 最後にアクティブ化された LayerB のみ実行
        // proceed() は直接オリジナルへ
        expect(callOrder).toEqual(['LayerB', 'original']);
        expect(result).toBe('B:original');
    });
    
    test('chain モード（resolveConflict なし）: proceed() はオリジナルへ', () => {
        EMA.config({ proceedMode: 'chain' });
        // resolveConflict を呼ばない
        
        EMA.activate(LayerA);
        EMA.activate(LayerB);
        
        const instance = new TestClass();
        const result = instance.action();
        
        // resolveConflict がないので、original モードと同じ動作
        expect(callOrder).toEqual(['LayerB', 'original']);
        expect(result).toBe('B:original');
    });
    
    test('chain モード + resolveConflict: proceed() は次の層へ', () => {
        EMA.config({ proceedMode: 'chain' });
        EMA.resolveConflict(TestClass.prototype, 'action', [LayerA, LayerB, LayerC]);
        
        EMA.activate(LayerA);
        EMA.activate(LayerB);
        EMA.activate(LayerC);
        
        const instance = new TestClass();
        const result = instance.action();
        
        // LayerC → LayerB → LayerA → original の順で呼ばれる
        // (最後にインストールされた LayerC から開始)
        expect(callOrder).toContain('original');
    });
    
    test('chain モード: 一部の層だけアクティブ', () => {
        EMA.config({ proceedMode: 'chain' });
        EMA.resolveConflict(TestClass.prototype, 'action', [LayerA, LayerB, LayerC]);
        
        EMA.activate(LayerA);
        // LayerB は非アクティブ
        EMA.activate(LayerC);
        
        const instance = new TestClass();
        callOrder = [];
        const result = instance.action();
        
        // LayerC → LayerA → original（LayerB はスキップ）
        expect(callOrder).toContain('LayerC');
        expect(callOrder).toContain('LayerA');
        expect(callOrder).toContain('original');
        expect(callOrder).not.toContain('LayerB');
    });
});

describe('resolveConflict コールバック（カスタム動作）', () => {
    
    let callOrder;
    let TestClass;
    let LayerA;
    let LayerB;
    
    beforeEach(() => {
        callOrder = [];
        
        TestClass = function() {};
        TestClass.prototype.calculate = function(x) {
            callOrder.push('original');
            return x;
        };
        
        LayerA = { name: 'LayerA' };
        LayerB = { name: 'LayerB' };
        
        EMA.addPartialMethod(LayerA, TestClass.prototype, 'calculate', function(x) {
            callOrder.push('LayerA');
            return x * 2;
        });
        
        EMA.addPartialMethod(LayerB, TestClass.prototype, 'calculate', function(x) {
            callOrder.push('LayerB');
            return x + 10;
        });
        
        EMA.deploy(LayerA);
        EMA.deploy(LayerB);
        
        EMA.config({ proceedMode: 'chain' });
    });
    
    afterEach(() => {
        EMA.deactivate(LayerA);
        EMA.deactivate(LayerB);
        EMA.undeploy(LayerA);
        EMA.undeploy(LayerB);
        EMA.config({ proceedMode: 'original' });
        EMA.clearConflictResolutions();
    });
    
    test('コールバックで完全に新しい動作を定義', () => {
        EMA.resolveConflict(TestClass.prototype, 'calculate', [LayerA, LayerB], 
            function(partialMethods, originalMethod) {
                return function(x) {
                    callOrder.push('custom');
                    // LayerA の結果と LayerB の結果を合計
                    const a = partialMethods['LayerA'].call(this, x);
                    const b = partialMethods['LayerB'].call(this, x);
                    return a + b;
                };
            }
        );
        
        EMA.activate(LayerA);
        EMA.activate(LayerB);
        
        const instance = new TestClass();
        const result = instance.calculate(5);
        
        expect(callOrder).toContain('custom');
        expect(callOrder).toContain('LayerA');
        expect(callOrder).toContain('LayerB');
        // 5 * 2 + (5 + 10) = 10 + 15 = 25
        expect(result).toBe(25);
    });
    
    test('コールバックでオリジナルメソッドも使える', () => {
        EMA.resolveConflict(TestClass.prototype, 'calculate', [LayerA, LayerB], 
            function(partialMethods, originalMethod) {
                return function(x) {
                    callOrder.push('custom');
                    // オリジナルに LayerA の結果を足す
                    const orig = originalMethod.call(this, x);
                    const a = partialMethods['LayerA'].call(this, x);
                    return orig + a;
                };
            }
        );
        
        EMA.activate(LayerA);
        EMA.activate(LayerB);
        
        const instance = new TestClass();
        const result = instance.calculate(5);
        
        expect(callOrder).toContain('original');
        expect(callOrder).toContain('LayerA');
        // 5 + (5 * 2) = 5 + 10 = 15
        expect(result).toBe(15);
    });
    
    test('コールバックで条件分岐', () => {
        EMA.resolveConflict(TestClass.prototype, 'calculate', [LayerA, LayerB], 
            function(partialMethods, originalMethod) {
                return function(x) {
                    callOrder.push('custom');
                    // 値が大きければ LayerA、小さければ LayerB
                    if (x > 10) {
                        return partialMethods['LayerA'].call(this, x);
                    } else {
                        return partialMethods['LayerB'].call(this, x);
                    }
                };
            }
        );
        
        EMA.activate(LayerA);
        EMA.activate(LayerB);
        
        const instance = new TestClass();
        
        // x = 5 (小さい) → LayerB: 5 + 10 = 15
        callOrder = [];
        expect(instance.calculate(5)).toBe(15);
        expect(callOrder).toContain('LayerB');
        expect(callOrder).not.toContain('LayerA');
        
        // x = 20 (大きい) → LayerA: 20 * 2 = 40
        callOrder = [];
        expect(instance.calculate(20)).toBe(40);
        expect(callOrder).toContain('LayerA');
        expect(callOrder).not.toContain('LayerB');
    });
    
    test('アクティブな層のみがpartialMethodsに含まれる', () => {
        let capturedMethods = null;
        
        EMA.resolveConflict(TestClass.prototype, 'calculate', [LayerA, LayerB], 
            function(partialMethods, originalMethod) {
                capturedMethods = partialMethods;
                return function(x) {
                    return originalMethod.call(this, x);
                };
            }
        );
        
        // LayerA のみアクティブ
        EMA.activate(LayerA);
        
        const instance = new TestClass();
        instance.calculate(5);
        
        expect(capturedMethods).toHaveProperty('LayerA');
        expect(capturedMethods).not.toHaveProperty('LayerB');
    });
});

describe('proceed チェーンの順序', () => {
    
    let callOrder;
    let TestClass;
    let Layer1;
    let Layer2;
    
    beforeEach(() => {
        callOrder = [];
        
        TestClass = function() {};
        TestClass.prototype.greet = function() {
            callOrder.push('original');
            return 'Hello';
        };
        
        Layer1 = { name: 'Layer1' };
        Layer2 = { name: 'Layer2' };
        
        EMA.addPartialMethod(Layer1, TestClass.prototype, 'greet', function() {
            callOrder.push('Layer1-before');
            const result = Layer.proceed();
            callOrder.push('Layer1-after');
            return result + ' from Layer1';
        });
        
        EMA.addPartialMethod(Layer2, TestClass.prototype, 'greet', function() {
            callOrder.push('Layer2-before');
            const result = Layer.proceed();
            callOrder.push('Layer2-after');
            return result + ' from Layer2';
        });
        
        EMA.deploy(Layer1);
        EMA.deploy(Layer2);
        
        EMA.config({ proceedMode: 'chain' });
        EMA.resolveConflict(TestClass.prototype, 'greet', [Layer2, Layer1]);
    });
    
    afterEach(() => {
        EMA.deactivate(Layer1);
        EMA.deactivate(Layer2);
        EMA.undeploy(Layer1);
        EMA.undeploy(Layer2);
        EMA.config({ proceedMode: 'original' });
        EMA.clearConflictResolutions();
    });
    
    test('チェーンの before/after 順序', () => {
        EMA.activate(Layer1);
        EMA.activate(Layer2);
        
        const instance = new TestClass();
        const result = instance.greet();
        
        // Layer2 が先に呼ばれ、Layer1 へ proceed し、最後に original
        // 戻り値は逆順で構築される
        expect(result).toContain('Hello');
    });
});
