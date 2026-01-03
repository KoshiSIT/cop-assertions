# COP テストツール仕様

## 概要

COPの共通概念に対する検証仕様を定義する。

## 設計思想

### テストツールの3レベル

```
COP共通概念の検証（抽象度高め）
    ↓
COP手法特有の検証
    ↓
言語特有の検証
```

| レベル | 対象 | 例 |
|--------|------|-----|
| レベル1 | COP共通概念 | どのCOPLでも必要な検証 |
| レベル2 | COP手法特有 | 排他制御、暗黙的活性化の副作用 |
| レベル3 | 言語特有 | withブロックの非同期処理問題（EMA.js） |

### 一般的なテストツールとの差別化

| 観点 | 一般的なアサーション | COPアサーション |
|------|---------------------|-----------------|
| 対象 | オブジェクト/クラス | 層（文脈） |
| 検証 | 静的な存在 | 文脈に紐づいた定義・実行 |
| 前提 | 常に同じ振る舞い | **文脈で振る舞いが変わる** |
| エラー出力 | Expected X, got Y | Expected X, got Y + **トレース情報** |

**本質的な違い**: 「文脈を第一級市民として扱う」

---

## 検証対象: COP共通の意図と欠陥

| # | 意図 | 欠陥 |
|---|------|------|
| 1 | Night のときはこう動く | 振る舞いが定義されていない / 間違っている |
| 2 | Night が有効なら Night の振る舞いが使われる | Night なのに別の振る舞いが実行される |
| 3 | コンテキストが変われば振る舞いも変わる | 変わったのに振る舞いが変わらない |

---

## アサーション仕様

### 意図2: 振る舞いの実行検証

「Night が有効なら Night の振る舞いが使われる」ことを検証する。

#### 背景

- OOPでは「結果」を見れば十分（振る舞いは静的に決まる）
- COPでは「どの文脈で実行されたか」が重要（実行時に振る舞いが変わる）
- フローの途中で文脈が変わるケースがある
- 同じメソッドが複数回、異なる文脈で実行されることがある

#### 構文

| 検証内容 | 構文 |
|---------|------|
| 最後の実行 | `expect(method).lastCall.toExecuteBehaviorOf(Layer)` |
| すべての実行 | `expect(method).allCalls.toExecuteBehaviorOf(Layer)` |
| n回目の実行 | `expect(method).nthCall(n).toExecuteBehaviorOf(Layer)` |

#### 使用例

```javascript
Night.enable();
house.secureHouse();

// 最後の door.close が Night の振る舞いか
expect(door.close).lastCall.toExecuteBehaviorOf(Night);

// すべての door.close が Night の振る舞いか
expect(door.close).allCalls.toExecuteBehaviorOf(Night);

// 1回目は Night、2回目は Emergency
expect(door.close).nthCall(1).toExecuteBehaviorOf(Night);
expect(door.close).nthCall(2).toExecuteBehaviorOf(Emergency);
```

#### エラー出力（例）

```
Expected: door.close().nthCall(2) executes Night's behavior
Actual: Emergency's behavior was executed

Trace:
  - nthCall(1): Night ✓
  - nthCall(2): Emergency ✗ (expected Night)
```

#### 実装方針

- 履歴を記録して、後から検証する（Jest のモックと同じアプローチ）
- 記録する情報: メソッド、層、順序
- モックとの違い: モックは「呼び出し」を記録、COPは「どの層の振る舞いか」を記録

---

### 層の状態検証

層がアクティブかどうかを検証する。

#### 背景

- 実行によって層の状態が変わることがある
- COP以外のコード（通常の関数）が層を操作することもある
- 前提条件の確認として使える

#### 構文

| 検証内容 | 構文 |
|---------|------|
| 層がアクティブか | `expect(Layer).toBeActive()` |
| 層が非アクティブか | `expect(Layer).not.toBeActive()` |

#### 使用例

```javascript
// 実行前の状態
expect(Night).toBeActive();
expect(Emergency).not.toBeActive();

// 何か実行
house.handleEmergency();

// 実行後の状態変化を検証
expect(Night).not.toBeActive();
expect(Emergency).toBeActive();
```

```javascript
// COP以外のコードが層を操作するケース
function handleSensorEvent(event) {
    if (event.type === 'motion') {
        Night.disable();
        Emergency.enable();
    }
}

handleSensorEvent({ type: 'motion' });
expect(Night).not.toBeActive();
expect(Emergency).toBeActive();
```

---

## 検討結果

### 意図1: 定義の検証

「Night のときはこう動く」が正しく定義されているかの検証。

- **独立したアサーションは不要**
- 理由: 一般的なテストツールの思想では、定義の存在ではなく振る舞いを検証する
- 対応: `toExecuteBehaviorOf()` が失敗した場合、エラー出力で原因（定義がない等）を表示

### 意図3: 切り替えの検証

「コンテキストが変われば振る舞いも変わる」ことの検証。

- **独立したアサーションは不要**
- 理由: 意図2のアサーション（`toExecuteBehaviorOf`）で検証可能
- 対応: 状態変化の前後でそれぞれ `toExecuteBehaviorOf()` を使用

---

## COP共通アサーション一覧

| アサーション | 用途 |
|-------------|------|
| `expect(method).lastCall.toExecuteBehaviorOf(Layer)` | 最後の実行がどの層か |
| `expect(method).allCalls.toExecuteBehaviorOf(Layer)` | すべての実行がどの層か |
| `expect(method).nthCall(n).toExecuteBehaviorOf(Layer)` | n回目の実行がどの層か |
| `expect(Layer).toBeActive()` | 層がアクティブか |
| `expect(Layer).not.toBeActive()` | 層が非アクティブか |

---

## レベル2: COP手法特有の検証

### 活性化/非活性化の副作用検証

層の活性化/非活性化時に、他の層が予期せず変化しないことを検証する。

#### 背景

- 暗黙的活性化（Signal-based）では、層が活性化されるときに enter コールバックが実行される
- enter/exit 内でCOP機構（層の状態、Signal）を操作すると、予期しない層の変化が起きる可能性がある

#### 起こりうる欠陥

```javascript
let Night = {
    condition: "time >= 21",
    enter: function() {
        EMA.activate(Silent);  // 別の層を活性化 → 意図しない副作用
    }
};

// Night が活性化される
// → enter が呼ばれる
// → Silent も活性化される
// → 意図しない層の組み合わせ
```

#### 構文

| 検証内容 | 構文 |
|---------|------|
| 活性化時に他の層が変化しない | `expect(Layer).whenActivated().not.toChangeOtherLayers()` |
| 非活性化時に他の層が変化しない | `expect(Layer).whenDeactivated().not.toChangeOtherLayers()` |

#### 使用例

```javascript
// Night が活性化されたとき、他の層が変化しないことを検証
expect(Night).whenActivated().not.toChangeOtherLayers();

// Night が非活性化されたとき、他の層が変化しないことを検証
expect(Night).whenDeactivated().not.toChangeOtherLayers();
```

#### エラー出力（例）

```
Expected: Night activation does not change other layers
Actual: Silent was activated as a side effect

Trace:
  - Night.activate() called
  - Night.enter() executed
  - Silent.activate() called (unexpected)
```

---

## 未検討事項

### レベル2: COP手法特有の検証（残り）

- 排他制御（Layer-based）
- proceed の検証（Layer-based）
- 実行順序（Layer-based）

### レベル3: 言語特有の検証

- withブロックの非同期処理問題（EMA.js）
