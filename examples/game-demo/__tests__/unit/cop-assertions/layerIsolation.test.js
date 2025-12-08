/**
 * Layer 分離の網羅的テスト
 * 
 * 確認項目:
 * 1. 指定した Layer のみが動作する
 * 2. 指定外の Layer は Signal が活性化条件を満たしても動作しない
 * 3. 明示的活性化（EMA.activate）でも指定外は動作しない
 * 4. test ごとに環境がクリーンアップされる（同一 describeCop 内）
 * 5. describeCop ブロック間でも環境がクリーンアップされる
 */
import { jest } from '@jest/globals';
import { describeCop, toBePartialMethodOf, toBeActive } from '../../../../../dist/helpers/describeCop.js';
import EMA from '../../../../../dist/ema/EMA.js';
import Enemy from '../../../js/Enemy.js';
import Player from '../../../js/Player.js';
import { 
    EasyModeLayer,
    HardModeLayer, 
    TutorialLayer,
    BossWaveLayer,
    difficultySignal,
    tutorialSignal,
    bossWaveSignal,
    tutorialState
} from '../../../js/layers.js';

expect.extend({ toBePartialMethodOf, toBeActive });

const mockCanvas = { width: 600, height: 400 };

// ========================================
// 1. 単一 Layer 指定 - 指定した Layer のみ動作
// ========================================
describe('Layer 分離 - 単一 Layer 指定', () => {
    
    describeCop('HardModeLayer のみ指定', () => {
        use.layer(HardModeLayer);
        
        test('HardModeLayer 活性化時、getEnemyHP は 3 を返す', () => {
            difficultySignal.value = 'hard';
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(3);
        });
        
        test('HardModeLayer 非活性時、getEnemyHP は元の値 1 を返す', () => {
            difficultySignal.value = 'normal';
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);
        });
    });
    
    describeCop('EasyModeLayer のみ指定', () => {
        use.layer(EasyModeLayer);
        
        test('EasyModeLayer 活性化時、getEnemyHP は 1 を返す', () => {
            difficultySignal.value = 'easy';
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);
        });
    });
    
    describeCop('BossWaveLayer のみ指定', () => {
        use.layer(BossWaveLayer);
        
        test('BossWaveLayer 活性化時、getEnemyHP は 5 を返す', () => {
            bossWaveSignal.value = true;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(5);
        });
        
        test('BossWaveLayer 非活性時、getEnemyHP は元の値 1 を返す', () => {
            bossWaveSignal.value = false;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);
        });
    });
});

// ========================================
// 2. 指定外の Layer は暗黙活性化（Signal）で動作しない
// ========================================
describe('Layer 分離 - 指定外 Layer の無効化（暗黙活性化）', () => {
    
    describeCop('HardModeLayer のみ指定 - 他の Layer は動作しない', () => {
        use.layer(HardModeLayer);
        
        test('EasyModeLayer の条件を満たしても getEnemyHP は影響を受けない', () => {
            difficultySignal.value = 'easy';  // EasyModeLayer の条件
            const enemy = new Enemy(mockCanvas);
            // EasyModeLayer は指定外なので、元のメソッド 1
            expect(enemy.getEnemyHP()).toBe(1);
        });
        
        test('BossWaveLayer の条件を満たしても getEnemyHP は影響を受けない', () => {
            difficultySignal.value = 'normal';
            bossWaveSignal.value = true;  // BossWaveLayer の条件
            const enemy = new Enemy(mockCanvas);
            // BossWaveLayer は指定外なので、元のメソッド 1
            expect(enemy.getEnemyHP()).toBe(1);
        });
        
        test('全ての指定外 Layer の条件を満たしても影響を受けない', () => {
            difficultySignal.value = 'easy';
            bossWaveSignal.value = true;
            tutorialSignal.value = true;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);
        });
    });
    
    describeCop('BossWaveLayer のみ指定 - 他の Layer は動作しない', () => {
        use.layer(BossWaveLayer);
        
        test('HardModeLayer の条件を満たしても getEnemyHP は BossWaveLayer の値', () => {
            bossWaveSignal.value = true;
            difficultySignal.value = 'hard';  // HardModeLayer の条件
            const enemy = new Enemy(mockCanvas);
            // HardModeLayer は指定外なので BossWaveLayer の 5
            expect(enemy.getEnemyHP()).toBe(5);
        });
    });
});

// ========================================
// 3. 指定外の Layer は明示的活性化（EMA.activate）でも動作しない
// ========================================
describe('Layer 分離 - 指定外 Layer の無効化（明示的活性化）', () => {
    
    describeCop('HardModeLayer のみ指定 - EMA.activate で他の Layer を活性化しても無効', () => {
        use.layer(HardModeLayer);
        
        test('EMA.activate(BossWaveLayer) しても getEnemyHP は影響を受けない', () => {
            EMA.activate(BossWaveLayer);  // 明示的に活性化
            const enemy = new Enemy(mockCanvas);
            // BossWaveLayer は指定外なので、元のメソッド 1
            expect(enemy.getEnemyHP()).toBe(1);
        });
        
        test('EMA.activate(EasyModeLayer) しても getEnemyHP は影響を受けない', () => {
            EMA.activate(EasyModeLayer);  // 明示的に活性化
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);
        });
        
        test('指定した HardModeLayer は EMA.activate で活性化できる', () => {
            EMA.activate(HardModeLayer);  // 指定した Layer を明示的に活性化
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(3);
        });
    });
    
    describeCop('BossWaveLayer のみ指定 - EMA.activate で他の Layer を活性化しても無効', () => {
        use.layer(BossWaveLayer);
        
        test('EMA.activate(HardModeLayer) しても getEnemyHP は影響を受けない', () => {
            EMA.activate(HardModeLayer);  // 明示的に活性化
            bossWaveSignal.value = true;  // BossWaveLayer を活性化
            const enemy = new Enemy(mockCanvas);
            // HardModeLayer は指定外なので BossWaveLayer の 5
            expect(enemy.getEnemyHP()).toBe(5);
        });
        
        test('EMA.activate(TutorialLayer) しても spawn は影響を受けない', () => {
            global.game = { ui: { showTutorialMessage: jest.fn() } };
            
            EMA.activate(TutorialLayer);  // 明示的に活性化
            tutorialState.hasSeenFirstEnemy = false;
            bossWaveSignal.value = true;  // BossWaveLayer を活性化
            
            const enemy = new Enemy(mockCanvas);
            enemy.spawn();
            
            // BossWaveLayer の動作確認（BOSS WAVE メッセージが表示される）
            expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith('⚠️ BOSS WAVE! Enemies incoming!', 2000);
            // TutorialLayer は指定外なので動作しない（チュートリアルメッセージは表示されない）
            expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalledWith('👾 敵が現れた！スペースキーで撃て！', 3000);
            
            delete global.game;
        });
    });
});

// ========================================
// 4. spawn メソッドの Layer 分離
// ========================================
describe('Layer 分離 - spawn メソッド', () => {
    
    describeCop('TutorialLayer のみ指定', () => {
        use.layer(TutorialLayer);
        
        test('spawn は TutorialLayer の動作をする', () => {
            global.game = { ui: { showTutorialMessage: jest.fn() } };
            
            tutorialSignal.value = true;
            tutorialState.hasSeenFirstEnemy = false;
            
            const enemy = new Enemy(mockCanvas);
            enemy.spawn();
            
            // TutorialLayer の動作確認
            expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith('👾 敵が現れた！スペースキーで撃て！', 3000);
            // BossWaveLayer は指定外なので動作しない
            expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalledWith('⚠️ BOSS WAVE! Enemies incoming!', 2000);
            
            delete global.game;
        });
        
        test('BossWaveLayer の条件を満たしても spawn は TutorialLayer の動作', () => {
            global.game = { ui: { showTutorialMessage: jest.fn() } };
            
            tutorialSignal.value = true;
            bossWaveSignal.value = true;  // BossWaveLayer の条件も満たす
            tutorialState.hasSeenFirstEnemy = false;
            
            const enemy = new Enemy(mockCanvas);
            enemy.spawn();
            
            // TutorialLayer の動作確認
            expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith('👾 敵が現れた！スペースキーで撃て！', 3000);
            // BossWaveLayer は指定外なので動作しない
            expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalledWith('⚠️ BOSS WAVE! Enemies incoming!', 2000);
            
            delete global.game;
        });
    });
    
    describeCop('BossWaveLayer のみ指定', () => {
        use.layer(BossWaveLayer);
        
        test('spawn は BossWaveLayer の動作をする', () => {
            global.game = { ui: { showTutorialMessage: jest.fn() } };
            
            bossWaveSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            enemy.spawn();
            
            // BossWaveLayer の動作確認
            expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith('⚠️ BOSS WAVE! Enemies incoming!', 2000);
            // TutorialLayer は指定外なので動作しない
            expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalledWith('👾 敵が現れた！スペースキーで撃て！', 3000);
            
            delete global.game;
        });
        
        test('TutorialLayer の条件を満たしても spawn は BossWaveLayer の動作', () => {
            global.game = { ui: { showTutorialMessage: jest.fn() } };
            
            bossWaveSignal.value = true;
            tutorialSignal.value = true;  // TutorialLayer の条件も満たす
            tutorialState.hasSeenFirstEnemy = false;
            
            const enemy = new Enemy(mockCanvas);
            enemy.spawn();
            
            // BossWaveLayer の動作確認
            expect(global.game.ui.showTutorialMessage).toHaveBeenCalledWith('⚠️ BOSS WAVE! Enemies incoming!', 2000);
            // TutorialLayer は指定外なので動作しない
            expect(global.game.ui.showTutorialMessage).not.toHaveBeenCalledWith('👾 敵が現れた！スペースキーで撃て！', 3000);
            
            delete global.game;
        });
    });
    
    describeCop('HardModeLayer のみ指定（spawn の部分メソッドなし）', () => {
        use.layer(HardModeLayer);
        
        test('spawn は元のメソッドを実行', () => {
            global.game = { ui: { showTutorialMessage: jest.fn() } };
            
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
});

// ========================================
// 5. 同一 describeCop 内の test 間のクリーンアップ
// ========================================
describe('Layer 分離 - 同一ブロック内の test 間リセット', () => {
    
    describeCop('Signal のリセット確認', () => {
        use.layer(HardModeLayer);
        
        test('1つ目: Signal を hard に変更', () => {
            difficultySignal.value = 'hard';
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(3);
        });
        
        test('2つ目: 前のテストの Signal 変更がリセットされている', () => {
            // difficultySignal は初期値に戻っているはず
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);  // 元のメソッド
        });
        
        test('3つ目: 再度 Signal を変更して動作確認', () => {
            difficultySignal.value = 'hard';
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(3);
        });
    });
    
    describeCop('明示的活性化のリセット確認', () => {
        use.layer(HardModeLayer);
        
        test('1つ目: EMA.activate で活性化', () => {
            EMA.activate(HardModeLayer);
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(3);
        });
        
        test('2つ目: 前のテストの EMA.activate がリセットされている', () => {
            // HardModeLayer は非活性に戻っているはず
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);  // 元のメソッド
        });
    });
    
    describeCop('部分メソッドの __layer__ メタ情報のリセット確認', () => {
        use.layer(BossWaveLayer);
        
        test('1つ目: 活性化して部分メソッドをインストール', () => {
            bossWaveSignal.value = true;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.spawn.__layer__).toBe(BossWaveLayer);
        });
        
        test('2つ目: 非活性だと __layer__ がない', () => {
            bossWaveSignal.value = false;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.spawn.__layer__).toBeUndefined();
        });
    });
});

// ========================================
// 6. describeCop ブロック間のクリーンアップ
// ========================================
describe('Layer 分離 - describeCop ブロック間のリセット', () => {
    
    describeCop('最初のブロック - HardModeLayer を活性化', () => {
        use.layer(HardModeLayer);
        
        test('HardModeLayer を活性化', () => {
            difficultySignal.value = 'hard';
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(3);
        });
    });
    
    describeCop('次のブロック - 前のブロックの影響を受けない', () => {
        use.layer(BossWaveLayer);
        
        test('difficultySignal は初期値に戻っている', () => {
            // 前のブロックで hard にしたが、リセットされているはず
            bossWaveSignal.value = true;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(5);  // BossWaveLayer の値
        });
    });
    
    describeCop('さらに次のブロック - 全て初期状態', () => {
        use.layer(HardModeLayer);
        
        test('全ての Signal が初期値', () => {
            const enemy = new Enemy(mockCanvas);
            expect(enemy.getEnemyHP()).toBe(1);  // 元のメソッド
        });
    });
});

// ========================================
// 7. toBePartialMethodOf マッチャーの正確性
// ========================================
describe('Layer 分離 - toBePartialMethodOf マッチャー', () => {
    
    describeCop('BossWaveLayer のみ指定', () => {
        use.layer(BossWaveLayer);
        
        test('活性化時、spawn は BossWaveLayer の部分メソッド', () => {
            bossWaveSignal.value = true;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.spawn).toBePartialMethodOf(BossWaveLayer);
        });
        
        test('活性化時、spawn は TutorialLayer の部分メソッドではない', () => {
            bossWaveSignal.value = true;
            tutorialSignal.value = true;  // 条件を満たしても
            const enemy = new Enemy(mockCanvas);
            expect(enemy.spawn).not.toBePartialMethodOf(TutorialLayer);
        });
        
        test('非活性時、spawn はどの Layer の部分メソッドでもない', () => {
            bossWaveSignal.value = false;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.spawn).not.toBePartialMethodOf(BossWaveLayer);
            expect(enemy.spawn).not.toBePartialMethodOf(TutorialLayer);
        });
    });
    
    describeCop('TutorialLayer のみ指定', () => {
        use.layer(TutorialLayer);
        
        test('活性化時、spawn は TutorialLayer の部分メソッド', () => {
            tutorialSignal.value = true;
            const enemy = new Enemy(mockCanvas);
            expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
        });
        
        test('活性化時、spawn は BossWaveLayer の部分メソッドではない', () => {
            tutorialSignal.value = true;
            bossWaveSignal.value = true;  // 条件を満たしても
            const enemy = new Enemy(mockCanvas);
            expect(enemy.spawn).not.toBePartialMethodOf(BossWaveLayer);
        });
    });
});
