# COP テストツール API 仕様書

最終更新: 2024-12-27
バージョン: 1.1.0

---

## 1. 概要

本仕様は、JavaScript における Context-Oriented Programming (COP) 実装のためのテストアサーションAPIを定義する。

### 対象実装

| 実装 | 特徴 |
|------|------|
| **ContextJS** | Lively Kernel開発。dynamic extent、オブジェクトスコープ、proceedチェーン |
| **EMA.js** | Event-Model-Adaptation。Signal による暗黙的活性化、スコープ戦略 |
| **Cop.js** | トレイトベース。コンフリクト検出・解決機構 |

---

## 2. 実装状況サマリー

### 2.1 アサーション実装状況

| # | アサーション | 実装 | テスト |
|---|-------------|:----:|:------:|
| 1 | `toBeActive()` | ✅ | ✅ |
| 2 | `toHaveLastExecutedBehaviorOf(Layer)` | ✅ | ✅ |
| 3 | `toHaveNthExecutedBehaviorOf(n, Layer)` | ✅ | ✅ |
| 4 | `toBePartialMethodOf(layer)` | ✅ | ✅ |
| 5 | `toBeOriginalMethod()` | ✅ | ✅ |
| 6 | `assertNoConflictingMethodCalled(fn)` | ✅ | ✅ |
| 7 | `assertLayerStateUnchanged(fn)` | ✅ | ✅ |
| 8 | `assertLayerStateTransition(before, after, fn)` | ✅ | ✅ |
| 9 | `whenActivated().not.toChangeOtherLayers()` | ✅ | ✅ |
| 10 | `whenDeactivated().not.toChangeOtherLayers()` | ✅ | ✅ |
| 11 | `toBeActiveFor(obj)` | ❌ | - |
| 12 | `toExecuteInOrder([...])` | ❌ | - |
| 13 | `toExecuteComposedBehaviorOf([...])` | ❌ | - |

### 2.2 EMA.js 拡張機能

| 機能 | 実装 | テスト |
|------|:----:|:------:|
| `EMA.config({ proceedMode })` | ✅ | ✅ |
| `EMA.resolveConflict()` (自動チェーン) | ✅ | ✅ |
| `EMA.resolveConflict()` (コールバック) | ✅ | ✅ |
| `Layer.proceed()` チェーン対応 | ✅ | ✅ |

### 2.3 テスト結果

```
Test Suites: 20 passed (+ 2 intentional failures)
Tests:       203 passed (+ 2 intentional failures)
```

---

## 3. インフラストラクチャ

### 3.1 CopHooks（フック一元管理）

COPのライフサイクルやメソッド呼び出しをフックする低レベルインフラ。

```typescript
interface HookContext {
    target: any;                         // 対象オブジェクト
    methodName: string;                  // メソッド名
    args: any[];                         // 引数
    result?: any;                        // 戻り値 (after のみ)
    extra?: Record<string, any>;         // 追加データ
}

type HookTiming = 'before' | 'after';
type HookCallback = (context: HookContext) => void;

const CopHooks = {
    // フック登録（解除関数を返す）
    register(target, methodName, timing, callback, filter?): () => void,
    
    // メソッドにフックをインストール
    install(target, methodName, contextBuilder?): void,
    reinstall(target, methodName, contextBuilder?): void,
    uninstall(target, methodName): void,
    
    // フック解除
    unregister(target, methodName, id): void,
    clearFor(target, methodName): void,
    clear(): void,
};
```

**使用例:**

```typescript
// EMA.activate にフックをインストール
CopHooks.install(EMA, 'activate', (args) => ({
    layer: args[0],
    otherLayersBefore: captureOtherLayerStates(args[0]),
}));

// フック登録
const unregister = CopHooks.register(EMA, 'activate', 'after', (ctx) => {
    // 検証ロジック
}, (ctx) => ctx.extra?.layer === targetLayer);

// アンインストール
CopHooks.uninstall(EMA, 'activate');
```

### 3.2 フック統一状況

| 機能 | 方式 | CopHooks |
|-----|------|:--------:|
| EMA.activate / deactivate | フック | ✅ |
| assertNoConflictingMethodCalled | フック | ✅ |
| whenActivated / whenDeactivated | フック | ✅ |
| メタデータ付与 | 直接置き換え | ❌ (衝突なし) |
| 指定外の Layer 無効化 | 直接置き換え | ❌ (関心外) |
| CallTracker | getter/setter | ❌ (動的対応) |

---

## 4. アサーション詳細

### 4.1 `toBeActive()`

**用途**: 層がアクティブかどうかを検証する

```typescript
expect(layer: Layer).toBeActive(): void
expect(layer: Layer).not.toBeActive(): void
```

**使用例**:
```javascript
describeCop('テスト', () => {
    use.layer([NightLayer]);
    
    test('活性化検証', () => {
        EMA.activate(NightLayer);
        expect(NightLayer).toBeActive();
        
        EMA.deactivate(NightLayer);
        expect(NightLayer).not.toBeActive();
    });
});
```

---

### 4.2 `toHaveLastExecutedBehaviorOf(Layer)`

**用途**: メソッドの最後の呼び出しが指定した層の振る舞いを実行したか検証

```typescript
expect(method: Function).toHaveLastExecutedBehaviorOf(layer: Layer): void
```

**使用例**:
```javascript
describeCop('テスト', () => {
    use.layer([HardModeLayer]);
    
    test('振る舞い検証', () => {
        EMA.activate(HardModeLayer);
        enemy.takeDamage(10);
        
        expect(enemy.takeDamage).toHaveLastExecutedBehaviorOf(HardModeLayer);
    });
});
```

---

### 4.3 `toHaveNthExecutedBehaviorOf(n, Layer)`

**用途**: メソッドのn回目の呼び出しが指定した層の振る舞いを実行したか検証

```typescript
expect(method: Function).toHaveNthExecutedBehaviorOf(n: number, layer: Layer): void
```

**使用例**:
```javascript
describeCop('テスト', () => {
    use.layer([EasyModeLayer, HardModeLayer]);
    
    test('複数回呼び出し', () => {
        EMA.activate(EasyModeLayer);
        enemy.takeDamage(10);  // 1回目: EasyModeLayer
        
        EMA.deactivate(EasyModeLayer);
        EMA.activate(HardModeLayer);
        enemy.takeDamage(20);  // 2回目: HardModeLayer
        
        expect(enemy.takeDamage).toHaveNthExecutedBehaviorOf(1, EasyModeLayer);
        expect(enemy.takeDamage).toHaveNthExecutedBehaviorOf(2, HardModeLayer);
    });
});
```

---

### 4.4 `toBePartialMethodOf(layer)`

**用途**: 現在のメソッドが指定した層の部分メソッドか検証

```typescript
expect(method: Function).toBePartialMethodOf(layer: Layer): void
```

---

### 4.5 `toBeOriginalMethod()`

**用途**: 現在のメソッドがオリジナル（どの層にも refine されていない）か検証

```typescript
expect(method: Function).toBeOriginalMethod(): void
```

---

### 4.6 `assertNoConflictingMethodCalled(fn)`

**用途**: fn 内でメソッドが呼ばれた時、複数の層が同時にアクティブならエラー

```typescript
assertNoConflictingMethodCalled(fn: () => void): void
```

**使用例**:
```javascript
describeCop('テスト', () => {
    use.layer([EasyModeLayer, TutorialLayer]);
    
    test('競合検出', () => {
        EMA.activate(EasyModeLayer);
        EMA.activate(TutorialLayer);  // 両方アクティブ
        
        assertNoConflictingMethodCalled(() => {
            enemy.takeDamage(10);  // エラー: 競合検出
        });
    });
});
```

**内部実装**: CopHooks を使用

---

### 4.7 `assertLayerStateUnchanged(fn)`

**用途**: fn 実行前後で層の状態が変わらないことを検証

```typescript
assertLayerStateUnchanged(fn: () => void): void
```

---

### 4.8 `assertLayerStateTransition(before, after, fn)`

**用途**: fn 実行により層の状態が期待通りに遷移することを検証

```typescript
assertLayerStateTransition(
    before: { active: Layer[], inactive: Layer[] },
    after: { active: Layer[], inactive: Layer[] },
    fn: () => void
): void
```

---

### 4.9 `whenActivated().not.toChangeOtherLayers()`

**用途**: 層を活性化したとき、他の層が変わらないことを検証

```typescript
whenActivated(layer: Layer).not.toChangeOtherLayers(): void
```

**使用例**:
```javascript
describeCop('テスト', () => {
    use.layer([LayerA, LayerB]);
    
    test('副作用なし', () => {
        whenActivated(LayerA).not.toChangeOtherLayers();
        
        EMA.activate(LayerA);  // LayerB が変わったらエラー
    });
});
```

**内部実装**: CopHooks を使用

---

### 4.10 `whenDeactivated().not.toChangeOtherLayers()`

**用途**: 層を非活性化したとき、他の層が変わらないことを検証

```typescript
whenDeactivated(layer: Layer).not.toChangeOtherLayers(): void
```

---

## 5. EMA.js 拡張機能

### 5.1 `EMA.config({ proceedMode })`

```typescript
// デフォルト: original モード（直接オリジナルへ）
EMA.config({ proceedMode: 'original' });

// chain モード（次の層へチェーン）
EMA.config({ proceedMode: 'chain' });

// 現在の設定取得
EMA.getConfig();  // { proceedMode: 'chain' }
```

### 5.2 `EMA.resolveConflict()`

#### 戦略1: 自動チェーン（コールバックなし）

```javascript
EMA.config({ proceedMode: 'chain' });
EMA.resolveConflict(Player.prototype, 'takeDamage', [EasyModeLayer, TutorialLayer]);

// 両方アクティブ時の呼び出しチェーン:
player.takeDamage(20);
// → EasyModeLayer.takeDamage()
//    → Layer.proceed()
//       → TutorialLayer.takeDamage()
//          → Layer.proceed()
//             → オリジナル.takeDamage()
```

#### 戦略2: カスタム動作（コールバックあり）

```javascript
EMA.resolveConflict(TestClass.prototype, 'calculate', [LayerA, LayerB], 
    function(partialMethods, originalMethod) {
        return function(x) {
            const a = partialMethods['LayerA'].call(this, x);
            const b = partialMethods['LayerB'].call(this, x);
            return a + b;  // 両方の結果を合計
        };
    }
);
```

---

## 6. describeCop ヘルパー

### 6.1 基本構造

```javascript
import { describeCop, use } from 'cop-assertions';

describeCop('テスト名', () => {
    use.layer([LayerA, LayerB]);  // テストで使う層を宣言
    
    test('テスト1', () => {
        // LayerA, LayerB のみが影響
        // 他の層は無効化される
    });
});
```

### 6.2 分離環境

- 宣言した層のみが影響
- 他の層は `_installPartialMethod` が無効化される
- テスト後に状態が自動復元される

---

## 7. Cop.js vs EMA.js 機能比較

| 機能 | Cop.js | ContextJS | EMA.js |
|------|:------:|:---------:|:------:|
| 暗黙的活性化 (Signal) | ❌ | ❌ | ✅ |
| 明示的活性化 | ✅ | ✅ | ✅ |
| コンフリクト検出 | ✅ | ❌ | ❌ |
| コンフリクト解決（自動チェーン） | ✅ | ❌ | ✅ |
| コンフリクト解決（コールバック） | ✅ | ❌ | ✅ |
| proceed チェーン | ✅ | ✅ | ✅ |
| オブジェクトスコープ | ❌ | ✅ | ✅ |
| enter/exit フック | ✅ | ❌ | ✅ |

---

## 8. ファイル構成

```
cop-assertions/
├── src/
│   ├── helpers/
│   │   └── describeCop.ts      # メイン実装
│   │       ├── CopHooks        # フック一元管理
│   │       ├── CallTracker     # 呼び出し履歴
│   │       ├── describeCop()   # テストヘルパー
│   │       └── アサーション群
│   └── ema/
│       ├── EMA.js              # EMA.config, resolveConflict
│       ├── Layer.js            # proceed チェーン
│       └── PartialMethodsPool.js
├── examples/
│   └── game-demo/
│       └── __tests__/
│           ├── unit/
│           │   └── cop-assertions/  # アサーションテスト
│           └── casestudy/           # ケーススタディ
└── dist/                            # ビルド出力
```

---

## 9. 次の実装候補

| アサーション | 優先度 | 備考 |
|------------|:------:|------|
| `toExecuteInOrder([...])` | 高 | proceedチェーン対応済みで実装可能 |
| `toBeActiveFor(obj)` | 中 | オブジェクトスコープ対応が必要 |
| `toExecuteComposedBehaviorOf([...])` | 低 | Cop.js専用 |
