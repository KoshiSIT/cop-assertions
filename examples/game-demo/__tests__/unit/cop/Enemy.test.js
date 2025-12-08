import Enemy from '../../../js/Enemy.js';
import { EMA } from '../../../../../dist/ema/index.js';
import { 
    HardModeLayer, 
    EasyModeLayer, 
    TutorialLayer,
    difficultySignal,
    tutorialSignal 
} from '../../../js/layers.js';

describe('Enemy - COP', () => {
    const mockCanvas = { width: 600, height: 400 };

    describe('getEnemyHP', () => {
        let enemy;

        // ========================================
        // 現状: 手動でセットアップ
        // ========================================
        beforeEach(() => {
            // テスト対象のインスタンス作成
            enemy = new Enemy(mockCanvas);

            // 全層をinactiveにする（前のテストの影響を排除）
            EMA.deactivate(HardModeLayer);
            EMA.deactivate(EasyModeLayer);
            EMA.deactivate(TutorialLayer);

            // Signalを初期値に戻す
            difficultySignal.value = 'normal';
            tutorialSignal.value = true;
        });

        // ========================================
        // テストケース
        // ========================================
        test('ベースメソッドはHP1を返す', () => {
            // Arrange: 全層inactive（beforeEachで設定済み）

            // Act & Assert
            expect(enemy.getEnemyHP()).toBe(1);
        });

        test('HardModeLayer活性化時はHP3を返す', () => {
            // Arrange
            EMA.activate(HardModeLayer);

            // Act & Assert
            expect(enemy.getEnemyHP()).toBe(3);
        });

        test('EasyModeLayer活性化時はHP1を返す', () => {
            // Arrange
            EMA.activate(EasyModeLayer);

            // Act & Assert
            expect(enemy.getEnemyHP()).toBe(1);
        });
    });
});
