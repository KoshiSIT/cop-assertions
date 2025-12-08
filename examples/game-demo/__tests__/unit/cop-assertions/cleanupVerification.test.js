/**
 * クリーンアップ問題の確認テスト
 * 
 * マッチャーではなく、実際のメソッド出力で確認
 */
import { jest } from '@jest/globals';
import { describeCop } from '../../../../../dist/helpers/describeCop.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    TutorialLayer,
    BossWaveLayer,
    difficultySignal,
    tutorialSignal,
    bossWaveSignal,
    tutorialState
} from '../../../js/layers.js';

const mockCanvas = { width: 600, height: 400 };

// ========================================
// spawn の動作確認 - BossWaveLayer のみ指定
// ========================================
describeCop('spawn クリーンアップ - BossWaveLayer のみ', () => {
    use.layer(BossWaveLayer);
    
    test('spawn は BossWaveLayer の動作をする（TutorialLayer の条件を満たしても）', () => {
        // game.ui.showTutorialMessage をモック
        global.game = {
            ui: {
                showTutorialMessage: jest.fn()
            }
        };
        
        // 両方の Layer の活性化条件を満たす
        bossWaveSignal.value = true;
        tutorialSignal.value = true;
        tutorialState.hasSeenFirstEnemy = false;  // TutorialLayer が反応する条件
        
        const enemy = new Enemy(mockCanvas);
        enemy.spawn();
        
        // BossWaveLayer の動作確認（BOSS WAVE メッセージが表示される）
        expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith('⚠️ BOSS WAVE! Enemies incoming!', 2000);
        
        // TutorialLayer は指定外なので動作しない
        expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalledWith('👾 敵が現れた！スペースキーで撃て！', 3000);
        
        delete global.game;
    });
});

// ========================================
// spawn の動作確認 - TutorialLayer のみ指定
// ========================================
describeCop('spawn クリーンアップ - TutorialLayer のみ', () => {
    use.layer(TutorialLayer);
    
    test('spawn は TutorialLayer の動作をする（BossWaveLayer の条件を満たしても）', () => {
        // game.ui.showTutorialMessage をモック
        global.game = {
            ui: {
                showTutorialMessage: jest.fn()
            }
        };
        
        // 両方の Layer の活性化条件を満たす
        tutorialSignal.value = true;
        bossWaveSignal.value = true;
        tutorialState.hasSeenFirstEnemy = false;  // TutorialLayer が反応する条件
        
        const enemy = new Enemy(mockCanvas);
        enemy.spawn();
        
        // TutorialLayer の動作確認（チュートリアルメッセージが表示される）
        expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith('👾 敵が現れた！スペースキーで撃て！', 3000);
        
        // BossWaveLayer は指定外なので動作しない
        expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalledWith('⚠️ BOSS WAVE! Enemies incoming!', 2000);
        
        delete global.game;
    });
});

// ========================================
// spawn の動作確認 - どちらも指定しない（元のメソッド）
// ========================================
describeCop('spawn クリーンアップ - HardModeLayer のみ（spawn なし）', () => {
    use.layer(HardModeLayer);  // HardModeLayer は spawn の部分メソッドを持っていない
    
    test('spawn は元のメソッドを実行（TutorialLayer, BossWaveLayer の条件を満たしても）', () => {
        // game.ui.showTutorialMessage をモック
        global.game = {
            ui: {
                showTutorialMessage: jest.fn()
            }
        };
        
        // 全ての Layer の活性化条件を満たす
        difficultySignal.value = 'hard';
        tutorialSignal.value = true;
        bossWaveSignal.value = true;
        tutorialState.hasSeenFirstEnemy = false;
        
        const enemy = new Enemy(mockCanvas);
        enemy.spawn();
        
        // どちらの Layer も指定外なので showTutorialMessage は呼ばれない
        expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalled();
        
        delete global.game;
    });
});
