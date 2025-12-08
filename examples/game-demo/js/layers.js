/**
 * COP Difficulty Layers with Partial Methods and Implicit Activation
 * Using EMA.js Signal-based layer activation
 * 
 * Key COP Features:
 * 1. Partial Methods - Replace base behavior completely
 * 2. Implicit Activation - Layers activate based on Signal conditions
 * 3. Clean Separation - Difficulty logic separated from base game code
 */
import { EMA, Layer, Signal } from '../../../dist/ema/index.js';
import Player from './Player.js';
import Enemy from './Enemy.js';
import UI from './UI.js';
import Game from './Game.js';

// ========================================
// Signal Definition for Implicit Activation
// ========================================
const difficultySignal = new Signal('normal', 'difficulty');

// Expose signal globally for layer conditions
window.difficulty = difficultySignal.value;

// Update global variable when signal changes
difficultySignal.on((value) => {
    window.difficulty = value;
});

// ========================================
// Easy Mode Layer Definition
// ========================================
const EasyModeLayer = {
    name: 'EasyMode',
    condition: 'difficulty === "easy"',
    enter: function() {},
    exit: function() {}
};

// Complete replacement: Enemy spawn interval
EMA.addPartialMethod(EasyModeLayer, Enemy.prototype, 'getSpawnInterval', function() {
    return 90;  // Easy: slower spawning (vs 60 normal)
});

// Complete replacement: Enemy speed
EMA.addPartialMethod(EasyModeLayer, Enemy.prototype, 'getSpeed', function() {
    return 1.5;  // Easy: slower enemies (vs 2 normal)
});

// Complete replacement: Enemy HP
EMA.addPartialMethod(EasyModeLayer, Enemy.prototype, 'getEnemyHP', function() {
    return 1;  // Easy: weak enemies
});

// Complete replacement: Player max HP
EMA.addPartialMethod(EasyModeLayer, Player.prototype, 'getMaxHP', function() {
    return 150;  // Easy: more HP (vs 100 normal)
});

// Complete replacement: takeDamage - Less damage in Easy mode
EMA.addPartialMethod(EasyModeLayer, Player.prototype, 'takeDamage', function(amount) {
    const reducedDamage = Math.floor(amount * 0.5);  // 50% damage
    this.hp -= reducedDamage;
    if (this.hp < 0) this.hp = 0;
    return this.hp;
});

// Complete replacement: Score multiplier
EMA.addPartialMethod(EasyModeLayer, Game.prototype, 'getScoreMultiplier', function() {
    return 0.5;  // Easy: lower score reward
});

EMA.deploy(EasyModeLayer);

// ========================================
// Hard Mode Layer Definition
// ========================================
const HardModeLayer = {
    name: 'HardMode',
    condition: 'difficulty === "hard"',
    enter: function() {},
    exit: function() {}
};

// Complete replacement: Enemy spawn interval
EMA.addPartialMethod(HardModeLayer, Enemy.prototype, 'getSpawnInterval', function() {
    return 30;  // Hard: faster spawning (vs 60 normal)
});

// Complete replacement: Enemy speed
EMA.addPartialMethod(HardModeLayer, Enemy.prototype, 'getSpeed', function() {
    return 3;  // Hard: faster enemies (vs 2 normal)
});

// Complete replacement: Enemy HP
EMA.addPartialMethod(HardModeLayer, Enemy.prototype, 'getEnemyHP', function() {
    return 3;  // Hard: tough enemies (3 hits to kill)
});

// Complete replacement: Player max HP
EMA.addPartialMethod(HardModeLayer, Player.prototype, 'getMaxHP', function() {
    return 50;  // Hard: less HP (vs 100 normal)
});

// Complete replacement: takeDamage - More damage in Hard mode
EMA.addPartialMethod(HardModeLayer, Player.prototype, 'takeDamage', function(amount) {
    const increasedDamage = Math.floor(amount * 1.5);  // 150% damage
    this.hp -= increasedDamage;
    if (this.hp < 0) this.hp = 0;
    return this.hp;
});

// Complete replacement: Score multiplier
EMA.addPartialMethod(HardModeLayer, Game.prototype, 'getScoreMultiplier', function() {
    return 2.0;  // Hard: higher score reward
});

// Complete replacement: Force hide hints
EMA.addPartialMethod(HardModeLayer, UI.prototype, 'setHintVisibility', function(visible) {
    this.showHints = false;
    this.hintElement.classList.add('hidden');
});

EMA.deploy(HardModeLayer);

// ========================================
// Exhibit Signal to Layers
// ========================================
const signalInterface = {
    difficulty: difficultySignal
};

EMA.exhibit(window, signalInterface);

// ========================================
// Tutorial Layer Definition
// Uses Layer.proceed() to add behavior without changing base logic
// ========================================
const tutorialSignal = new Signal(true, 'tutorialEnabled');
window.tutorialEnabled = tutorialSignal.value;

tutorialSignal.on((value) => {
    window.tutorialEnabled = value;
});

// Tutorial state tracking
const tutorialState = {
    hasMoved: false,
    hasShot: false,
    hasKilledEnemy: false,
    hasTakenDamage: false,
    hasLowHPWarning: false,
    hasSeenFirstEnemy: false,
    reset() {
        this.hasMoved = false;
        this.hasShot = false;
        this.hasKilledEnemy = false;
        this.hasTakenDamage = false;
        this.hasLowHPWarning = false;
        this.hasSeenFirstEnemy = false;
    }
};

const TutorialLayer = {
    name: 'TutorialMode',
    condition: 'tutorialEnabled === true',
    enter: function() {
        tutorialState.reset();
    },
    exit: function() {}
};

// Partial Method: Track first enemy spawn (uses proceed)
EMA.addPartialMethod(TutorialLayer, Enemy.prototype, 'spawn', function() {
    Layer.proceed();  // Execute original spawn
    
    if (!tutorialState.hasSeenFirstEnemy) {
        game.ui.showTutorialMessage('👾 敵が現れた！スペースキーで撃て！', 3000);
        tutorialState.hasSeenFirstEnemy = true;
    }
});

// Partial Method: Track first movement (uses proceed)
EMA.addPartialMethod(TutorialLayer, Player.prototype, 'moveLeft', function() {
    Layer.proceed();  // Execute original movement
    
    if (!tutorialState.hasMoved) {
        game.ui.showTutorialMessage('🎮 Great! Use ← → to dodge enemies!', 2500);
        tutorialState.hasMoved = true;
    }
});

EMA.addPartialMethod(TutorialLayer, Player.prototype, 'moveRight', function() {
    Layer.proceed();  // Execute original movement
    
    if (!tutorialState.hasMoved) {
        game.ui.showTutorialMessage('🎮 Great! Use ← → to dodge enemies!', 2500);
        tutorialState.hasMoved = true;
    }
});

// Partial Method: Track first shot (uses proceed)
EMA.addPartialMethod(TutorialLayer, Player.prototype, 'shoot', function() {
    Layer.proceed();  // Execute original shooting
    
    if (!tutorialState.hasShot) {
        game.ui.showTutorialMessage('🔫 Nice shot! Keep shooting to destroy enemies!', 2500);
        tutorialState.hasShot = true;
    }
});

// Partial Method: Track damage taken (uses proceed)
EMA.addPartialMethod(TutorialLayer, Player.prototype, 'takeDamage', function(amount) {
    const hpBefore = this.hp;
    Layer.proceed(amount);  // Execute original damage calculation
    
    if (!tutorialState.hasTakenDamage) {
        game.ui.showTutorialMessage('💥 Ouch! Avoid enemy collisions!', 2500);
        tutorialState.hasTakenDamage = true;
    }
    
    // Low HP warning
    if (this.hp < this.maxHP * 0.3 && !tutorialState.hasLowHPWarning) {
        setTimeout(() => {
            game.ui.showTutorialMessage('⚠️ HP Critical! Be careful!', 3000);
        }, 2600);  // Show after previous message
        tutorialState.hasLowHPWarning = true;
    }
});

// Partial Method: Track first kill (uses proceed)
EMA.addPartialMethod(TutorialLayer, Enemy.prototype, 'checkCollisionWithBullets', function(bullets) {
    const score = Layer.proceed(bullets);  // Execute original collision detection
    
    if (score > 0 && !tutorialState.hasKilledEnemy) {
        game.ui.showTutorialMessage('🎯 Enemy destroyed! +10 points!', 2500);
        tutorialState.hasKilledEnemy = true;
    }
    
    return score;
});

// Partial Method: Reset tutorial state on game reset (uses proceed)
EMA.addPartialMethod(TutorialLayer, Game.prototype, 'reset', function() {
    Layer.proceed();  // Execute original reset
    tutorialState.reset();
});

EMA.deploy(TutorialLayer);

// Exhibit tutorial signal
const tutorialSignalInterface = {
    tutorialEnabled: tutorialSignal
};
EMA.exhibit(window, tutorialSignalInterface);

// ========================================
// Boss Wave Layer Definition
// ========================================
const bossWaveSignal = new Signal(false, 'bossWave');
window.bossWave = bossWaveSignal.value;

bossWaveSignal.on((value) => {
    window.bossWave = value;
});

const BossWaveLayer = {
    name: 'BossWave',
    condition: 'bossWave === true',
    enter: function() {},
    exit: function() {}
};

// Partial Method: Boss wave spawn - enemies spawn with warning effect
EMA.addPartialMethod(BossWaveLayer, Enemy.prototype, 'spawn', function() {
    Layer.proceed();  // Execute original spawn
    
    // Boss wave: show warning message
    if (typeof game !== 'undefined' && game.ui) {
        game.ui.showTutorialMessage('⚠️ BOSS WAVE! Enemies incoming!', 2000);
    }
});

// Partial Method: Boss wave enemies have more HP
EMA.addPartialMethod(BossWaveLayer, Enemy.prototype, 'getEnemyHP', function() {
    return 5;  // Boss wave: tough enemies
});

// Partial Method: Boss wave enemies are faster
EMA.addPartialMethod(BossWaveLayer, Enemy.prototype, 'getSpeed', function() {
    return 3.5;  // Boss wave: very fast enemies
});

EMA.deploy(BossWaveLayer);

// Exhibit boss wave signal
const bossWaveSignalInterface = {
    bossWave: bossWaveSignal
};
EMA.exhibit(window, bossWaveSignalInterface);

export { 
    difficultySignal, 
    tutorialSignal, 
    bossWaveSignal,
    EasyModeLayer, 
    HardModeLayer, 
    TutorialLayer, 
    BossWaveLayer,
    tutorialState 
};
