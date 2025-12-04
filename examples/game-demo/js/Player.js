/**
 * Player class
 * Represents the player's spaceship
 */
export default class Player {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = 40;
        this.height = 30;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 10;
        this.speed = 5;
        this.maxHP = this.getMaxHP();
        this.hp = this.maxHP;
        this.bullets = [];
        this.bulletSpeed = 7;
        this.shootCooldown = 0;
        this.shootDelay = 15; // frames between shots
    }

    // Configurable methods - can be refined by COP layers
    getMaxHP() {
        return 100; // Normal: 100 HP
    }

    getDamageMultiplier() {
        return 1.0; // Normal: 1x damage
    }

    moveLeft() {
        if (this.x > 0) {
            this.x -= this.speed;
        }
    }

    moveRight() {
        if (this.x < this.canvas.width - this.width) {
            this.x += this.speed;
        }
    }

    shoot() {
        if (this.shootCooldown <= 0) {
            this.bullets.push({
                x: this.x + this.width / 2 - 2,
                y: this.y,
                width: 4,
                height: 10
            });
            this.shootCooldown = this.shootDelay;
        }
    }

    takeDamage(amount) {
        const actualDamage = Math.floor(amount * this.getDamageMultiplier());
        this.hp -= actualDamage;
        if (this.hp < 0) this.hp = 0;
        return this.hp;
    }

    update() {
        // Update bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].y -= this.bulletSpeed;
            // Remove off-screen bullets
            if (this.bullets[i].y < 0) {
                this.bullets.splice(i, 1);
            }
        }

        // Update shoot cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
    }

    render(ctx) {
        // Draw player ship
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Draw bullets
        ctx.fillStyle = '#fbbf24';
        for (const bullet of this.bullets) {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        }
    }

    reset() {
        this.x = this.canvas.width / 2 - this.width / 2;
        this.maxHP = this.getMaxHP();
        this.hp = this.maxHP;
        this.bullets = [];
        this.shootCooldown = 0;
    }
}
