/**
 * ケーススタディ: クリーンアップなしの場合に起きるエラー
 *
 * このテストはクリーンアップをしていないため、テスト間で状態が漏れて失敗する。
 */
import Enemy from "../../js/Enemy.js";
import { EMA } from "../../../../dist/ema/index.js";
import {
  HardModeLayer,
  EasyModeLayer,
  difficultySignal,
} from "../../js/layers.js";

describe("クリーンアップなし - 失敗するケース", () => {
  const mockCanvas = { width: 600, height: 400 };
  let enemy;

  beforeEach(() => {
    enemy = new Enemy(mockCanvas);
    // クリーンアップなし！
  });

  // テスト1: HardModeを活性化
  test("テスト1: HardModeLayer活性化時はHP3を返す", () => {
    EMA.activate(HardModeLayer);
    expect(enemy.getEnemyHP()).toBe(3);
    // ← deactivateしていない！
  });

  // テスト2: ベースメソッドをテスト
  // テスト1でHardModeLayerがactiveのままなので失敗する
  test("テスト2: ベースメソッドはHP1を返す（失敗する）", () => {
    // 期待: HP1（ベースメソッド）
    // 実際: HP3（HardModeLayerがactiveのまま）
    expect(enemy.getEnemyHP()).toBe(1);
  });

  // テスト3: EasyModeをテスト
  // テスト1のHardModeLayerがactiveのまま + EasyModeLayerもactive
  test("テスト3: EasyModeLayer活性化時はHP1を返す（失敗する可能性）", () => {
    EMA.activate(EasyModeLayer);
    // HardModeLayerもactiveなので、どちらが適用されるか不明
    expect(enemy.getEnemyHP()).toBe(1);
  });
});
