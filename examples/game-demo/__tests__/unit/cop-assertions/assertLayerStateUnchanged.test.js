/**
 * assertLayerStateUnchanged のテスト
 * 
 * 関数実行中に Layer の状態（活性化、Signal、部分メソッド）が
 * 変化しないことをアサートする
 */
import { jest } from '@jest/globals';
import { 
    describeCop, 
    toBePartialMethodOf, 
    toBeActive,
    assertLayerStateUnchanged
} from '../../../../../dist/helpers/describeCop.js';
import EMA from '../../../../../dist/ema/EMA.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    TutorialLayer,
    difficultySignal,
    tutorialSignal,
    tutorialState
} from '../../../js/layers.js';

expect.extend({ toBePartialMethodOf, toBeActive });

const mockCanvas = { width: 600, height: 400 };

describe('assertLayerStateUnchanged', () => {
    
    describeCop('Layer 状態が変化しない場合', () => {
        use.layer(TutorialLayer);
        
        test('状態が変化しなければエラーにならない', () => {
            tutorialSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            
            // Layer 状態を変更しない処理
            assertLayerStateUnchanged(() => {
                enemy.x = 100;
                enemy.y = 200;
            });
        });
        
        test('Signal を読むだけなら変化しない', () => {
            tutorialSignal.value = true;
            
            assertLayerStateUnchanged(() => {
                const value = tutorialSignal.value;
                console.log('Signal value:', value);
            });
        });
    });
    
    describeCop('Signal が変化しても Layer 活性化が変わらない場合', () => {
        use.layer([TutorialLayer, HardModeLayer]);
        
        test('Signal を変更しても Layer 活性化が変わらなければエラーにならない', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'hard';  // HardModeLayer を活性化済み
            
            // Signal を同じ値に変更（Layer 活性化は変わらない）
            assertLayerStateUnchanged(() => {
                difficultySignal.value = 'hard';
            });
        });
    });
    
    describeCop('Layer が活性化した場合', () => {
        use.layer([TutorialLayer, HardModeLayer]);
        
        test('EMA.activate で Layer が活性化するとエラー', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'normal';
            
            expect(() => {
                assertLayerStateUnchanged(() => {
                    EMA.activate(HardModeLayer);
                });
            }).toThrow(/Layer 'HardMode' was activated/);
        });
        
        test('Signal による暗黙活性化でもエラー', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'normal';
            
            expect(() => {
                assertLayerStateUnchanged(() => {
                    difficultySignal.value = 'hard';
                });
            }).toThrow(/Layer 'HardMode' was activated/);
        });
    });
    
    describeCop('Layer が非活性化した場合', () => {
        use.layer([TutorialLayer, HardModeLayer]);
        
        test('EMA.deactivate で Layer が非活性化するとエラー', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'hard';  // HardModeLayer を活性化
            
            expect(() => {
                assertLayerStateUnchanged(() => {
                    EMA.deactivate(HardModeLayer);
                });
            }).toThrow(/Layer 'HardMode' was deactivated/);
        });
        
        test('Signal による暗黙非活性化でエラー', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'hard';
            
            expect(() => {
                assertLayerStateUnchanged(() => {
                    difficultySignal.value = 'normal';
                });
            }).toThrow(/Layer 'HardMode' was deactivated/);
        });
    });
    
    describeCop('部分メソッド内での副作用検出', () => {
        use.layer([TutorialLayer, HardModeLayer]);
        
        test('部分メソッド内で Layer が活性化すると検出される', () => {
            // TutorialLayer の spawn 内で Signal を変更して Layer が活性化するシナリオ
            tutorialSignal.value = true;
            difficultySignal.value = 'normal';  // HardModeLayer は非活性
            tutorialState.hasSeenFirstEnemy = false;
            
            global.game = { 
                ui: { 
                    showTutorialMessage: jest.fn(() => {
                        // 副作用: Signal を変更して HardModeLayer が活性化してしまう
                        difficultySignal.value = 'hard';
                    }) 
                } 
            };
            
            const enemy = new Enemy(mockCanvas);
            
            expect(() => {
                assertLayerStateUnchanged(() => {
                    enemy.spawn();
                });
            }).toThrow(/Layer 'HardMode' was activated/);
            
            delete global.game;
        });
    });
});
