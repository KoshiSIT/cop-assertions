/**
 * BossWaveLayer のテスト
 */
import { describeCop, toBePartialMethodOf, toBeActive } from '../../../../../dist/helpers/describeCop.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    TutorialLayer,
    BossWaveLayer,
    difficultySignal,
    tutorialSignal,
    bossWaveSignal
} from '../../../js/layers.js';

expect.extend({ toBePartialMethodOf, toBeActive });

const mockCanvas = { width: 600, height: 400 };

// ========================================
// BossWaveLayer の基本テスト
// ========================================
describeCop('BossWaveLayer - 基本', () => {
    use.layer(BossWaveLayer);
    
    test('bossWaveSignal が true で活性化', () => {
        bossWaveSignal.value = true;
        expect(BossWaveLayer).toBeActive();
    });
    
    test('bossWaveSignal が false で非活性', () => {
        bossWaveSignal.value = false;
        expect(BossWaveLayer).not.toBeActive();
    });
    
    test('spawn が BossWaveLayer の部分メソッド', () => {
        bossWaveSignal.value = true;
        const enemy = new Enemy(mockCanvas);
        expect(enemy.spawn).toBePartialMethodOf(BossWaveLayer);
    });
    
    test('getEnemyHP は 5 を返す', () => {
        bossWaveSignal.value = true;
        const enemy = new Enemy(mockCanvas);
        expect(enemy.getEnemyHP()).toBe(5);
    });
});

// ========================================
// TutorialLayer vs BossWaveLayer の spawn
// ========================================
describeCop('spawn の部分メソッド - TutorialLayer のみ', () => {
    use.layer(TutorialLayer);
    
    test('spawn は TutorialLayer の部分メソッド', () => {
        tutorialSignal.value = true;
        const enemy = new Enemy(mockCanvas);
        expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
    });
    
    test('spawn は BossWaveLayer の部分メソッドではない', () => {
        tutorialSignal.value = true;
        const enemy = new Enemy(mockCanvas);
        expect(enemy.spawn).not.toBePartialMethodOf(BossWaveLayer);
    });
});

describeCop('spawn の部分メソッド - BossWaveLayer のみ', () => {
    use.layer(BossWaveLayer);
    
    test('spawn は BossWaveLayer の部分メソッド', () => {
        bossWaveSignal.value = true;
        const enemy = new Enemy(mockCanvas);
        expect(enemy.spawn).toBePartialMethodOf(BossWaveLayer);
    });
    
    test('spawn は TutorialLayer の部分メソッドではない', () => {
        bossWaveSignal.value = true;
        const enemy = new Enemy(mockCanvas);
        expect(enemy.spawn).not.toBePartialMethodOf(TutorialLayer);
    });
});
