/**
 * ケーススタディ: 暗黙的活性化による予期しないエラー
 * 
 * layers.jsをインポートすると、TutorialLayerが自動的にactiveになる。
 * TutorialLayerのspawn()部分メソッドは game.ui を参照するため、
 * game.ui が存在しない状態でテストするとエラーになる。
 */
import Enemy from '../../js/Enemy.js';
import { 
    TutorialLayer,
    HardModeLayer 
} from '../../js/layers.js';  // ← インポート時にTutorialLayerがactive

describe('暗黙的活性化による予期しないエラー', () => {
    const mockCanvas = { width: 600, height: 400 };

    // TutorialLayerがactiveなので、spawn()の部分メソッドが呼ばれる
    // game.ui.showTutorialMessage() を呼ぼうとしてエラーになる
    test('ベースメソッドのspawnをテストしたいが、TutorialLayerが干渉する', () => {
        const enemy = new Enemy(mockCanvas);
        
        // 期待: ベースのspawn()だけ呼ばれる
        // 実際: TutorialLayerの部分メソッドも呼ばれ、
        //       game.ui が undefined でエラー
        enemy.spawn();
        
        expect(enemy.enemies.length).toBe(1);
    });
});
