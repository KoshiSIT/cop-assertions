/**
 * describeCop の単体テスト
 * 
 * Layer を分離した環境でテストを実行する
 */
import { describeCop, toBePartialMethodOf, toBeActive } from '../../../../../dist/helpers/describeCop.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    difficultySignal,
    tutorialSignal
} from '../../../js/layers.js';

// カスタムマッチャーを登録
expect.extend({ toBePartialMethodOf, toBeActive });

const mockCanvas = { width: 600, height: 400 };

// ========================================
// describeCop の基本機能
// ========================================
describeCop('describeCop - 基本機能', () => {
    use.layer(HardModeLayer);
    
    test('use.layer で指定した Layer の環境でテストできる', () => {
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(mockCanvas);
        expect(enemy.getEnemyHP()).toBe(3);
    });
    
    test('Signal の値がテスト間で独立する', () => {
        // 前のテストで 'hard' に変更されたが、ここでは初期値に戻っている
        expect(difficultySignal.value).toBe('normal');
    });
});

// ========================================
// 指定外の Layer の影響排除
// ========================================
describeCop('describeCop - Layer 分離', () => {
    use.layer(HardModeLayer);
    
    test('指定外の Layer（TutorialLayer）の影響を受けない', () => {
        // tutorialSignal は true（初期値）なので通常なら TutorialLayer が活性化
        // しかし use.layer で指定していないので影響しない
        
        difficultySignal.value = 'hard';
        tutorialSignal.value = true;
        
        const enemy = new Enemy(mockCanvas);
        
        // HardModeLayer の部分メソッドだけが機能
        expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
        
        // spawn は TutorialLayer の部分メソッドだが、インストールされていない
        expect(enemy.spawn).not.toBePartialMethodOf(TutorialLayer);
    });
});

// ========================================
// 複数の Layer を使用
// ========================================
describeCop('describeCop - 複数 Layer', () => {
    use.layer([HardModeLayer, TutorialLayer]);
    
    test('複数の Layer を同時に使用できる', () => {
        difficultySignal.value = 'hard';
        tutorialSignal.value = true;
        
        const enemy = new Enemy(mockCanvas);
        
        // 両方の Layer の部分メソッドがインストールされている
        expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
        expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
    });
});
