/**
 * toHaveAllExecutedBehaviorOf マッチャーのテスト
 * 
 * 全ての呼び出しが指定した層の振る舞いを実行したことを検証する
 */

import { 
    describeCop, 
    toHaveAllExecutedBehaviorOf,
    toHaveLastExecutedBehaviorOf
} from '../../../../../dist/helpers/describeCop.js';
import EMA from '../../../../../dist/ema/EMA.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    TutorialLayer,
    difficultySignal,
    tutorialSignal
} from '../../../js/layers.js';

expect.extend({ toHaveAllExecutedBehaviorOf, toHaveLastExecutedBehaviorOf });

const mockCanvas = { width: 600, height: 400 };

describe('toHaveAllExecutedBehaviorOf', () => {
    
    describeCop('全ての呼び出しが同じ層の振る舞い', () => {
        use.layer(HardModeLayer);
        
        test('全て HardModeLayer の振る舞いで成功', () => {
            difficultySignal.value = 'hard';
            
            const enemy = new Enemy(mockCanvas);
            
            // 3回呼び出し
            enemy.getEnemyHP();
            enemy.getEnemyHP();
            enemy.getEnemyHP();
            
            expect(enemy.getEnemyHP).toHaveAllExecutedBehaviorOf(HardModeLayer);
        });
        
        test('途中で層が変わると失敗', () => {
            difficultySignal.value = 'hard';
            
            const enemy = new Enemy(mockCanvas);
            
            // HardModeLayer で呼び出し
            enemy.getEnemyHP();
            enemy.getEnemyHP();
            
            // 層を非活性化
            difficultySignal.value = 'normal';
            
            // オリジナルで呼び出し
            enemy.getEnemyHP();
            
            expect(() => {
                expect(enemy.getEnemyHP).toHaveAllExecutedBehaviorOf(HardModeLayer);
            }).toThrow(/executed different behavior/);
        });
    });
    
    describeCop('オリジナルメソッドの場合', () => {
        use.layer(HardModeLayer);
        
        test('層が非活性なら null で検証', () => {
            difficultySignal.value = 'normal';
            
            const enemy = new Enemy(mockCanvas);
            
            enemy.getEnemyHP();
            enemy.getEnemyHP();
            
            // null = オリジナル（層なし）
            expect(enemy.getEnemyHP).toHaveAllExecutedBehaviorOf(null);
        });
    });
    
    describeCop('複数の層を使う場合', () => {
        use.layer([HardModeLayer, TutorialLayer]);
        
        test('異なる層が混在するとエラー出力にトレースが含まれる', () => {
            const enemy = new Enemy(mockCanvas);
            
            // HardModeLayer で呼び出し
            difficultySignal.value = 'hard';
            tutorialSignal.value = false;
            enemy.getEnemyHP();
            
            // オリジナルで呼び出し
            difficultySignal.value = 'normal';
            enemy.getEnemyHP();
            
            // 再度 HardModeLayer で呼び出し
            difficultySignal.value = 'hard';
            enemy.getEnemyHP();
            
            expect(() => {
                expect(enemy.getEnemyHP).toHaveAllExecutedBehaviorOf(HardModeLayer);
            }).toThrow(/Trace:/);
        });
    });
    
    describeCop('.not の場合', () => {
        use.layer(HardModeLayer);
        
        test('全てが同じ層なら .not で失敗', () => {
            difficultySignal.value = 'hard';
            
            const enemy = new Enemy(mockCanvas);
            
            enemy.getEnemyHP();
            enemy.getEnemyHP();
            
            expect(() => {
                expect(enemy.getEnemyHP).not.toHaveAllExecutedBehaviorOf(HardModeLayer);
            }).toThrow(/NOT all calls to execute behavior/);
        });
        
        test('異なる層が混在すれば .not で成功', () => {
            const enemy = new Enemy(mockCanvas);
            
            // HardModeLayer で呼び出し
            difficultySignal.value = 'hard';
            enemy.getEnemyHP();
            
            // オリジナルで呼び出し
            difficultySignal.value = 'normal';
            enemy.getEnemyHP();
            
            expect(enemy.getEnemyHP).not.toHaveAllExecutedBehaviorOf(HardModeLayer);
        });
    });
});
