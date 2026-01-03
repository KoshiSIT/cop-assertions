/**
 * オブジェクトスコープ拡張のテスト
 * 
 * EMA.activateFor / deactivateFor / isActiveFor
 */

import { 
    EMA, 
    installObjectScopeExtension, 
    uninstallObjectScopeExtension 
} from '../../../../../dist/ema/index.js';
import { toBeActiveFor } from '../../../../../dist/helpers/describeCop.js';

expect.extend({ toBeActiveFor });

// テスト用の層を定義
const ObjectScopeLayerA = { name: 'ObjectScopeLayerA' };
const ObjectScopeLayerB = { name: 'ObjectScopeLayerB' };

// テスト用クラス
class TestScreen {
    constructor(id) {
        this.id = id;
        this.brightness = 100;
    }
    
    getBrightness() {
        return this.brightness;
    }
    
    getInfo() {
        return `Screen ${this.id}: brightness=${this.brightness}`;
    }
}

class TestPlayer {
    constructor(name) {
        this.name = name;
        this.hp = 100;
    }
    
    getStatus() {
        return `${this.name}: HP=${this.hp}`;
    }
}

describe('ObjectScopeExtension', () => {
    
    beforeAll(() => {
        // 拡張をインストール
        installObjectScopeExtension();
        
        // 層の部分メソッドを定義
        EMA.addPartialMethod(ObjectScopeLayerA, TestScreen.prototype, 'getBrightness', function() {
            return 30;  // 暗い
        });
        
        EMA.addPartialMethod(ObjectScopeLayerA, TestScreen.prototype, 'getInfo', function() {
            return `Screen ${this.id}: NIGHT MODE`;
        });
        
        EMA.addPartialMethod(ObjectScopeLayerB, TestScreen.prototype, 'getBrightness', function() {
            return 150;  // 明るい
        });
        
        // 層をデプロイ
        EMA.deploy(ObjectScopeLayerA);
        EMA.deploy(ObjectScopeLayerB);
    });
    
    afterAll(() => {
        EMA.undeploy(ObjectScopeLayerA);
        EMA.undeploy(ObjectScopeLayerB);
        uninstallObjectScopeExtension();
    });
    
    afterEach(() => {
        // 各テスト後にグローバル活性化をクリア
        EMA.deactivate(ObjectScopeLayerA);
        EMA.deactivate(ObjectScopeLayerB);
    });
    
    // ========================================
    // 基本機能
    // ========================================
    describe('基本機能', () => {
        test('特定オブジェクトに対してのみ層を活性化できる', () => {
            const screen1 = new TestScreen(1);
            const screen2 = new TestScreen(2);
            
            // screen1 に対してのみ活性化
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            // screen1 は NightMode（30）
            expect(screen1.getBrightness()).toBe(30);
            
            // screen2 は元のまま（100）
            expect(screen2.getBrightness()).toBe(100);
            
            // クリーンアップ
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
        });
        
        test('isActiveFor で活性化状態を確認できる', () => {
            const screen1 = new TestScreen(1);
            const screen2 = new TestScreen(2);
            
            expect(EMA.isActiveFor(ObjectScopeLayerA, screen1)).toBe(false);
            expect(EMA.isActiveFor(ObjectScopeLayerA, screen2)).toBe(false);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            expect(EMA.isActiveFor(ObjectScopeLayerA, screen1)).toBe(true);
            expect(EMA.isActiveFor(ObjectScopeLayerA, screen2)).toBe(false);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            
            expect(EMA.isActiveFor(ObjectScopeLayerA, screen1)).toBe(false);
        });
        
        test('deactivateFor で非活性化できる', () => {
            const screen1 = new TestScreen(1);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            expect(screen1.getBrightness()).toBe(30);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            expect(screen1.getBrightness()).toBe(100);
        });
        
        test('複数オブジェクトを配列で活性化できる', () => {
            const screen1 = new TestScreen(1);
            const screen2 = new TestScreen(2);
            const screen3 = new TestScreen(3);
            
            EMA.activateFor(ObjectScopeLayerA, [screen1, screen2]);
            
            expect(screen1.getBrightness()).toBe(30);
            expect(screen2.getBrightness()).toBe(30);
            expect(screen3.getBrightness()).toBe(100);
            
            EMA.deactivateFor(ObjectScopeLayerA, [screen1, screen2]);
        });
        
        test('複数のメソッドが活性化される', () => {
            const screen1 = new TestScreen(1);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            expect(screen1.getBrightness()).toBe(30);
            expect(screen1.getInfo()).toBe('Screen 1: NIGHT MODE');
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            
            expect(screen1.getBrightness()).toBe(100);
            expect(screen1.getInfo()).toBe('Screen 1: brightness=100');
        });
    });
    
    // ========================================
    // 複数の層
    // ========================================
    describe('複数の層', () => {
        test('異なるオブジェクトに異なる層を活性化できる', () => {
            const screen1 = new TestScreen(1);
            const screen2 = new TestScreen(2);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);  // NightMode
            EMA.activateFor(ObjectScopeLayerB, screen2);  // BrightMode
            
            expect(screen1.getBrightness()).toBe(30);
            expect(screen2.getBrightness()).toBe(150);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            EMA.deactivateFor(ObjectScopeLayerB, screen2);
        });
        
        test('同じオブジェクトに複数の層を活性化すると後から活性化した層が優先', () => {
            const screen1 = new TestScreen(1);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            expect(screen1.getBrightness()).toBe(30);
            
            EMA.activateFor(ObjectScopeLayerB, screen1);
            expect(screen1.getBrightness()).toBe(150);  // LayerB が優先
            
            EMA.deactivateFor(ObjectScopeLayerB, screen1);
            expect(screen1.getBrightness()).toBe(30);  // LayerA に戻る
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            expect(screen1.getBrightness()).toBe(100);  // オリジナル
        });
    });
    
    // ========================================
    // グローバル活性化との共存
    // ========================================
    describe('グローバル活性化との共存', () => {
        test('オブジェクトスコープがグローバルより優先される', () => {
            const screen1 = new TestScreen(1);
            const screen2 = new TestScreen(2);
            
            // グローバルに LayerB を活性化
            EMA.activate(ObjectScopeLayerB);
            
            expect(screen1.getBrightness()).toBe(150);
            expect(screen2.getBrightness()).toBe(150);
            
            // screen1 に対して LayerA をオブジェクトスコープで活性化
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            // screen1 はオブジェクトスコープの LayerA が優先
            expect(screen1.getBrightness()).toBe(30);
            // screen2 はグローバルの LayerB
            expect(screen2.getBrightness()).toBe(150);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            EMA.deactivate(ObjectScopeLayerB);
        });
        
        test('オブジェクトスコープを解除するとグローバルに戻る', () => {
            const screen1 = new TestScreen(1);
            
            EMA.activate(ObjectScopeLayerB);
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            expect(screen1.getBrightness()).toBe(30);  // オブジェクトスコープ
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            
            expect(screen1.getBrightness()).toBe(150);  // グローバルに戻る
            
            EMA.deactivate(ObjectScopeLayerB);
        });
    });
    
    // ========================================
    // バリデーション
    // ========================================
    describe('バリデーション', () => {
        test('オブジェクト以外を渡すとエラー', () => {
            expect(() => {
                EMA.activateFor(ObjectScopeLayerA, 'string');
            }).toThrow(/must be object/);
            
            expect(() => {
                EMA.activateFor(ObjectScopeLayerA, 123);
            }).toThrow(/must be object/);
            
            expect(() => {
                EMA.activateFor(ObjectScopeLayerA, null);
            }).toThrow(/must be object/);
        });
        
        test('部分メソッドを持たないオブジェクトを渡すとエラー', () => {
            const player = new TestPlayer('Hero');
            
            // ObjectScopeLayerA は TestScreen のみ refine している
            expect(() => {
                EMA.activateFor(ObjectScopeLayerA, player);
            }).toThrow(/has no partial methods for TestPlayer/);
        });
        
        test('デプロイされていない層を渡すとエラー', () => {
            const screen1 = new TestScreen(1);
            const UndeployedLayer = { name: 'UndeployedLayer' };
            
            // 部分メソッドは定義するがデプロイはしない
            EMA.addPartialMethod(UndeployedLayer, TestScreen.prototype, 'getBrightness', function() {
                return 50;
            });
            
            expect(() => {
                EMA.activateFor(UndeployedLayer, screen1);
            }).toThrow(/is not deployed/);
        });
    });
    
    // ========================================
    // __layer__ メタデータ
    // ========================================
    describe('__layer__ メタデータ', () => {
        test('オブジェクトスコープで活性化するとメソッドに __layer__ が設定される', () => {
            const screen1 = new TestScreen(1);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            expect(screen1.getBrightness.__layer__).toBe(ObjectScopeLayerA);
            expect(screen1.getBrightness.__objectScope__).toBe(true);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            
            // 非活性化すると __layer__ はなくなる
            expect(screen1.getBrightness.__layer__).toBeUndefined();
        });
    });
    
    // ========================================
    // this の参照
    // ========================================
    describe('this の参照', () => {
        test('部分メソッド内で this が正しく参照される', () => {
            const screen1 = new TestScreen(1);
            screen1.brightness = 50;
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            // getInfo は this.id を参照
            expect(screen1.getInfo()).toBe('Screen 1: NIGHT MODE');
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
        });
    });
    
    // ========================================
    // toBeActiveFor アサーション
    // ========================================
    describe('toBeActiveFor アサーション', () => {
        test('活性化されたオブジェクトに対して true', () => {
            const screen1 = new TestScreen(1);
            const screen2 = new TestScreen(2);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            expect(ObjectScopeLayerA).toBeActiveFor(screen1);
            expect(ObjectScopeLayerA).not.toBeActiveFor(screen2);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
        });
        
        test('非活性化後は false', () => {
            const screen1 = new TestScreen(1);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            expect(ObjectScopeLayerA).toBeActiveFor(screen1);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
            expect(ObjectScopeLayerA).not.toBeActiveFor(screen1);
        });
        
        test('異なる層は独立して判定される', () => {
            const screen1 = new TestScreen(1);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            expect(ObjectScopeLayerA).toBeActiveFor(screen1);
            expect(ObjectScopeLayerB).not.toBeActiveFor(screen1);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
        });
        
        test('.not で反転できる', () => {
            const screen1 = new TestScreen(1);
            
            // 活性化していない状態
            expect(ObjectScopeLayerA).not.toBeActiveFor(screen1);
            
            EMA.activateFor(ObjectScopeLayerA, screen1);
            
            // 活性化後は .not が失敗することを確認
            expect(() => {
                expect(ObjectScopeLayerA).not.toBeActiveFor(screen1);
            }).toThrow(/IS active for the object/);
            
            EMA.deactivateFor(ObjectScopeLayerA, screen1);
        });
        
        test('失敗時のエラーメッセージが適切', () => {
            const screen1 = new TestScreen(1);
            
            expect(() => {
                expect(ObjectScopeLayerA).toBeActiveFor(screen1);
            }).toThrow(/is NOT active for the object/);
        });
    });
});
