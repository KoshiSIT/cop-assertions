/**
 * Enemy class
 * Manages enemy spawning and behavior
 */
export default class Enemy {
    constructor(canvas) {
        this.canvas = canvas;
        this.enemies = [];
        this.spawnTimer = 0;
        this.enemyWidth = 30;
        this.enemyHeight = 30;
    }

    // Configurable methods - can be refined by COP layers
    getSpawnInterval() {
        return 60; // Normal: 60 frames
    }

    getSpeed() {
        return 2; // Normal: speed 2
    }

    getEnemyHP() {
        return 1; // Normal: 1 HP
    }

    spawn() {
        const x = Math.random() * (this.canvas.width - this.enemyWidth);
        this.enemies.push({
            x: x,
            y: -this.enemyHeight,
            width: this.enemyWidth,
            height: this.enemyHeight,
            hp: this.getEnemyHP()  // Use method instead of hardcoded value
        });
    }

    update() {
        // Spawn new enemies using configurable interval
        this.spawnTimer++;
        if (this.spawnTimer >= this.getSpawnInterval()) {
            this.spawn();
            this.spawnTimer = 0;
        }

        // Move enemies using configurable speed
        const speed = this.getSpeed();
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            this.enemies[i].y += speed;
            
            // Remove off-screen enemies
            if (this.enemies[i].y > this.canvas.height) {
                this.enemies.splice(i, 1);
            }
        }
    }

    render(ctx) {
        for (const enemy of this.enemies) {
            // Draw enemy body
            ctx.fillStyle = '#e94560';
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            
            // Draw HP indicator (if HP > 1)
            if (enemy.hp > 1) {
                ctx.fillStyle = '#fff';
                ctx.font = '12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(enemy.hp, enemy.x + enemy.width/2, enemy.y + enemy.height/2 + 4);
            }
        }
    }

    checkCollisionWithBullets(bullets) {
        let score = 0;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            for (let j = bullets.length - 1; j >= 0; j--) {
                if (this.isColliding(this.enemies[i], bullets[j])) {
                    // Remove bullet
                    bullets.splice(j, 1);
                    
                    // Reduce enemy HP
                    this.enemies[i].hp--;
                    
                    // If enemy is dead, remove and add score
                    if (this.enemies[i].hp <= 0) {
                        this.enemies.splice(i, 1);
                        score += 10;
                    }
                    break;
                }
            }
        }
        return score;
    }

    checkCollisionWithPlayer(player) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const playerRect = {
                x: player.x,
                y: player.y,
                width: player.width,
                height: player.height
            };
            if (this.isColliding(enemy, playerRect)) {
                this.enemies.splice(i, 1);
                return true; // collision occurred
            }
        }
        return false;
    }

    isColliding(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    reset() {
        this.enemies = [];
        this.spawnTimer = 0;
    }
}
