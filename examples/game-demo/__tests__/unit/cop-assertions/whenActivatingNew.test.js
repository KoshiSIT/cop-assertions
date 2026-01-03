/**
 * toChangeOtherLayersWhenActivating / toChangeOtherLayersWhenDeactivating マッチャーのテスト
 * 
 * 構文: expect(() => { ... }).not.toChangeOtherLayersWhenActivating(Layer)
 */

import { 
    describeCop,
    toChangeOtherLayersWhenActivating,
    toChangeOtherLayersWhenDeactivating
} from '../../../../../dist/helpers/describeCop.js';
import EMA from '../../../../../dist/ema/EMA.js';
import { 
    HardModeLayer, 
    TutorialLayer,
    difficultySignal,
    tutorialSignal
} from '../../../js/layers.js';

expect.extend({ toChangeOtherLayersWhenActivating, toChangeOtherLayersWhenDeactivating });

describe('toChangeOtherLayersWhenActivating', () => {
    
    describeCop('EMA.activate による活性化', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('他の層が変わらない場合は .not で成功', () => {
            expect(() => {
                EMA.activate(HardModeLayer);
            }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
        });
    });
    
    describeCop('Signal による活性化', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('Signal で活性化しても検出できる', () => {
            difficultySignal.value = 'normal';  // 初期状態
            
            expect(() => {
                difficultySignal.value = 'hard';  // Signal で活性化
            }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
        });
        
        test('スコープ内のメソッド呼び出しで活性化しても検出できる', () => {
            difficultySignal.value = 'normal';
            
            // 層を活性化する関数
            function activateHardMode() {
                difficultySignal.value = 'hard';
            }
            
            expect(() => {
                activateHardMode();  // 関数内で活性化
            }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
        });
        
        test('他の層が変わった場合は .not で失敗', () => {
            // TutorialLayer の enter で HardMode を操作するようにモック
            const deployedLayers = EMA._deployedLayers;
            const tutorialDeployed = deployedLayers.find(l => l.__original__ === TutorialLayer);
            
            const originalEnter = tutorialDeployed._enter;
            tutorialDeployed._enter = function() {
                originalEnter.call(this);
                // 副作用: HardMode を非活性化
                difficultySignal.value = 'normal';
            };
            
            try {
                difficultySignal.value = 'hard';  // HardMode を活性化
                tutorialSignal.value = false;  // Tutorial は非活性化
                
                expect(() => {
                    expect(() => {
                        tutorialSignal.value = true;  // Tutorial を活性化
                    }).not.toChangeOtherLayersWhenActivating(TutorialLayer);
                }).toThrow(/HardMode/);
            } finally {
                tutorialDeployed._enter = originalEnter;
            }
        });
    });
    
    describeCop('層が活性化されなかった場合', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('活性化されなかったら .not で成功（変化なし）', () => {
            difficultySignal.value = 'hard';  // 既に活性化済み
            
            expect(() => {
                // 何もしない
            }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
        });
    });
});

describe('toChangeOtherLayersWhenDeactivating', () => {
    
    describeCop('EMA.deactivate による非活性化', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('他の層が変わらない場合は .not で成功', () => {
            EMA.activate(HardModeLayer);
            
            expect(() => {
                EMA.deactivate(HardModeLayer);
            }).not.toChangeOtherLayersWhenDeactivating(HardModeLayer);
        });
    });
    
    describeCop('Signal による非活性化', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('Signal で非活性化しても検出できる', () => {
            difficultySignal.value = 'hard';  // 活性化
            
            expect(() => {
                difficultySignal.value = 'normal';  // Signal で非活性化
            }).not.toChangeOtherLayersWhenDeactivating(HardModeLayer);
        });
        
        test('スコープ内のメソッド呼び出しで非活性化しても検出できる', () => {
            difficultySignal.value = 'hard';
            
            function deactivateHardMode() {
                difficultySignal.value = 'normal';
            }
            
            expect(() => {
                deactivateHardMode();  // 関数内で非活性化
            }).not.toChangeOtherLayersWhenDeactivating(HardModeLayer);
        });
    });
});
