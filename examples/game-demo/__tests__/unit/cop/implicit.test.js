/**
 * Signal経由で層を活性化し、部分メソッドの動作をテスト
 * 
 * testPartialとは違い、COPの暗黙的活性化機構を使ってテストする
 */
import { jest } from '@jest/globals';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    difficultySignal,
    tutorialSignal,
    tutorialState
} from '../../../js/layers.js';

describe('Signal経由の活性化テスト - spawn', () => {
    const mockCanvas = { width: 600, height: 400 };

    test('TutorialLayer活性化時のspawnはチュートリアルメッセージを表示', () => {
        // Arrange: 状態をセット
        difficultySignal.value = 'normal';
        tutorialSignal.value = false;
        tutorialState.reset();
        global.game = {
            ui: { showTutorialMessage: jest.fn() }
        };

        const enemy = new Enemy(mockCanvas);

        // 条件を宣言（Signalで活性化）
        tutorialSignal.value = true;

        // Act
        enemy.spawn();

        // Assert
        expect(enemy.enemies.length).toBe(1);
        expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith(
            '👾 敵が現れた！スペースキーで撃て！',
            3000
        );

        // クリーンアップ
        delete global.game;
    });

    test('HardModeLayer活性化時のspawnはHP3の敵を生成', () => {
        // Arrange: 状態をセット
        difficultySignal.value = 'normal';

        const enemy = new Enemy(mockCanvas);

        // 条件を宣言
        difficultySignal.value = 'hard';

        // Act
        enemy.spawn();

        // Assert
        expect(enemy.enemies.length).toBe(1);
        expect(enemy.enemies[0].hp).toBe(3);
    });

    test('EasyModeLayer活性化時のspawnはHP1の敵を生成', () => {
        // Arrange: 状態をセット
        difficultySignal.value = 'normal';
        tutorialSignal.value = false;

        const enemy = new Enemy(mockCanvas);

        // 条件を宣言
        difficultySignal.value = 'easy';

        // Act
        enemy.spawn();

        // Assert
        expect(enemy.enemies.length).toBe(1);
        expect(enemy.enemies[0].hp).toBe(1);
    });
});
