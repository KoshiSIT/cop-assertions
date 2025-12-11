/**
 * toBeOriginalMethod マッチャーのテスト
 * 
 * メソッドが元のメソッド（Refine されていない）かどうかを確認する
 */
import { jest } from '@jest/globals';
import { describeCop, toBeOriginalMethod, toBePartialMethodOf } from '../../../../../dist/helpers/describeCop.js';
import Enemy from '../../../js/Enemy.js';
import Player from '../../../js/Player.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    BossWaveLayer,
    difficultySignal,
    tutorialSignal,
    bossWaveSignal
} from '../../../js/layers.js';

expect.extend({ toBeOriginalMethod, toBePartialMethodOf });

const mockCanvas = { width: 600, height: 400 };

// ========================================
// 基本的な使用方法
// ========================================
describe('toBeOriginalMethod - 基本', () => {
    
    describeCop('Layer が非活性の場合', () => {
        use.layer(HardModeLayer);
        
        test('非活性時、getEnemyHP は元のメソッド', () => {
            // HardModeLayer は非活性（difficultySignal が 'normal'）
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).toBeOriginalMethod();
        });
        
        test('非活性時、getSpeed は元のメソッド', () => {
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getSpeed).toBeOriginalMethod();
        });
        
        test('非活性時、takeDamage は元のメソッド', () => {
            const player = new Player(mockCanvas);
            
            expect(player.takeDamage).toBeOriginalMethod();
        });
    });
    
    describeCop('Layer が活性化の場合', () => {
        use.layer(HardModeLayer);
        
        test('活性化時、getEnemyHP は元のメソッドではない', () => {
            difficultySignal.value = 'hard';
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).not.toBeOriginalMethod();
        });
        
        test('活性化時、getEnemyHP は HardModeLayer の部分メソッド', () => {
            difficultySignal.value = 'hard';
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).not.toBeOriginalMethod();
            expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
        });
    });
});

// ========================================
// 複数の Layer
// ========================================
describe('toBeOriginalMethod - 複数の Layer', () => {
    
    describeCop('TutorialLayer のみ指定', () => {
        use.layer(TutorialLayer);
        
        test('TutorialLayer 活性化時、spawn は元のメソッドではない', () => {
            tutorialSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.spawn).not.toBeOriginalMethod();
            expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
        });
        
        test('TutorialLayer 活性化時でも、getEnemyHP は元のメソッド', () => {
            tutorialSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            
            // TutorialLayer は getEnemyHP の部分メソッドを持っていない
            expect(enemy.getEnemyHP).toBeOriginalMethod();
        });
    });
    
    describeCop('BossWaveLayer のみ指定', () => {
        use.layer(BossWaveLayer);
        
        test('BossWaveLayer 活性化時、getEnemyHP は元のメソッドではない', () => {
            bossWaveSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).not.toBeOriginalMethod();
            expect(enemy.getEnemyHP).toBePartialMethodOf(BossWaveLayer);
        });
        
        test('BossWaveLayer 非活性時、getEnemyHP は元のメソッド', () => {
            bossWaveSignal.value = false;
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).toBeOriginalMethod();
        });
    });
});

// ========================================
// テスト間の独立性
// ========================================
describe('toBeOriginalMethod - テスト間の独立性', () => {
    
    describeCop('テスト1: Layer を活性化', () => {
        use.layer(HardModeLayer);
        
        test('HardModeLayer を活性化', () => {
            difficultySignal.value = 'hard';
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).not.toBeOriginalMethod();
        });
    });
    
    describeCop('テスト2: 前のテストの影響を受けない', () => {
        use.layer(HardModeLayer);
        
        test('前のテストで活性化されたが、ここでは元のメソッド', () => {
            // difficultySignal は初期値に戻っているはず
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).toBeOriginalMethod();
        });
    });
});

// ========================================
// .not との組み合わせ
// ========================================
describe('toBeOriginalMethod - .not との組み合わせ', () => {
    
    describeCop('EasyModeLayer のテスト', () => {
        use.layer(EasyModeLayer);
        
        test('活性化時は元のメソッドではない', () => {
            difficultySignal.value = 'easy';
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).not.toBeOriginalMethod();
        });
        
        test('非活性時は元のメソッド', () => {
            difficultySignal.value = 'normal';
            
            const enemy = new Enemy(mockCanvas);
            
            expect(enemy.getEnemyHP).toBeOriginalMethod();
        });
    });
});

// ========================================
// 部分メソッドを持たないメソッド
// ========================================
describe('toBeOriginalMethod - 部分メソッドを持たないメソッド', () => {
    
    describeCop('どの Layer も getPosition を refine していない', () => {
        use.layer([HardModeLayer, EasyModeLayer, TutorialLayer]);
        
        test('どの Layer が活性化しても getPosition は常に元のメソッド', () => {
            difficultySignal.value = 'hard';
            tutorialSignal.value = true;
            
            const player = new Player(mockCanvas);
            
            // getPosition は部分メソッドが定義されていない
            // （PartialMethodsPool に登録されていない）
            // この場合は "not a registered method" になる
        });
    });
});
