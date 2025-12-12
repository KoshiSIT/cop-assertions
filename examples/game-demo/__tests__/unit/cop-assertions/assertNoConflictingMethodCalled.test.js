/**
 * assertNoConflictingMethodCalled のテスト
 * 
 * 複数の層が同じメソッドを refine している場合、
 * 両方活性化している状態でそのメソッドが呼ばれたらエラーを投げる
 */
import { jest } from '@jest/globals';
import { 
    describeCop, 
    toBeActive,
    assertNoConflictingMethodCalled 
} from '../../../../../dist/helpers/describeCop.js';
import Enemy from '../../../js/Enemy.js';
import Player from '../../../js/Player.js';
import { 
    HardModeLayer, 
    EasyModeLayer,
    TutorialLayer,
    BossWaveLayer,
    difficultySignal,
    tutorialSignal,
    bossWaveSignal,
    tutorialState
} from '../../../js/layers.js';

expect.extend({ toBeActive });

const mockCanvas = { width: 600, height: 400 };

// ========================================
// 基本的な使用方法
// ========================================
describe('assertNoConflictingMethodCalled - 基本', () => {
    
    describeCop('競合するメソッドを呼ばなければ OK', () => {
        use.layer([EasyModeLayer, TutorialLayer]);
        
        test('takeDamage を呼ばなければエラーにならない', () => {
            difficultySignal.value = 'easy';
            tutorialSignal.value = true;
            
            // 両方活性化
            expect(EasyModeLayer).toBeActive();
            expect(TutorialLayer).toBeActive();
            
            const player = new Player(mockCanvas);
            
            // takeDamage は競合するが、呼ばなければ OK
            assertNoConflictingMethodCalled(() => {
                player.x = 100;
                player.y = 200;
            });
        });
    });
    
    describeCop('競合するメソッドを呼ぶとエラー', () => {
        use.layer([EasyModeLayer, TutorialLayer]);
        
        test('両方活性化中に takeDamage を呼ぶとエラー', () => {
            difficultySignal.value = 'easy';
            tutorialSignal.value = true;
            
            // game.ui のモック
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    player.takeDamage(20);
                });
            }).toThrow(/Conflicting method call detected/);
            
            delete global.game;
        });
        
        test('エラーメッセージにメソッド名と層名が含まれる', () => {
            difficultySignal.value = 'easy';
            tutorialSignal.value = true;
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    player.takeDamage(20);
                });
            }).toThrow(/takeDamage[\s\S]*EasyMode[\s\S]*TutorialMode|takeDamage[\s\S]*TutorialMode[\s\S]*EasyMode/);
            
            delete global.game;
        });
    });
});

// ========================================
// 片方だけ活性化している場合は OK
// ========================================
describe('assertNoConflictingMethodCalled - 片方のみ活性化', () => {
    
    describeCop('EasyModeLayer のみ活性化', () => {
        use.layer([EasyModeLayer, TutorialLayer]);
        
        test('片方だけ活性化なら takeDamage を呼んでも OK', () => {
            difficultySignal.value = 'easy';
            tutorialSignal.value = false;  // TutorialLayer は非活性
            
            expect(EasyModeLayer).toBeActive();
            expect(TutorialLayer).not.toBeActive();
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            
            // 片方だけなのでエラーにならない
            assertNoConflictingMethodCalled(() => {
                player.takeDamage(20);
            });
        });
    });
    
    describeCop('TutorialLayer のみ活性化', () => {
        use.layer([EasyModeLayer, TutorialLayer]);
        
        test('片方だけ活性化なら takeDamage を呼んでも OK', () => {
            difficultySignal.value = 'normal';  // EasyModeLayer は非活性
            tutorialSignal.value = true;
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            expect(EasyModeLayer).not.toBeActive();
            expect(TutorialLayer).toBeActive();
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            // 片方だけなのでエラーにならない
            assertNoConflictingMethodCalled(() => {
                player.takeDamage(20);
            });
            
            delete global.game;
        });
    });
});

// ========================================
// 複数の競合メソッド
// ========================================
describe('assertNoConflictingMethodCalled - 複数の競合メソッド', () => {
    
    describeCop('getEnemyHP の競合（HardMode + BossWave）', () => {
        use.layer([HardModeLayer, BossWaveLayer]);
        
        test('両方活性化中に getEnemyHP を呼ぶとエラー', () => {
            difficultySignal.value = 'hard';
            bossWaveSignal.value = true;
            
            expect(HardModeLayer).toBeActive();
            expect(BossWaveLayer).toBeActive();
            
            const enemy = new Enemy(mockCanvas);
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    enemy.getEnemyHP();
                });
            }).toThrow(/Conflicting method call detected/);
        });
        
        test('片方だけ活性化なら OK', () => {
            difficultySignal.value = 'hard';
            bossWaveSignal.value = false;
            
            expect(HardModeLayer).toBeActive();
            expect(BossWaveLayer).not.toBeActive();
            
            const enemy = new Enemy(mockCanvas);
            
            assertNoConflictingMethodCalled(() => {
                enemy.getEnemyHP();
            });
        });
    });
    
    describeCop('spawn の競合（Tutorial + BossWave）', () => {
        use.layer([TutorialLayer, BossWaveLayer]);
        
        test('両方活性化中に spawn を呼ぶとエラー', () => {
            tutorialSignal.value = true;
            bossWaveSignal.value = true;
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            expect(TutorialLayer).toBeActive();
            expect(BossWaveLayer).toBeActive();
            
            const enemy = new Enemy(mockCanvas);
            tutorialState.hasSeenFirstEnemy = false;
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    enemy.spawn();
                });
            }).toThrow(/spawn[\s\S]*TutorialMode[\s\S]*BossWave|spawn[\s\S]*BossWave[\s\S]*TutorialMode/);
            
            delete global.game;
        });
    });
});

// ========================================
// 3つの層が競合
// ========================================
describe('assertNoConflictingMethodCalled - 3つの層が競合', () => {
    
    describeCop('takeDamage は EasyMode, HardMode, Tutorial で競合', () => {
        use.layer([EasyModeLayer, HardModeLayer, TutorialLayer]);
        
        test('2つ活性化でエラー（Easy + Tutorial）', () => {
            difficultySignal.value = 'easy';
            tutorialSignal.value = true;
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    player.takeDamage(20);
                });
            }).toThrow(/Conflicting method call detected/);
            
            delete global.game;
        });
        
        test('2つ活性化でエラー（Hard + Tutorial）', () => {
            difficultySignal.value = 'hard';
            tutorialSignal.value = true;
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    player.takeDamage(20);
                });
            }).toThrow(/Conflicting method call detected/);
            
            delete global.game;
        });
        
        test('1つだけ活性化なら OK', () => {
            difficultySignal.value = 'normal';  // Easy, Hard 両方非活性
            tutorialSignal.value = true;
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            expect(EasyModeLayer).not.toBeActive();
            expect(HardModeLayer).not.toBeActive();
            expect(TutorialLayer).toBeActive();
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            assertNoConflictingMethodCalled(() => {
                player.takeDamage(20);
            });
            
            delete global.game;
        });
    });
});

// ========================================
// 競合がない場合
// ========================================
describe('assertNoConflictingMethodCalled - 競合がない場合', () => {
    
    describeCop('宣言した層に競合するメソッドがない', () => {
        use.layer([HardModeLayer]);  // HardModeLayer のみ
        
        test('競合する層がなければ何も起きない', () => {
            difficultySignal.value = 'hard';
            
            const enemy = new Enemy(mockCanvas);
            
            // HardModeLayer だけなので競合なし
            assertNoConflictingMethodCalled(() => {
                enemy.getEnemyHP();
            });
        });
    });
});

// ========================================
// fn() 内で層が活性化する場合
// ========================================
describe('assertNoConflictingMethodCalled - 途中で活性化', () => {
    
    describeCop('fn() 内で層が活性化してから競合メソッドを呼ぶ', () => {
        use.layer([EasyModeLayer, TutorialLayer]);
        
        test('途中で活性化しても検出できる', () => {
            difficultySignal.value = 'easy';
            tutorialSignal.value = false;  // 最初は TutorialLayer 非活性
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    // 途中で TutorialLayer を活性化
                    tutorialSignal.value = true;
                    
                    // その後に競合メソッドを呼ぶ
                    player.takeDamage(20);
                });
            }).toThrow(/Conflicting method call detected/);
            
            delete global.game;
        });
        
        test('事前に両方活性化していても検出できる', () => {
            difficultySignal.value = 'easy';
            tutorialSignal.value = true;  // 事前に両方活性化
            
            global.game = {
                ui: { showTutorialMessage: jest.fn() }
            };
            
            const player = new Player(mockCanvas);
            player.hp = 100;
            player.maxHP = 100;
            tutorialState.hasTakenDamage = false;
            
            expect(() => {
                assertNoConflictingMethodCalled(() => {
                    player.takeDamage(20);
                });
            }).toThrow(/Conflicting method call detected/);
            
            delete global.game;
        });
    });
});
