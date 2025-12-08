/**
 * app.js - Main Application Entry Point
 * COP Shooting Game Demo with Implicit Layer Activation
 */
import Game from './Game.js';
import { EMA } from '../../../dist/ema/index.js';
import { difficultySignal, tutorialSignal, EasyModeLayer, HardModeLayer, TutorialLayer } from './layers.js';

// Global state
const state = {
    game: null,
    currentDifficulty: 'normal'
};

// Global game reference for Tutorial layer to access UI
window.game = null;

/**
 * Change difficulty using Signal (Implicit Activation)
 */
function changeDifficulty(newDifficulty) {
    if (state.currentDifficulty === newDifficulty) return;

    console.log(`\n=== Changing difficulty: ${state.currentDifficulty} → ${newDifficulty} ===`);

    // Update signal value - this triggers implicit layer activation!
    difficultySignal.value = newDifficulty;
    
    state.currentDifficulty = newDifficulty;

    // Update UI
    updateDifficultyButtons(newDifficulty);
    updateLayerStatusDisplay();
    state.game.ui.log(`Difficulty: ${newDifficulty} (Signal-based activation)`, 'info');

    // Apply hint visibility (will be overridden by HardMode layer)
    state.game.ui.setHintVisibility(true);

    // Reset game to apply new layer's partial methods
    if (state.game.isRunning) {
        state.game.reset();
        state.game.ui.log('Game reset with new difficulty settings', 'info');
    }

    // Show active layers
    logActiveLayers();
}

/**
 * Toggle tutorial mode using Signal
 */
function toggleTutorial(enabled) {
    console.log(`\n=== Tutorial mode: ${enabled ? 'ON' : 'OFF'} ===`);
    tutorialSignal.value = enabled;
    updateLayerStatusDisplay();
    state.game.ui.log(`Tutorial: ${enabled ? 'Enabled' : 'Disabled'}`, 'info');
    logActiveLayers();
}

/**
 * Update layer status display to show all active layers
 */
function updateLayerStatusDisplay() {
    const activeLayers = EMA.getActiveLayers();
    const layerNames = activeLayers.map(l => l.name).join(' + ') || 'Normal';
    state.game.ui.updateLayerStatus(layerNames);
}

/**
 * Log active layers to console
 */
function logActiveLayers() {
    const activeLayers = EMA.getActiveLayers();
    console.log(`Active layers: ${activeLayers.map(l => l.name).join(', ') || 'None (Normal Mode)'}`);
}

/**
 * Update button styles
 */
function updateDifficultyButtons(activeDifficulty) {
    const buttons = document.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    const activeBtn = document.getElementById(`btn-${activeDifficulty}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * Initialize game
 */
function initGame() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }

    state.game = new Game(canvas);
    window.game = state.game;  // Global reference for Tutorial layer
    console.log('[App] Game instance created');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Difficulty buttons
    document.getElementById('btn-easy').addEventListener('click', () => {
        changeDifficulty('easy');
    });

    document.getElementById('btn-normal').addEventListener('click', () => {
        changeDifficulty('normal');
    });

    document.getElementById('btn-hard').addEventListener('click', () => {
        changeDifficulty('hard');
    });

    // Tutorial toggle
    const tutorialToggle = document.getElementById('tutorial-toggle');
    if (tutorialToggle) {
        tutorialToggle.addEventListener('change', (e) => {
            toggleTutorial(e.target.checked);
        });
    }

    // Game control buttons
    document.getElementById('btn-start').addEventListener('click', () => {
        if (!state.game.isRunning) {
            state.game.start();
        }
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
        if (state.game.isRunning) {
            state.game.pause();
        }
    });

    console.log('[App] Event listeners setup complete');
}

/**
 * Main initialization
 */
function init() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   COP Shooting Game - Layer Composition Demo   ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('');
    console.log('[App] EMA.js loaded:', typeof EMA !== 'undefined');
    console.log('[App] Deployed layers:', EMA.getLayers().map(l => l.name));
    console.log('[App] Difficulty signal:', difficultySignal.value);
    console.log('[App] Tutorial signal:', tutorialSignal.value);
    console.log('');

    // Initialize game
    initGame();

    // Setup event listeners
    setupEventListeners();

    // Set initial state
    updateDifficultyButtons('normal');
    
    // Trigger initial layer activation by re-setting signal values
    // This ensures layers are activated after game instance is created
    tutorialSignal.value = true;
    difficultySignal.value = 'normal';
    
    updateLayerStatusDisplay();
    state.game.ui.log('Game ready. Click Start to play.', 'info');
    state.game.ui.log('Tutorial mode is ON by default.', 'info');

    console.log('[App] Initialization complete');
    console.log('[App] Controls: ← → to move, SPACE to shoot');
    console.log('');
    console.log('💡 Features:');
    console.log('   - Difficulty layers: Replace base behavior completely');
    console.log('   - Tutorial layer: Uses Layer.proceed() to add messages');
    console.log('   - Both layers can be active simultaneously!');
    console.log('');
    logActiveLayers();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
