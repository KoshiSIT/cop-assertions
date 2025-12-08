import Enemy from "../../../js/Enemy.js";

describe("Enemy", () => {
    // モックcanvas
    const mockCanvas = {
        width: 600,
        height: 400,
    };

    describe("getEnemyHP", () => {
        let enemy;

        beforeEach(() => {
            enemy = new Enemy(mockCanvas);
        });

        test("デフォルトのHPは1を返す", () => {
            expect(enemy.getEnemyHP()).toBe(1);
        });
    });

    describe("spawn", () => {
        let enemy;

        beforeEach(() => {
            enemy = new Enemy(mockCanvas);
        });

        test("spawn()で敵が1体追加される", () => {
            enemy.spawn();
            expect(enemy.enemies.length).toBe(1);
        });

        test("spawn()で追加された敵はcanvas幅内のx座標を持つ", () => {
            enemy.spawn();
            const spawnedEnemy = enemy.enemies[0];

            expect(spawnedEnemy.x).toBeGreaterThanOrEqual(0);
            expect(spawnedEnemy.x).toBeLessThanOrEqual(
                mockCanvas.width - enemy.enemyWidth,
            );
        });

        test("spawn()で追加された敵は画面外上部から開始する", () => {
            enemy.spawn();
            const spawnedEnemy = enemy.enemies[0];

            expect(spawnedEnemy.y).toBe(-enemy.enemyHeight);
        });
    });
});
