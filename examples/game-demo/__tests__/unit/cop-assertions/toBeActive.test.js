/**
 * toBeActive マッチャーの単体テスト
 * 
 * Layer が活性化しているかを判定する
 */
import { describeCop, toBeActive } from '../../../../../dist/helpers/describeCop.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    difficultySignal,
    tutorialSignal
} from '../../../js/layers.js';

// カスタムマッチャーを登録
expect.extend({ toBeActive });

// ========================================
// toBeActive の基本機能
// ========================================
describeCop('toBeActive - 基本', () => {
    use.layer([HardModeLayer, EasyModeLayer, TutorialLayer]);
    
    test('HardModeLayer が活性化している', () => {
        difficultySignal.value = 'hard';
        
        expect(HardModeLayer).toBeActive();
    });
    
    test('HardModeLayer が活性化していない', () => {
        difficultySignal.value = 'normal';
        
        expect(HardModeLayer).not.toBeActive();
    });
    
    test('EasyModeLayer が活性化している', () => {
        difficultySignal.value = 'easy';
        
        expect(EasyModeLayer).toBeActive();
    });
    
    test('TutorialLayer が活性化している', () => {
        tutorialSignal.value = true;
        
        expect(TutorialLayer).toBeActive();
    });
    
    test('TutorialLayer が活性化していない', () => {
        tutorialSignal.value = false;
        
        expect(TutorialLayer).not.toBeActive();
    });
});

// ========================================
// 複数の Layer の同時活性化
// ========================================
describeCop('toBeActive - 複数 Layer', () => {
    use.layer([HardModeLayer, TutorialLayer]);
    
    test('複数の Layer が同時に活性化できる', () => {
        difficultySignal.value = 'hard';
        tutorialSignal.value = true;
        
        expect(HardModeLayer).toBeActive();
        expect(TutorialLayer).toBeActive();
    });
    
    test('一部の Layer だけ活性化', () => {
        difficultySignal.value = 'hard';
        tutorialSignal.value = false;
        
        expect(HardModeLayer).toBeActive();
        expect(TutorialLayer).not.toBeActive();
    });
});

// ========================================
// 活性化条件のエラー検出
// ========================================
describeCop('toBeActive - 条件エラー検出', () => {
    use.layer([HardModeLayer, EasyModeLayer]);
    
    test('typo による活性化失敗を検出できる', () => {
        // "Hard" (大文字) は条件 'difficulty === "hard"' にマッチしない
        difficultySignal.value = 'Hard';
        
        expect(HardModeLayer).not.toBeActive();
        expect(EasyModeLayer).not.toBeActive();
    });
    
    test('存在しない値による活性化失敗を検出できる', () => {
        difficultySignal.value = 'unknown';
        
        expect(HardModeLayer).not.toBeActive();
        expect(EasyModeLayer).not.toBeActive();
    });
});
