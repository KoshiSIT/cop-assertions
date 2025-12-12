/**
 * assertLayerStateTransition のテスト
 * 
 * 処理の実行前後で Layer の活性化状態が期待通りに遷移することを検証
 */
import { jest } from '@jest/globals';
import { 
    describeCop, 
    toBeActive,
    assertLayerStateTransition 
} from '../../../../../dist/helpers/describeCop.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    BossWaveLayer,
    difficultySignal,
    tutorialSignal,
    bossWaveSignal
} from '../../../js/layers.js';

expect.extend({ toBeActive });

const mockCanvas = { width: 600, height: 400 };

// ========================================
// 基本的な使用方法
// ========================================
describe('assertLayerStateTransition - 基本', () => {
    
    describeCop('単一 Layer の遷移', () => {
        use.layer([HardModeLayer, EasyModeLayer]);
        
        test('inactive → active への遷移', () => {
            difficultySignal.value = 'normal';
            
            assertLayerStateTransition(
                { active: [], inactive: [HardModeLayer] },
                { active: [HardModeLayer], inactive: [] },
                () => {
                    difficultySignal.value = 'hard';
                }
            );
        });
        
        test('active → inactive への遷移', () => {
            difficultySignal.value = 'hard';
            
            assertLayerStateTransition(
                { active: [HardModeLayer], inactive: [] },
                { active: [], inactive: [HardModeLayer] },
                () => {
                    difficultySignal.value = 'normal';
                }
            );
        });
        
        test('状態が変わらない場合（active のまま）', () => {
            difficultySignal.value = 'hard';
            
            assertLayerStateTransition(
                { active: [HardModeLayer], inactive: [] },
                { active: [HardModeLayer], inactive: [] },
                () => {
                    // 何もしない
                }
            );
        });
        
        test('状態が変わらない場合（inactive のまま）', () => {
            difficultySignal.value = 'normal';
            
            assertLayerStateTransition(
                { active: [], inactive: [HardModeLayer] },
                { active: [], inactive: [HardModeLayer] },
                () => {
                    // 何もしない
                }
            );
        });
    });
});

// ========================================
// 複数 Layer の遷移
// ========================================
describe('assertLayerStateTransition - 複数 Layer', () => {
    
    describeCop('複数 Layer の同時遷移', () => {
        use.layer([HardModeLayer, TutorialLayer, BossWaveLayer]);
        
        test('TutorialLayer → HardModeLayer への切り替え', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'normal';
            
            assertLayerStateTransition(
                { active: [TutorialLayer], inactive: [HardModeLayer] },
                { active: [TutorialLayer, HardModeLayer], inactive: [] },
                () => {
                    difficultySignal.value = 'hard';
                }
            );
        });
        
        test('複数 Layer を同時に活性化', () => {
            tutorialSignal.value = false;
            difficultySignal.value = 'normal';
            bossWaveSignal.value = false;
            
            assertLayerStateTransition(
                { active: [], inactive: [TutorialLayer, HardModeLayer, BossWaveLayer] },
                { active: [TutorialLayer, HardModeLayer, BossWaveLayer], inactive: [] },
                () => {
                    tutorialSignal.value = true;
                    difficultySignal.value = 'hard';
                    bossWaveSignal.value = true;
                }
            );
        });
        
        test('一部だけ遷移', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'normal';
            bossWaveSignal.value = false;
            
            assertLayerStateTransition(
                { active: [TutorialLayer], inactive: [HardModeLayer, BossWaveLayer] },
                { active: [TutorialLayer, HardModeLayer], inactive: [BossWaveLayer] },
                () => {
                    difficultySignal.value = 'hard';
                    // bossWaveSignal は変更しない
                }
            );
        });
    });
});

// ========================================
// before 状態が一致しない場合のエラー
// ========================================
describe('assertLayerStateTransition - before 状態エラー', () => {
    
    describeCop('before の active が一致しない', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('active であるべきが inactive だとエラー', () => {
            difficultySignal.value = 'normal';  // HardModeLayer は inactive
            
            expect(() => {
                assertLayerStateTransition(
                    { active: [HardModeLayer], inactive: [] },  // 期待: active
                    { active: [HardModeLayer], inactive: [] },
                    () => {}
                );
            }).toThrow(/HardMode should be active before execution, but was inactive/);
        });
        
        test('inactive であるべきが active だとエラー', () => {
            difficultySignal.value = 'hard';  // HardModeLayer は active
            
            expect(() => {
                assertLayerStateTransition(
                    { active: [], inactive: [HardModeLayer] },  // 期待: inactive
                    { active: [], inactive: [HardModeLayer] },
                    () => {}
                );
            }).toThrow(/HardMode should be inactive before execution, but was active/);
        });
    });
});

// ========================================
// after 状態が一致しない場合のエラー
// ========================================
describe('assertLayerStateTransition - after 状態エラー', () => {
    
    describeCop('after の active が一致しない', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('active になるべきが inactive だとエラー', () => {
            difficultySignal.value = 'normal';
            
            expect(() => {
                assertLayerStateTransition(
                    { active: [], inactive: [HardModeLayer] },
                    { active: [HardModeLayer], inactive: [] },  // 期待: active になる
                    () => {
                        // Signal を変更しない → HardModeLayer は inactive のまま
                    }
                );
            }).toThrow(/HardMode should be active after execution, but was inactive/);
        });
        
        test('inactive になるべきが active だとエラー', () => {
            difficultySignal.value = 'hard';
            
            expect(() => {
                assertLayerStateTransition(
                    { active: [HardModeLayer], inactive: [] },
                    { active: [], inactive: [HardModeLayer] },  // 期待: inactive になる
                    () => {
                        // Signal を変更しない → HardModeLayer は active のまま
                    }
                );
            }).toThrow(/HardMode should be inactive after execution, but was active/);
        });
    });
});

// ========================================
// 予期しない Layer の変化
// ========================================
describe('assertLayerStateTransition - 予期しない変化', () => {
    
    describeCop('意図しない Layer が活性化', () => {
        use.layer([HardModeLayer, EasyModeLayer, TutorialLayer]);
        
        test('予期しない Layer が活性化するとエラー', () => {
            difficultySignal.value = 'normal';
            tutorialSignal.value = false;
            
            expect(() => {
                assertLayerStateTransition(
                    { active: [], inactive: [HardModeLayer] },
                    { active: [HardModeLayer], inactive: [] },  // HardModeLayer だけ活性化を期待
                    () => {
                        difficultySignal.value = 'hard';
                        tutorialSignal.value = true;  // 予期しない TutorialLayer も活性化
                    }
                );
            }).toThrow(/TutorialMode was unexpectedly activated/);
        });
        
        test('予期しない Layer が非活性化するとエラー', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'hard';
            
            expect(() => {
                assertLayerStateTransition(
                    { active: [TutorialLayer, HardModeLayer], inactive: [] },
                    // HardModeLayer だけ非活性化を期待（TutorialLayer は active のまま）
                    // after に TutorialLayer を指定しないと、予期しない変化として検出される
                    { active: [], inactive: [HardModeLayer] },
                    () => {
                        difficultySignal.value = 'normal';
                        tutorialSignal.value = false;  // 予期しない TutorialLayer も非活性化
                    }
                );
            }).toThrow(/TutorialMode was unexpectedly deactivated/);
        });
    });
});

// ========================================
// 実際のユースケース
// ========================================
describe('assertLayerStateTransition - ユースケース', () => {
    
    describeCop('ゲーム開始シナリオ', () => {
        use.layer([TutorialLayer, HardModeLayer, EasyModeLayer]);
        
        test('ゲーム開始時: 全て inactive → TutorialLayer active', () => {
            tutorialSignal.value = false;
            difficultySignal.value = 'normal';
            
            assertLayerStateTransition(
                { active: [], inactive: [TutorialLayer, HardModeLayer, EasyModeLayer] },
                { active: [TutorialLayer], inactive: [HardModeLayer, EasyModeLayer] },
                () => {
                    tutorialSignal.value = true;
                }
            );
        });
        
        test('チュートリアル完了後: TutorialLayer + EasyModeLayer', () => {
            tutorialSignal.value = true;
            difficultySignal.value = 'normal';
            
            assertLayerStateTransition(
                { active: [TutorialLayer], inactive: [EasyModeLayer] },
                { active: [TutorialLayer, EasyModeLayer], inactive: [] },
                () => {
                    difficultySignal.value = 'easy';
                }
            );
        });
    });
    
    describeCop('難易度変更シナリオ', () => {
        use.layer([HardModeLayer, EasyModeLayer]);
        
        test('Easy → Hard への切り替え', () => {
            difficultySignal.value = 'easy';
            
            assertLayerStateTransition(
                { active: [EasyModeLayer], inactive: [HardModeLayer] },
                { active: [HardModeLayer], inactive: [EasyModeLayer] },
                () => {
                    difficultySignal.value = 'hard';
                }
            );
        });
        
        test('Hard → Normal（両方 inactive）への切り替え', () => {
            difficultySignal.value = 'hard';
            
            assertLayerStateTransition(
                { active: [HardModeLayer], inactive: [EasyModeLayer] },
                { active: [], inactive: [HardModeLayer, EasyModeLayer] },
                () => {
                    difficultySignal.value = 'normal';
                }
            );
        });
    });
});

// ========================================
// 宣言していない Layer を指定した場合のエラー
// ========================================
describe('assertLayerStateTransition - 宣言チェック', () => {
    
    describeCop('before に宣言していない Layer を指定', () => {
        use.layer([HardModeLayer]);  // TutorialLayer は宣言していない
        
        test('before.active に宣言していない Layer を指定するとエラー', () => {
            expect(() => {
                assertLayerStateTransition(
                    { active: [TutorialLayer], inactive: [] },  // TutorialLayer は未宣言
                    { active: [], inactive: [] },
                    () => {}
                );
            }).toThrow(/The following layers are not declared with use\.layer\(\)/);
        });
        
        test('before.inactive に宣言していない Layer を指定するとエラー', () => {
            expect(() => {
                assertLayerStateTransition(
                    { active: [], inactive: [TutorialLayer] },  // TutorialLayer は未宣言
                    { active: [], inactive: [] },
                    () => {}
                );
            }).toThrow(/TutorialMode/);
        });
    });
    
    describeCop('after に宣言していない Layer を指定', () => {
        use.layer([HardModeLayer]);  // BossWaveLayer は宣言していない
        
        test('after.active に宣言していない Layer を指定するとエラー', () => {
            expect(() => {
                assertLayerStateTransition(
                    { active: [], inactive: [] },
                    { active: [BossWaveLayer], inactive: [] },  // BossWaveLayer は未宣言
                    () => {}
                );
            }).toThrow(/BossWave/);
        });
        
        test('after.inactive に宣言していない Layer を指定するとエラー', () => {
            expect(() => {
                assertLayerStateTransition(
                    { active: [], inactive: [] },
                    { active: [], inactive: [BossWaveLayer] },  // BossWaveLayer は未宣言
                    () => {}
                );
            }).toThrow(/BossWave/);
        });
    });
    
    describeCop('複数の未宣言 Layer を指定', () => {
        use.layer([HardModeLayer]);  // TutorialLayer, BossWaveLayer は宣言していない
        
        test('複数の未宣言 Layer がエラーメッセージに含まれる', () => {
            expect(() => {
                assertLayerStateTransition(
                    { active: [TutorialLayer], inactive: [BossWaveLayer] },
                    { active: [], inactive: [] },
                    () => {}
                );
            }).toThrow(/TutorialMode[\s\S]*BossWave|BossWave[\s\S]*TutorialMode/);
        });
        
        test('エラーメッセージに宣言済み Layer が表示される', () => {
            expect(() => {
                assertLayerStateTransition(
                    { active: [TutorialLayer], inactive: [] },
                    { active: [], inactive: [] },
                    () => {}
                );
            }).toThrow(/Declared layers:.*HardMode/);
        });
    });
    
    describeCop('宣言済み Layer のみ指定した場合はエラーにならない', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('宣言済み Layer のみならエラーにならない', () => {
            difficultySignal.value = 'normal';
            tutorialSignal.value = false;
            
            // エラーが発生しないことを確認
            assertLayerStateTransition(
                { active: [], inactive: [HardModeLayer, TutorialLayer] },
                { active: [HardModeLayer], inactive: [TutorialLayer] },
                () => {
                    difficultySignal.value = 'hard';
                }
            );
        });
    });
});
