/**
 * toHaveLastExecutedBehaviorOf / toHaveNthExecutedBehaviorOf マッチャーのテスト
 * 
 * メソッド呼び出しでどの層の振る舞いが実行されたかを検証する
 */
import { 
    describeCop, 
    toBeActive,
    toHaveLastExecutedBehaviorOf,
    toHaveNthExecutedBehaviorOf
} from '../../../../../dist/helpers/describeCop.js';
import Enemy from '../../../js/Enemy.js';
import Player from '../../../js/Player.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    difficultySignal,
    tutorialSignal
} from '../../../js/layers.js';

// カスタムマッチャーを登録
expect.extend({ 
    toBeActive,
    toHaveLastExecutedBehaviorOf,
    toHaveNthExecutedBehaviorOf
});

const mockCanvas = { width: 600, height: 400 };

// ========================================
// toHaveLastExecutedBehaviorOf の基本機能
// ========================================
describeCop('toHaveLastExecutedBehaviorOf - 基本', () => {
    use.layer([HardModeLayer, EasyModeLayer]);
    
    test('HardModeLayer の振る舞いが実行された', () => {
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        enemy.getEnemyHP();
        
        expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(HardModeLayer);
    });
    
    test('EasyModeLayer の振る舞いが実行された', () => {
        difficultySignal.value = 'easy';
        
        const enemy = new Enemy(mockCanvas);
        enemy.getEnemyHP();
        
        expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(EasyModeLayer);
    });
    
    test('層が非活性の場合はオリジナルが実行される', () => {
        difficultySignal.value = 'normal';
        
        const enemy = new Enemy(mockCanvas);
        enemy.getEnemyHP();
        
        // オリジナルメソッドの場合は layer が null
        expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(null);
    });
    
    test('.not で否定形も使える', () => {
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        enemy.getEnemyHP();
        
        expect(Enemy.prototype.getEnemyHP).not.toHaveLastExecutedBehaviorOf(EasyModeLayer);
    });
});

// ========================================
// toHaveNthExecutedBehaviorOf の基本機能
// ========================================
describeCop('toHaveNthExecutedBehaviorOf - 基本', () => {
    use.layer([HardModeLayer, EasyModeLayer]);
    
    test('n 番目の呼び出しを検証できる（1-indexed）', () => {
        const enemy = new Enemy(mockCanvas);
        
        // 1回目: Easy
        difficultySignal.value = 'easy';
        enemy.getEnemyHP();
        
        // 2回目: Hard
        difficultySignal.value = 'hard';
        enemy.getEnemyHP();
        
        // 3回目: Normal (オリジナル)
        difficultySignal.value = 'normal';
        enemy.getEnemyHP();
        
        expect(Enemy.prototype.getEnemyHP).toHaveNthExecutedBehaviorOf(1, EasyModeLayer);
        expect(Enemy.prototype.getEnemyHP).toHaveNthExecutedBehaviorOf(2, HardModeLayer);
        expect(Enemy.prototype.getEnemyHP).toHaveNthExecutedBehaviorOf(3, null);
    });
    
    test('最後の呼び出しと一致する', () => {
        const enemy = new Enemy(mockCanvas);
        
        difficultySignal.value = 'easy';
        enemy.getEnemyHP();  // 1回目
        
        difficultySignal.value = 'hard';
        enemy.getEnemyHP();  // 2回目
        
        // toHaveNthExecutedBehaviorOf(2, ...) と toHaveLastExecutedBehaviorOf は同じ
        expect(Enemy.prototype.getEnemyHP).toHaveNthExecutedBehaviorOf(2, HardModeLayer);
        expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(HardModeLayer);
    });
});

// ========================================
// 複数のメソッドの追跡
// ========================================
describeCop('toHaveLastExecutedBehaviorOf - 複数メソッド', () => {
    use.layer([HardModeLayer, EasyModeLayer]);
    
    test('異なるメソッドを別々に追跡できる', () => {
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        enemy.getEnemyHP();
        enemy.getSpeed();
        
        expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(HardModeLayer);
        expect(Enemy.prototype.getSpeed).toHaveLastExecutedBehaviorOf(HardModeLayer);
    });
});

// ========================================
// エラーケース
// ========================================
describeCop('toHaveLastExecutedBehaviorOf - エラーケース', () => {
    use.layer([HardModeLayer]);
    
    test('メソッドが呼ばれていない場合はエラー', () => {
        // getEnemyHP を一度も呼ばない
        
        expect(() => {
            expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(HardModeLayer);
        }).toThrow(/No calls recorded/);
    });
    
    test('存在しない n 番目を指定するとエラー', () => {
        const enemy = new Enemy(mockCanvas);
        
        difficultySignal.value = 'hard';
        enemy.getEnemyHP();  // 1回だけ呼ぶ
        
        expect(() => {
            expect(Enemy.prototype.getEnemyHP).toHaveNthExecutedBehaviorOf(5, HardModeLayer);
        }).toThrow(/Call #5 does not exist/);
    });
});

// ========================================
// 層の切り替えを伴うシナリオ
// ========================================
describeCop('toHaveLastExecutedBehaviorOf - シナリオ', () => {
    use.layer([HardModeLayer, EasyModeLayer]);
    
    test('ゲーム中に難易度が変更されるシナリオ', () => {
        const enemy = new Enemy(mockCanvas);
        
        // ゲーム開始: Easy モード
        difficultySignal.value = 'easy';
        enemy.getEnemyHP();
        expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(EasyModeLayer);
        
        // プレイヤーが難易度を Hard に変更
        difficultySignal.value = 'hard';
        enemy.getEnemyHP();
        expect(Enemy.prototype.getEnemyHP).toHaveLastExecutedBehaviorOf(HardModeLayer);
        
        // 元の呼び出しも検証可能
        expect(Enemy.prototype.getEnemyHP).toHaveNthExecutedBehaviorOf(1, EasyModeLayer);
        expect(Enemy.prototype.getEnemyHP).toHaveNthExecutedBehaviorOf(2, HardModeLayer);
    });
});
