/**
 * 新 API（expect 形式）のテスト
 * 
 * toTransitionLayerState, toKeepLayerStateUnchanged, toCallConflictingMethod
 */

import { 
    describeCop,
    toTransitionLayerState,
    toKeepLayerStateUnchanged,
    toCallConflictingMethod
} from '../../../../../dist/helpers/describeCop.js';
import EMA from '../../../../../dist/ema/EMA.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    TutorialLayer,
    BossWaveLayer,
    difficultySignal,
    tutorialSignal,
    bossWaveSignal
} from '../../../js/layers.js';

expect.extend({ toTransitionLayerState, toKeepLayerStateUnchanged, toCallConflictingMethod });

const mockCanvas = { width: 600, height: 400 };

describe('新 API - expect 形式', () => {
    
    describe('toTransitionLayerState', () => {
        
        describeCop('層の状態遷移', () => {
            use.layer([HardModeLayer, TutorialLayer]);
            
            test('Signal による活性化を検証', () => {
                tutorialSignal.value = true;
                difficultySignal.value = 'normal';
                
                expect(() => {
                    difficultySignal.value = 'hard';
                }).toTransitionLayerState({
                    from: { active: [TutorialLayer], inactive: [HardModeLayer] },
                    to: { active: [TutorialLayer, HardModeLayer], inactive: [] }
                });
            });
            
            test('Signal による非活性化を検証', () => {
                tutorialSignal.value = true;
                difficultySignal.value = 'hard';
                
                expect(() => {
                    difficultySignal.value = 'normal';
                }).toTransitionLayerState({
                    from: { active: [TutorialLayer, HardModeLayer] },
                    to: { inactive: [HardModeLayer] }
                });
            });
            
            test('期待と違う遷移は失敗', () => {
                tutorialSignal.value = true;
                difficultySignal.value = 'normal';
                
                expect(() => {
                    expect(() => {
                        difficultySignal.value = 'hard';
                    }).toTransitionLayerState({
                        from: { active: [TutorialLayer] },
                        to: { inactive: [HardModeLayer] }  // 間違い: 実際は active になる
                    });
                }).toThrow(/should be inactive after execution/);
            });
        });
    });
    
    describe('toKeepLayerStateUnchanged', () => {
        
        describeCop('状態が変わらない場合', () => {
            use.layer(TutorialLayer);
            
            test('通常の処理では状態は変わらない', () => {
                tutorialSignal.value = true;
                
                const enemy = new Enemy(mockCanvas);
                
                expect(() => {
                    enemy.x = 100;
                    enemy.y = 200;
                }).toKeepLayerStateUnchanged();
            });
            
            test('状態が変わると失敗', () => {
                tutorialSignal.value = true;
                
                expect(() => {
                    expect(() => {
                        tutorialSignal.value = false;
                    }).toKeepLayerStateUnchanged();
                }).toThrow(/layer state changed/i);
            });
        });
    });
    
    describe('toCallConflictingMethod', () => {
        
        describeCop('競合がない場合', () => {
            use.layer([HardModeLayer, TutorialLayer]);
            
            test('1つの層だけ活性化なら競合しない', () => {
                difficultySignal.value = 'hard';
                tutorialSignal.value = false;
                
                const enemy = new Enemy(mockCanvas);
                
                expect(() => {
                    enemy.getEnemyHP();
                }).not.toCallConflictingMethod();
            });
        });
        
        describeCop('競合がある場合', () => {
            use.layer([HardModeLayer, BossWaveLayer]);
            
            test('複数の層が同じメソッドを活性化すると競合', () => {
                difficultySignal.value = 'hard';
                bossWaveSignal.value = true;
                
                const enemy = new Enemy(mockCanvas);
                
                // getSpeed は HardModeLayer と BossWaveLayer の両方で定義されている
                expect(() => {
                    enemy.getSpeed();
                }).toCallConflictingMethod();
            });
        });
    });
});
