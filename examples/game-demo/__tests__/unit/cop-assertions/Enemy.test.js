/**
 * testPartialを使ったテスト
 * 自動クリーンアップにより、テスト間で状態が独立する
 */
import Enemy from "../../../js/Enemy.js";
import { testPartial } from "../../../../../dist/helpers/testPartial.js";
import { HardModeLayer, EasyModeLayer } from "../../../js/layers.js";

describe("Enemy - testPartial", () => {
  const mockCanvas = { width: 600, height: 400 };

  testPartial.base("ベースメソッドはHP1を返す", () => {
    const enemy = new Enemy(mockCanvas);
    expect(enemy.getEnemyHP()).toBe(1);
  });

  testPartial("HardModeLayerのgetEnemyHPは3を返す", [HardModeLayer], () => {
    const enemy = new Enemy(mockCanvas);
    expect(enemy.getEnemyHP()).toBe(3);
  });

  testPartial("EasyModeLayerのgetEnemyHPは1を返す", [EasyModeLayer], () => {
    const enemy = new Enemy(mockCanvas);
    expect(enemy.getEnemyHP()).toBe(1);
  });

  // クリーンアップが正しく動作しているか確認
  testPartial.base("HardModeテスト後でもベースメソッドはHP1を返す", () => {
    const enemy = new Enemy(mockCanvas);
    expect(enemy.getEnemyHP()).toBe(1);
  });
});
