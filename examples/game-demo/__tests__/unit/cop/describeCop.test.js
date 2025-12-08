/**
 * describeCop を使った COP テスト
 * 
 * use.layer で指定した Layer だけが機能し、
 * 他の Layer の影響を受けない独立した環境でテスト
 */
import { jest } from '@jest/globals';
import { describeCop, toBePartialMethodOf, toBeActive } from '../../../../../dist/helpers/describeCop.js';

// カスタムマッチャーを登録
expect.extend({ toBePartialMethodOf, toBeActive });
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    difficultySignal,
    tutorialSignal,
    tutorialState
} from '../../../js/layers.js';

const mockCanvas = { width: 600, height: 400 };

// ========================================
// HardModeLayer のテスト
// ========================================
describeCop('Enemy - HardModeLayer', () => {
    use.layer(HardModeLayer);
    
    test('ベースメソッドはHP1を返す（Layer 非活性時）', () => {
        // difficultySignal が 'normal' なので HardModeLayer は非活性
        const enemy = new Enemy(mockCanvas);
        expect(enemy.getEnemyHP()).toBe(1);
    });
    
    test('HardModeLayer 活性化時はHP3を返す', () => {
        // Signal を変更して Layer を活性化
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        expect(enemy.getEnemyHP()).toBe(3);
    });
    
    test('spawn で HP3 の敵を生成', () => {
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        enemy.spawn();
        
        expect(enemy.enemies.length).toBe(1);
        expect(enemy.enemies[0].hp).toBe(3);
    });
    
    test('Signal の値はテスト間で独立', () => {
        // 前のテストで 'hard' に変更されたが、ここでは初期値に戻っている
        expect(difficultySignal.value).toBe('normal');
    });
});

// ========================================
// EasyModeLayer のテスト
// ========================================
describeCop('Enemy - EasyModeLayer', () => {
    use.layer(EasyModeLayer);
    
    test('EasyModeLayer 活性化時はHP1を返す', () => {
        difficultySignal.value = 'easy';
        
        const enemy = new Enemy(mockCanvas);
        expect(enemy.getEnemyHP()).toBe(1);
    });
    
    test('spawn で HP1 の敵を生成', () => {
        difficultySignal.value = 'easy';
        
        const enemy = new Enemy(mockCanvas);
        enemy.spawn();
        
        expect(enemy.enemies.length).toBe(1);
        expect(enemy.enemies[0].hp).toBe(1);
    });
});

// ========================================
// TutorialLayer のテスト
// ========================================
describeCop('Enemy - TutorialLayer', () => {
    use.layer(TutorialLayer);
    
    test('TutorialLayer 活性化時の spawn はチュートリアルメッセージを表示', () => {
        // Mock のセットアップ
        global.game = {
            ui: { showTutorialMessage: jest.fn() }
        };
        
        tutorialSignal.value = true;
        tutorialState.hasSeenFirstEnemy = false;  // リセット
        
        const enemy = new Enemy(mockCanvas);
        enemy.spawn();
        
        expect(enemy.enemies.length).toBe(1);
        expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith(
            '👾 敵が現れた！スペースキーで撃て！',
            3000
        );
        
        // クリーンアップ
        delete global.game;
    });
});

// ========================================
// 複数の Layer を使うテスト
// ========================================
describeCop('Enemy - HardMode + Tutorial', () => {
    use.layer([HardModeLayer, TutorialLayer]);
    
    test('両方の Layer の部分メソッドがインストールされている', () => {
        difficultySignal.value = 'hard';
        tutorialSignal.value = true;
        
        const enemy = new Enemy(mockCanvas);
        
        // HardModeLayer の部分メソッドがインストールされているか確認
        expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
        
        // TutorialLayer の部分メソッドがインストールされているか確認
        expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
    });
    
    test('両方の Layer が機能する', () => {
        global.game = {
            ui: { showTutorialMessage: jest.fn() }
        };
        
        difficultySignal.value = 'hard';
        tutorialSignal.value = true;
        tutorialState.hasSeenFirstEnemy = false;  // リセット
        
        const enemy = new Enemy(mockCanvas);
        
        // 実行前: どの Layer の部分メソッドが実行されるか確認
        expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
        expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
        
        enemy.spawn();
        
        // 実行後: 部分メソッドは変わらない
        expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
        
        // HardModeLayer: HP3
        expect(enemy.enemies[0].hp).toBe(3);
        
        // TutorialLayer: メッセージ表示
        // 部分メソッドは正しくインストールされているが、
        // tutorialState.hasSeenFirstEnemy（グローバル変数）の影響で
        // メッセージが表示されない可能性がある
        expect(global.game.ui.showTutorialMessage).toHaveBeenCalled();
        
        delete global.game;
    });
});

// ========================================
// 指定外の Layer の影響がないことを確認
// ========================================
describeCop('Enemy - HardModeLayer のみ（TutorialLayer の影響なし）', () => {
    use.layer(HardModeLayer);
    
    test('tutorialSignal が true でも TutorialLayer は機能しない', () => {
        global.game = {
            ui: { showTutorialMessage: jest.fn() }
        };
        
        // 通常なら TutorialLayer が活性化する条件
        tutorialSignal.value = true;
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        enemy.spawn();
        
        // HardModeLayer: HP3
        expect(enemy.enemies[0].hp).toBe(3);
        
        // TutorialLayer は use.layer で指定していないので機能しない
        expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalled();
        
        delete global.game;
    });
});

// ========================================
// toBePartialMethodOf マッチャーのテスト
// ========================================
describeCop('toBePartialMethodOf マッチャー', () => {
    use.layer(TutorialLayer);
    
    test('spawn が TutorialLayer の部分メソッドである', () => {
        tutorialSignal.value = true;
        
        const enemy = new Enemy(mockCanvas);
        
        // spawn は TutorialLayer の部分メソッド
        expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
    });
    
    test('getEnemyHP は TutorialLayer の部分メソッドではない', () => {
        tutorialSignal.value = true;
        
        const enemy = new Enemy(mockCanvas);
        
        // getEnemyHP は TutorialLayer の部分メソッドではない
        expect(enemy.getEnemyHP).not.toBePartialMethodOf(TutorialLayer);
    });
});

describeCop('toBePartialMethodOf - HardModeLayer', () => {
    use.layer(HardModeLayer);
    
    test('getEnemyHP が HardModeLayer の部分メソッドである', () => {
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        
        // getEnemyHP は HardModeLayer の部分メソッド
        expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
    });
});

// ========================================
// toBeActive マッチャーのテスト
// ========================================
describeCop('toBeActive マッチャー', () => {
    use.layer([HardModeLayer, EasyModeLayer, TutorialLayer]);
    
    test('HardModeLayer が活性化している', () => {
        difficultySignal.value = 'hard';
        
        expect(HardModeLayer).toBeActive();
        expect(EasyModeLayer).not.toBeActive();
    });
    
    test('EasyModeLayer が活性化している', () => {
        difficultySignal.value = 'easy';
        
        expect(EasyModeLayer).toBeActive();
        expect(HardModeLayer).not.toBeActive();
    });
    
    test('TutorialLayer が活性化している', () => {
        tutorialSignal.value = true;
        
        expect(TutorialLayer).toBeActive();
    });
    
    test('活性化条件の typo を検出（"Normal" vs "normal"）', () => {
        // 間違った値をセット
        difficultySignal.value = 'Normal';  // typo: 大文字の N
        
        // どの難易度 Layer も活性化しない
        expect(HardModeLayer).not.toBeActive();
        expect(EasyModeLayer).not.toBeActive();
        
        // 正しい値をセット
        difficultySignal.value = 'normal';
        
        // まだどの Layer も活性化しない（normal は条件に含まれない）
        expect(HardModeLayer).not.toBeActive();
        expect(EasyModeLayer).not.toBeActive();
    });
});
