/**
 * describeCop の Signal 復元機能のテスト
 * 
 * Signal の値がテスト間で独立していることを確認する
 */
import { describeCop, toBeActive } from '../../../../../dist/helpers/describeCop.js';
import { 
    HardModeLayer, 
    TutorialLayer,
    difficultySignal,
    tutorialSignal
} from '../../../js/layers.js';

// カスタムマッチャーを登録
expect.extend({ toBeActive });

// ========================================
// Signal 復元のテスト
// ========================================
describeCop('Signal 復元 - difficultySignal', () => {
    use.layer(HardModeLayer);
    
    test('test1: 初期状態を確認', () => {
        // difficultySignal の初期値は 'normal'
        console.log('test1: difficultySignal.value =', difficultySignal.value);
        expect(difficultySignal.value).toBe('normal');
        expect(HardModeLayer).not.toBeActive();
    });
    
    test('test2: Signal を変更', () => {
        console.log('test2 開始時: difficultySignal.value =', difficultySignal.value);
        
        difficultySignal.value = 'hard';
        
        console.log('test2 変更後: difficultySignal.value =', difficultySignal.value);
        expect(difficultySignal.value).toBe('hard');
        expect(HardModeLayer).toBeActive();
    });
    
    test('test3: Signal が初期値に戻っているか確認', () => {
        console.log('test3: difficultySignal.value =', difficultySignal.value);
        
        // test2 で 'hard' に変更されたが、初期値に戻っているはず
        expect(difficultySignal.value).toBe('normal');
        expect(HardModeLayer).not.toBeActive();
    });
});

// ========================================
// tutorialSignal の復元テスト
// ========================================
describeCop('Signal 復元 - tutorialSignal', () => {
    use.layer(TutorialLayer);
    
    test('test1: 初期状態を確認', () => {
        console.log('test1: tutorialSignal.value =', tutorialSignal.value);
        // tutorialSignal の初期値は true
        expect(tutorialSignal.value).toBe(true);
    });
    
    test('test2: Signal を変更', () => {
        console.log('test2 開始時: tutorialSignal.value =', tutorialSignal.value);
        
        tutorialSignal.value = false;
        
        console.log('test2 変更後: tutorialSignal.value =', tutorialSignal.value);
        expect(tutorialSignal.value).toBe(false);
        expect(TutorialLayer).not.toBeActive();
    });
    
    test('test3: Signal が初期値に戻っているか確認', () => {
        console.log('test3: tutorialSignal.value =', tutorialSignal.value);
        
        // test2 で false に変更されたが、初期値 true に戻っているはず
        expect(tutorialSignal.value).toBe(true);
        expect(TutorialLayer).toBeActive();
    });
});
