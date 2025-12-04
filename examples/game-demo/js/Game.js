/**
 * Game class
 * Main game loop and state management
 */
import Player from './Player.js';
import Enemy from './Enemy.js';
import UI from './UI.js';

export default class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.player = new Player(canvas);
        this.enemy = new Enemy(canvas);
        this.ui = new UI();
        this.score = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.keys = {};
        this.damageAmount = 20; // default damage (Normal)

        this.setupInput();
    }

    // Configurable method - can be refined by COP layers
    getScoreMultiplier() {
        return 1.0; // Normal: 1x score
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    start() {
        this.reset();
        this.isRunning = true;
        this.isPaused = false;
        this.ui.log('Game started!', 'info');
        this.gameLoop();
    }

    pause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.ui.log('Game paused', 'info');
        } else {
            this.ui.log('Game resumed', 'info');
            this.gameLoop();
        }
    }

    reset() {
        this.score = 0;
        this.player.reset();
        this.enemy.reset();
        this.ui.updateScore(this.score);
        this.ui.updateHP(this.player.hp, this.player.maxHP);
    }

    handleInput() {
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.moveLeft();
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.moveRight();
        }
        if (this.keys['Space']) {
            this.player.shoot();
        }
    }

    update() {
        this.handleInput();
        this.player.update();
        this.enemy.update();

        // Check bullet-enemy collisions
        const scoreGained = this.enemy.checkCollisionWithBullets(this.player.bullets);
        if (scoreGained > 0) {
            this.score += scoreGained * this.getScoreMultiplier();
            this.ui.updateScore(Math.floor(this.score));
        }

        // Check player-enemy collisions
        if (this.enemy.checkCollisionWithPlayer(this.player)) {
            this.player.takeDamage(this.damageAmount);
            this.ui.updateHP(this.player.hp, this.player.maxHP);

            if (this.player.hp <= 0) {
                this.gameOver();
            }
        }
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render game objects
        this.player.render(this.ctx);
        this.enemy.render(this.ctx);
    }

    gameLoop() {
        if (!this.isRunning || this.isPaused) return;

        this.update();
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    gameOver() {
        this.isRunning = false;
        this.ui.showGameOver(Math.floor(this.score));
        this.ui.log('Press Start to play again', 'info');
    }
}
