/**
 * toExecuteInOrder マッチャーのテスト
 * 
 * proceed チェーンによる層の実行順序を検証する
 */

import { describeCop, toExecuteInOrder } from '../../../../../dist/helpers/describeCop.js';
import EMA from '../../../../../dist/ema/EMA.js';
import Layer from '../../../../../dist/ema/Layer.js';

expect.extend({ toExecuteInOrder });

// テスト用の層を定義
const ChainLayerA = { name: 'ChainLayerA' };
const ChainLayerB = { name: 'ChainLayerB' };
const ChainLayerC = { name: 'ChainLayerC' };

// テスト用クラス
class ChainTestClass {
    constructor() {
        this.value = 100;
        this.callLog = [];
    }
    
    process(amount) {
        this.callLog.push('Original');
        return this.value + amount;
    }
}

// 層ごとの部分メソッドを定義
beforeAll(() => {
    // ChainLayerA の部分メソッド
    EMA.addPartialMethod(ChainLayerA, ChainTestClass.prototype, 'process', function(amount) {
        this.callLog.push('ChainLayerA');
        return Layer.proceed.call(this, amount) * 2;  // 次の層へ
    });
    
    // ChainLayerB の部分メソッド
    EMA.addPartialMethod(ChainLayerB, ChainTestClass.prototype, 'process', function(amount) {
        this.callLog.push('ChainLayerB');
        return Layer.proceed.call(this, amount) + 10;  // 次の層へ
    });
    
    // ChainLayerC の部分メソッド
    EMA.addPartialMethod(ChainLayerC, ChainTestClass.prototype, 'process', function(amount) {
        this.callLog.push('ChainLayerC');
        return Layer.proceed.call(this, amount) - 5;  // 次の層へ
    });
    
    // 層をデプロイ
    EMA.deploy(ChainLayerA);
    EMA.deploy(ChainLayerB);
    EMA.deploy(ChainLayerC);
});

afterAll(() => {
    EMA.undeploy(ChainLayerA);
    EMA.undeploy(ChainLayerB);
    EMA.undeploy(ChainLayerC);
});

describeCop('toExecuteInOrder - proceed チェーンの順序検証', () => {
    use.layer([ChainLayerA, ChainLayerB, ChainLayerC]);
    
    describe('2つの層のチェーン', () => {
        test('A → B の順序で実行される', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB]);
            
            const obj = new ChainTestClass();
            
            EMA.activate(ChainLayerA);
            EMA.activate(ChainLayerB);
            
            obj.process(5);
            
            expect(obj.process).toExecuteInOrder([ChainLayerA, ChainLayerB]);
            
            EMA.deactivate(ChainLayerA);
            EMA.deactivate(ChainLayerB);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
        
        test('B → A の順序で実行される（逆順）', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerB, ChainLayerA]);
            
            const obj = new ChainTestClass();
            
            EMA.activate(ChainLayerA);
            EMA.activate(ChainLayerB);
            
            obj.process(5);
            
            expect(obj.process).toExecuteInOrder([ChainLayerB, ChainLayerA]);
            
            EMA.deactivate(ChainLayerA);
            EMA.deactivate(ChainLayerB);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
    });
    
    describe('3つの層のチェーン', () => {
        test('A → B → C の順序で実行される', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB, ChainLayerC]);
            
            const obj = new ChainTestClass();
            
            EMA.activate(ChainLayerA);
            EMA.activate(ChainLayerB);
            EMA.activate(ChainLayerC);
            
            obj.process(5);
            
            expect(obj.process).toExecuteInOrder([ChainLayerA, ChainLayerB, ChainLayerC]);
            
            EMA.deactivate(ChainLayerA);
            EMA.deactivate(ChainLayerB);
            EMA.deactivate(ChainLayerC);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
    });
    
    describe('片方のみアクティブ', () => {
        test('B のみアクティブなら [B] のみ', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB]);
            
            const obj = new ChainTestClass();
            
            // A は非アクティブ
            EMA.activate(ChainLayerB);
            
            obj.process(5);
            
            expect(obj.process).toExecuteInOrder([ChainLayerB]);
            
            EMA.deactivate(ChainLayerB);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
    });
    
    describe('.not の使用', () => {
        test('順序が違うことを検証', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB]);
            
            const obj = new ChainTestClass();
            
            EMA.activate(ChainLayerA);
            EMA.activate(ChainLayerB);
            
            obj.process(5);
            
            // 実際は [A, B] なので [B, A] ではない
            expect(obj.process).not.toExecuteInOrder([ChainLayerB, ChainLayerA]);
            
            EMA.deactivate(ChainLayerA);
            EMA.deactivate(ChainLayerB);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
    });
    
    describe('エラーケース', () => {
        test('メソッドが呼ばれていない場合はエラー', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB]);
            
            const obj = new ChainTestClass();
            
            // process を呼ばない
            
            expect(() => {
                expect(obj.process).toExecuteInOrder([ChainLayerA]);
            }).toThrow(/No execution chain recorded/);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
        
        test('順序が違う場合は失敗', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB]);
            
            const obj = new ChainTestClass();
            
            EMA.activate(ChainLayerA);
            EMA.activate(ChainLayerB);
            
            obj.process(5);
            
            // 実際は [A, B] なので [B, A] を期待すると失敗
            expect(() => {
                expect(obj.process).toExecuteInOrder([ChainLayerB, ChainLayerA]);
            }).toThrow(/Expected execution order/);
            
            EMA.deactivate(ChainLayerA);
            EMA.deactivate(ChainLayerB);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
        
        test('層が足りない場合は失敗', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB]);
            
            const obj = new ChainTestClass();
            
            EMA.activate(ChainLayerA);
            EMA.activate(ChainLayerB);
            
            obj.process(5);
            
            // 実際は [A, B] なので [A, B, C] を期待すると失敗
            expect(() => {
                expect(obj.process).toExecuteInOrder([ChainLayerA, ChainLayerB, ChainLayerC]);
            }).toThrow(/Missing layers/);
            
            EMA.deactivate(ChainLayerA);
            EMA.deactivate(ChainLayerB);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
        
        test('余分な層がある場合は失敗', () => {
            EMA.config({ proceedMode: 'chain' });
            EMA.resolveConflict(ChainTestClass.prototype, 'process', [ChainLayerA, ChainLayerB]);
            
            const obj = new ChainTestClass();
            
            EMA.activate(ChainLayerA);
            EMA.activate(ChainLayerB);
            
            obj.process(5);
            
            // 実際は [A, B] なので [A] だけを期待すると失敗
            expect(() => {
                expect(obj.process).toExecuteInOrder([ChainLayerA]);
            }).toThrow(/Extra layers executed/);
            
            EMA.deactivate(ChainLayerA);
            EMA.deactivate(ChainLayerB);
            
            // クリーンアップ
            EMA.config({ proceedMode: 'original' });
            EMA.clearConflictResolutions();
        });
    });
});
