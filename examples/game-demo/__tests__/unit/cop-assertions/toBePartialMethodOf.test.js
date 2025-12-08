/**
 * toBePartialMethodOf マッチャーの単体テスト
 *
 * メソッドがどの Layer の部分メソッドかを判定する
 */
import {
  describeCop,
  toBePartialMethodOf,
  toBeActive,
} from "../../../../../dist/helpers/describeCop.js";
import Enemy from "../../../js/Enemy.js";
import {
  HardModeLayer,
  EasyModeLayer,
  TutorialLayer,
  difficultySignal,
  tutorialSignal,
} from "../../../js/layers.js";

// カスタムマッチャーを登録
expect.extend({ toBePartialMethodOf, toBeActive });

const mockCanvas = { width: 600, height: 400 };

// ========================================
// toBePartialMethodOf の基本機能
// ========================================
describeCop("toBePartialMethodOf - 基本", () => {
  use.layer(HardModeLayer);

  test("部分メソッドを正しく判定できる", () => {
    difficultySignal.value = "hard";

    const enemy = new Enemy(mockCanvas);

    // getEnemyHP は HardModeLayer の部分メソッド
    expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
  });

  test("異なる Layer の部分メソッドではないことを判定できる", () => {
    difficultySignal.value = "hard";

    const enemy = new Enemy(mockCanvas);

    // getEnemyHP は HardModeLayer の部分メソッドであり、TutorialLayer ではない
    expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
    expect(enemy.getEnemyHP).not.toBePartialMethodOf(TutorialLayer);
  });
});

// ========================================
// TutorialLayer のテスト
// ========================================
describeCop("toBePartialMethodOf - TutorialLayer", () => {
  use.layer(TutorialLayer);

  test("spawn が TutorialLayer の部分メソッドである", () => {
    tutorialSignal.value = true;

    const enemy = new Enemy(mockCanvas);

    expect(enemy.spawn).toBePartialMethodOf(TutorialLayer);
  });

  test("getEnemyHP は TutorialLayer の部分メソッドではない", () => {
    tutorialSignal.value = true;

    const enemy = new Enemy(mockCanvas);

    // TutorialLayer は getEnemyHP を定義していない
    expect(enemy.getEnemyHP).not.toBePartialMethodOf(TutorialLayer);
  });
});

// ========================================
// Layer の活性化と部分メソッドの関係
// ========================================
describeCop("toBePartialMethodOf - 活性化状態", () => {
  use.layer(HardModeLayer);

  test("Layer が活性化すると部分メソッドがインストールされる", () => {
    difficultySignal.value = "hard";

    const enemy = new Enemy(mockCanvas);

    // HardModeLayer が活性化 → 部分メソッドがインストールされる
    expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
  });

  test("Layer が非活性でも use.layer で指定していれば環境は準備される", () => {
    // difficultySignal は 'normal'（初期値）なので HardModeLayer は非活性
    // しかし use.layer で指定しているので、活性化すればインストールされる

    const enemy = new Enemy(mockCanvas);
    const hp1 = enemy.getEnemyHP(); // 元のメソッド → 1

    difficultySignal.value = "hard"; // 活性化

    const hp2 = enemy.getEnemyHP(); // 部分メソッド → 3

    expect(hp1).toBe(1);
    expect(hp2).toBe(3);
  });

  // 追加: toBeActive を使った Layer 活性化状態の確認
  test("Layer が非活性から活性化への変化を toBeActive で確認", () => {
    // 初期状態: HardModeLayer は非活性
    expect(HardModeLayer).not.toBeActive();

    // Signal を変更して活性化
    difficultySignal.value = "hard";

    // 活性化を確認
    expect(HardModeLayer).toBeActive();

    // 部分メソッドがインストールされていることを確認
    const enemy = new Enemy(mockCanvas);
    expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
  });
});
