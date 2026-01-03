/**
 * toHaveUsedConflictResolution マッチャーのテスト
 * 
 * メソッドがコンフリクト解決を経由したことを検証する
 */

import { 
    describeCop, 
    toHaveUsedConflictResolution,
    toHaveLastExecutedBehaviorOf
} from '../../../../../dist/helpers/describeCop.js';
import EMA from '../../../../../dist/ema/EMA.js';
import Enemy from '../../../js/Enemy.js';
import { 
    HardModeLayer, 
    BossWaveLayer,
    difficultySignal,
    bossWaveSignal
} from '../../../js/layers.js';

expect.extend({ toHaveUsedConflictResolution, toHaveLastExecutedBehaviorOf });

const mockCanvas = { width: 600, height: 400 };

describe('toHaveUsedConflictResolution', () => {
    
    describeCop('コンフリクト解決が設定されている場合', () => {
        use.layer([HardModeLayer, BossWaveLayer]);
        
        beforeEach(() => {
            // chain モードを有効化（コンフリクト解決に必要）
            EMA.config({ proceedMode: 'chain' });
            
            // getSpeed に対してコンフリクト解決を設定
            EMA.resolveConflict(
                Enemy.prototype,
                'getSpeed',
                [HardModeLayer, BossWaveLayer],
                (partialMethods, originalMethod) => {
                    return function() {
                        // 両方の結果を足す
                        let result = 0;
                        if (partialMethods.HardMode) {
                            result += partialMethods.HardMode.call(this);
                        }
                        if (partialMethods.BossWave) {
                            result += partialMethods.BossWave.call(this);
                        }
                        return result;
                    };
                }
            );
        });
        
        afterEach(() => {
            EMA.clearConflictResolutions();
            EMA.config({ proceedMode: 'original' });
        });
        
        test('両方の層がアクティブならコンフリクト解決が使われる', () => {
            difficultySignal.value = 'hard';
            bossWaveSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            const result = enemy.getSpeed();
            
            // コンフリクト解決のコールバック: 3 + 3.5 = 6.5
            expect(result).toBe(6.5);
            expect(enemy.getSpeed).toHaveUsedConflictResolution();
        });
        
        test('1つの層だけアクティブでも resolveConflict が設定されていればコンフリクト解決が使われる', () => {
            // resolveConflict が設定されている場合、1つの層だけでもコールバックが呼ばれる
            difficultySignal.value = 'hard';
            bossWaveSignal.value = false;
            
            const enemy = new Enemy(mockCanvas);
            const result = enemy.getSpeed();
            
            // HardMode だけアクティブ: partialMethods = { HardMode: fn }
            // コールバックは 0 + 3 = 3 を返す
            expect(result).toBe(3);
            expect(enemy.getSpeed).toHaveUsedConflictResolution();
        });
        
        test('どちらの層も非アクティブならコンフリクト解決は使われない', () => {
            difficultySignal.value = 'normal';
            bossWaveSignal.value = false;
            
            const enemy = new Enemy(mockCanvas);
            enemy.getSpeed();
            
            expect(enemy.getSpeed).not.toHaveUsedConflictResolution();
        });
    });
    
    describeCop('コンフリクト解決が設定されていない場合', () => {
        use.layer([HardModeLayer, BossWaveLayer]);
        
        test('両方アクティブでも resolveConflict がなければ使われない', () => {
            difficultySignal.value = 'hard';
            bossWaveSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            
            // getEnemyHP には resolveConflict が設定されていない
            enemy.getEnemyHP();
            
            expect(enemy.getEnemyHP).not.toHaveUsedConflictResolution();
        });
    });
    
    describeCop('.not の場合', () => {
        use.layer([HardModeLayer, BossWaveLayer]);
        
        beforeEach(() => {
            EMA.resolveConflict(
                Enemy.prototype,
                'getSpeed',
                [HardModeLayer, BossWaveLayer],
                (partialMethods, originalMethod) => {
                    return function() {
                        return 999;
                    };
                }
            );
        });
        
        afterEach(() => {
            EMA.clearConflictResolutions();
        });
        
        test('コンフリクト解決が使われたのに .not で検証すると失敗', () => {
            difficultySignal.value = 'hard';
            bossWaveSignal.value = true;
            
            const enemy = new Enemy(mockCanvas);
            enemy.getSpeed();
            
            expect(() => {
                expect(enemy.getSpeed).not.toHaveUsedConflictResolution();
            }).toThrow(/NOT to use conflict resolution/);
        });
    });
});
