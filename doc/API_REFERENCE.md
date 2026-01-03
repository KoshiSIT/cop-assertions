# API リファレンス

テストを書く際、値が特定の条件を満たすことを確認する必要があります。`expect` を使用すると、様々な検証を行うための「マッチャー」にアクセスできます。

## リファレンス

- [フィクスチャー](#フィクスチャー)
  - [`describeCop(name, fn)`](#describecopname-fn)
  - [`use.layer(layers)`](#uselayerlayers)
- [マッチャー](#マッチャー)
  - [`.toBeActive()`](#tobeactive)
  - [`.toBeActiveFor(object)`](#tobeactiveforobject)
  - [`.toBePartialMethodOf(layer)`](#tobepartialmethodoflayer)
  - [`.toBeOriginalMethod()`](#tobeoriginalmethod)
  - [`.toHaveLastExecutedBehaviorOf(layer)`](#tohavelastexecutedbehavioroflayer)
  - [`.toHaveNthExecutedBehaviorOf(n, layer)`](#tohaventhexecutedbehaviorofn-layer)
  - [`.toHaveAllExecutedBehaviorOf(layer)`](#tohaveallexecutedbehavioroflayer)
  - [`.toExecuteInOrder(layers)`](#toexecuteinorderlayers)
  - [`.toHaveUsedConflictResolution()`](#tohaveusedconflictresolution)
  - [`.toCallConflictingMethod()`](#tocallconflictingmethod)
  - [`.toTransitionLayerState(expectation)`](#totransitionlayerstateexpectation)
  - [`.toKeepLayerStateUnchanged()`](#tokeeeplayerstateunchanged)
  - [`.not.toChangeOtherLayersWhenActivating(layer)`](#nottochangeotherlayerswhenactivatinglayer)
  - [`.not.toChangeOtherLayersWhenDeactivating(layer)`](#nottochangeotherlayerswhendeactivatinglayer)

---

## フィクスチャー

### `describeCop(name, fn)`

COP テストの分離環境を作成します。テスト間で EMA の状態が干渉しないよう、自動的に状態を保存・復元します。

```javascript
import { describeCop } from 'cop-assertions';

describeCop('テスト名', () => {
    use.layer([LayerA, LayerB]);
    
    test('テスト1', () => {
        // テストコード
    });
});
```

`describeCop` は以下を自動的に行います：

- 宣言した層のみを有効化（他の層は無効化）
- テスト後に Signal の値を復元
- テスト後に EMA の状態を復元
- メソッド呼び出しの追跡を設定

---

### `use.layer(layers)`

テストで使用する層を宣言します。`describeCop` のコールバック内でのみ使用できます。

```javascript
describeCop('難易度テスト', () => {
    use.layer(HardModeLayer);  // 単一の層
    
    test('HardMode が動作する', () => {
        // ...
    });
});

describeCop('複数層テスト', () => {
    use.layer([HardModeLayer, TutorialLayer]);  // 複数の層
    
    test('複数の層が連携する', () => {
        // ...
    });
});
```

宣言していない層は自動的に無効化されます。これにより、テストが他の層の影響を受けることを防ぎます。

---

## マッチャー

### `.toBeActive()`

層がアクティブかどうかを検証します。

```javascript
expect(HardModeLayer).toBeActive();
expect(TutorialLayer).not.toBeActive();
```

#### 使用例

```javascript
describeCop('層の活性化', () => {
    use.layer(HardModeLayer);
    
    test('Signal で層が活性化される', () => {
        difficultySignal.value = 'hard';
        expect(HardModeLayer).toBeActive();
        
        difficultySignal.value = 'normal';
        expect(HardModeLayer).not.toBeActive();
    });
});
```

---

### `.toBeActiveFor(object)`

特定のオブジェクトに対して層がアクティブかどうかを検証します。オブジェクトスコープの層で使用します。

```javascript
expect(SpecialLayer).toBeActiveFor(enemy1);
expect(SpecialLayer).not.toBeActiveFor(enemy2);
```

#### 使用例

```javascript
describeCop('オブジェクトスコープ', () => {
    use.layer(SpecialLayer);
    
    test('特定のオブジェクトにのみ層が適用される', () => {
        const enemy1 = new Enemy(canvas);
        const enemy2 = new Enemy(canvas);
        
        enemy1.enableSpecialMode();
        
        expect(SpecialLayer).toBeActiveFor(enemy1);
        expect(SpecialLayer).not.toBeActiveFor(enemy2);
    });
});
```

---

### `.toBePartialMethodOf(layer)`

メソッドが特定の層の部分メソッドかどうかを検証します。層がアクティブな場合、そのメソッドは層の部分メソッドになります。

```javascript
expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
expect(enemy.getEnemyHP).not.toBePartialMethodOf(TutorialLayer);
```

#### 使用例

```javascript
describeCop('部分メソッドの検証', () => {
    use.layer(HardModeLayer);
    
    test('活性化した層の部分メソッドが使われる', () => {
        difficultySignal.value = 'hard';
        const enemy = new Enemy(canvas);
        
        expect(enemy.getEnemyHP).toBePartialMethodOf(HardModeLayer);
    });
    
    test('非活性化した層の部分メソッドは使われない', () => {
        difficultySignal.value = 'normal';
        const enemy = new Enemy(canvas);
        
        expect(enemy.getEnemyHP).not.toBePartialMethodOf(HardModeLayer);
    });
});
```

---

### `.toBeOriginalMethod()`

メソッドがオリジナル（層の影響を受けていない）かどうかを検証します。どの層もアクティブでない場合、メソッドはオリジナルになります。

```javascript
expect(enemy.getEnemyHP).toBeOriginalMethod();
expect(enemy.getEnemyHP).not.toBeOriginalMethod();
```

#### 使用例

```javascript
describeCop('オリジナルメソッドの検証', () => {
    use.layer([HardModeLayer, TutorialLayer]);
    
    test('全ての層が非活性化ならオリジナルメソッド', () => {
        difficultySignal.value = 'normal';
        tutorialSignal.value = false;
        
        const enemy = new Enemy(canvas);
        expect(enemy.getEnemyHP).toBeOriginalMethod();
    });
    
    test('層が活性化していればオリジナルではない', () => {
        difficultySignal.value = 'hard';
        
        const enemy = new Enemy(canvas);
        expect(enemy.getEnemyHP).not.toBeOriginalMethod();
    });
});
```

---

### `.toHaveLastExecutedBehaviorOf(layer)`

最後のメソッド呼び出しが特定の層の振る舞いを実行したかを検証します。オリジナルの振る舞いを検証する場合は `null` を渡します。

```javascript
expect(enemy.getEnemyHP).toHaveLastExecutedBehaviorOf(HardModeLayer);
expect(enemy.getEnemyHP).toHaveLastExecutedBehaviorOf(null);  // オリジナル
```

#### 使用例

```javascript
describeCop('振る舞いの検証', () => {
    use.layer(HardModeLayer);
    
    test('層の振る舞いが実行された', () => {
        difficultySignal.value = 'hard';
        const enemy = new Enemy(canvas);
        
        enemy.getEnemyHP();
        
        expect(enemy.getEnemyHP).toHaveLastExecutedBehaviorOf(HardModeLayer);
    });
    
    test('オリジナルの振る舞いが実行された', () => {
        difficultySignal.value = 'normal';
        const enemy = new Enemy(canvas);
        
        enemy.getEnemyHP();
        
        expect(enemy.getEnemyHP).toHaveLastExecutedBehaviorOf(null);
    });
});
```

#### エラー出力

```
expect(Enemy.getEnemyHP).toHaveLastExecutedBehaviorOf(HardMode)

Expected: last call to execute behavior of HardMode
Received: last call (call #1) executed behavior of Tutorial
```

---

### `.toHaveNthExecutedBehaviorOf(n, layer)`

n 回目のメソッド呼び出しが特定の層の振る舞いを実行したかを検証します。n は 1 から始まります。

```javascript
expect(enemy.getEnemyHP).toHaveNthExecutedBehaviorOf(1, HardModeLayer);
expect(enemy.getEnemyHP).toHaveNthExecutedBehaviorOf(2, null);
```

#### 使用例

```javascript
describeCop('複数回の呼び出し', () => {
    use.layer(HardModeLayer);
    
    test('呼び出しごとに異なる層の振る舞い', () => {
        const enemy = new Enemy(canvas);
        
        // 1回目: HardMode
        difficultySignal.value = 'hard';
        enemy.getEnemyHP();
        
        // 2回目: オリジナル
        difficultySignal.value = 'normal';
        enemy.getEnemyHP();
        
        expect(enemy.getEnemyHP).toHaveNthExecutedBehaviorOf(1, HardModeLayer);
        expect(enemy.getEnemyHP).toHaveNthExecutedBehaviorOf(2, null);
    });
});
```

:::note
n 引数は 1 以上の正の整数である必要があります。
:::

---

### `.toHaveAllExecutedBehaviorOf(layer)`

全てのメソッド呼び出しが特定の層の振る舞いを実行したかを検証します。

```javascript
expect(enemy.getEnemyHP).toHaveAllExecutedBehaviorOf(HardModeLayer);
expect(enemy.getEnemyHP).not.toHaveAllExecutedBehaviorOf(HardModeLayer);
```

#### 使用例

```javascript
describeCop('全ての呼び出しを検証', () => {
    use.layer(HardModeLayer);
    
    test('全ての呼び出しが同じ層の振る舞い', () => {
        difficultySignal.value = 'hard';
        const enemy = new Enemy(canvas);
        
        enemy.getEnemyHP();
        enemy.getEnemyHP();
        enemy.getEnemyHP();
        
        expect(enemy.getEnemyHP).toHaveAllExecutedBehaviorOf(HardModeLayer);
    });
});
```

#### エラー出力

```
expect(Enemy.getEnemyHP).toHaveAllExecutedBehaviorOf(HardMode)

Expected: all calls to execute behavior of HardMode
Received: 1 of 3 call(s) executed different behavior

Trace:
  - call #1: HardMode ✓
  - call #2: HardMode ✓
  - call #3: Original (no layer) ✗
```

---

### `.toExecuteInOrder(layers)`

proceed チェーンで層が指定した順序で実行されたかを検証します。

:::caution 前提条件
- `EMA.config({ proceedMode: 'chain' })` が必要
- `EMA.resolveConflict()` で順序が定義されていること
:::

```javascript
expect(obj.process).toExecuteInOrder([LayerA, LayerB]);
```

#### 使用例

```javascript
describeCop('proceed チェーン', () => {
    use.layer([LayerA, LayerB]);
    
    beforeEach(() => {
        EMA.config({ proceedMode: 'chain' });
        EMA.resolveConflict(TestClass.prototype, 'process', [LayerA, LayerB]);
    });
    
    afterEach(() => {
        EMA.clearConflictResolutions();
        EMA.config({ proceedMode: 'original' });
    });
    
    test('層が順番に実行される', () => {
        EMA.activate(LayerA);
        EMA.activate(LayerB);
        
        const obj = new TestClass();
        obj.process(5);
        
        expect(obj.process).toExecuteInOrder([LayerA, LayerB]);
    });
});
```

#### エラー出力

```
expect(TestClass.process).toExecuteInOrder([LayerA, LayerB])

Expected execution order:
  1. LayerA
  2. LayerB

Received execution order:
  1. LayerB
  2. LayerA
```

---

### `.toHaveUsedConflictResolution()`

メソッド呼び出しがコンフリクト解決のカスタムメソッドを経由したかを検証します。

:::caution 前提条件
- `EMA.config({ proceedMode: 'chain' })` が必要
- `EMA.resolveConflict()` でコールバックが定義されていること
:::

```javascript
expect(enemy.getSpeed).toHaveUsedConflictResolution();
expect(enemy.getSpeed).not.toHaveUsedConflictResolution();
```

#### 使用例

```javascript
describeCop('コンフリクト解決', () => {
    use.layer([HardModeLayer, BossWaveLayer]);
    
    beforeEach(() => {
        EMA.config({ proceedMode: 'chain' });
        EMA.resolveConflict(
            Enemy.prototype,
            'getSpeed',
            [HardModeLayer, BossWaveLayer],
            (partialMethods, originalMethod) => {
                return function() {
                    // 両方の結果を足す
                    let result = 0;
                    if (partialMethods.HardMode) {
                        result += partialMethods.HardMode.call(this);
                    }
                    if (partialMethods.BossWave) {
                        result += partialMethods.BossWave.call(this);
                    }
                    return result;
                };
            }
        );
    });
    
    afterEach(() => {
        EMA.clearConflictResolutions();
        EMA.config({ proceedMode: 'original' });
    });
    
    test('両方の層がアクティブならコンフリクト解決が使われる', () => {
        difficultySignal.value = 'hard';
        bossWaveSignal.value = true;
        
        const enemy = new Enemy(canvas);
        enemy.getSpeed();
        
        expect(enemy.getSpeed).toHaveUsedConflictResolution();
    });
});
```

#### エラー出力

```
expect(Enemy.getSpeed).toHaveUsedConflictResolution()

Expected: to use conflict resolution
Received: executed behavior of BossWave (no conflict resolution)
```

---

### `.toCallConflictingMethod()`

複数の層が同じメソッドを同時に活性化してコンフリクトを起こしているかを検証します。通常は `.not` と一緒に使用して、コンフリクトがないことを確認します。

```javascript
expect(() => {
    enemy.getSpeed();
}).not.toCallConflictingMethod();

expect(() => {
    enemy.getSpeed();
}).toCallConflictingMethod();
```

#### 使用例

```javascript
describeCop('コンフリクト検出', () => {
    use.layer([HardModeLayer, BossWaveLayer]);
    
    test('コンフリクトがないことを確認', () => {
        difficultySignal.value = 'hard';
        bossWaveSignal.value = false;
        
        const enemy = new Enemy(canvas);
        
        expect(() => {
            enemy.getSpeed();
        }).not.toCallConflictingMethod();
    });
    
    test('コンフリクトが発生することを確認', () => {
        difficultySignal.value = 'hard';
        bossWaveSignal.value = true;
        
        const enemy = new Enemy(canvas);
        
        expect(() => {
            enemy.getSpeed();
        }).toCallConflictingMethod();
    });
});
```

#### エラー出力

```
expect(fn).not.toCallConflictingMethod()

Expected: no conflicting method calls
Received: Conflicting method call detected:
  Method: Enemy.getSpeed
  Active layers with this method: [HardMode, BossWave]
  Multiple layers are refining the same method and are all active.
```

---

### `.toTransitionLayerState(expectation)`

関数実行前後で層の状態が期待通りに遷移することを検証します。

```javascript
expect(fn).toTransitionLayerState({
    from: { active: [...], inactive: [...] },
    to: { active: [...], inactive: [...] }
});
```

#### 使用例

```javascript
describeCop('状態遷移', () => {
    use.layer([HardModeLayer, TutorialLayer]);
    
    test('Signal による層の活性化を検証', () => {
        tutorialSignal.value = true;
        difficultySignal.value = 'normal';
        
        expect(() => {
            difficultySignal.value = 'hard';
        }).toTransitionLayerState({
            from: { active: [TutorialLayer], inactive: [HardModeLayer] },
            to: { active: [TutorialLayer, HardModeLayer], inactive: [] }
        });
    });
    
    test('Signal による層の非活性化を検証', () => {
        tutorialSignal.value = true;
        difficultySignal.value = 'hard';
        
        expect(() => {
            difficultySignal.value = 'normal';
        }).toTransitionLayerState({
            from: { active: [TutorialLayer, HardModeLayer] },
            to: { inactive: [HardModeLayer] }
        });
    });
});
```

#### エラー出力

```
expect(fn).toTransitionLayerState({ from, to })

Layer state mismatch after execution:
  - HardMode should be inactive after execution, but was active
```

---

### `.toKeepLayerStateUnchanged()`

関数実行中に層の状態が変化しないことを検証します。

```javascript
expect(fn).toKeepLayerStateUnchanged();
expect(fn).not.toKeepLayerStateUnchanged();
```

#### 使用例

```javascript
describeCop('状態の不変性', () => {
    use.layer(TutorialLayer);
    
    test('通常の処理では状態が変わらない', () => {
        tutorialSignal.value = true;
        const enemy = new Enemy(canvas);
        
        expect(() => {
            enemy.x = 100;
            enemy.y = 200;
        }).toKeepLayerStateUnchanged();
    });
    
    test('Signal の変更で状態が変わる', () => {
        tutorialSignal.value = true;
        
        expect(() => {
            expect(() => {
                tutorialSignal.value = false;
            }).toKeepLayerStateUnchanged();
        }).toThrow();
    });
});
```

#### エラー出力

```
expect(fn).toKeepLayerStateUnchanged()

Expected: layer state to remain unchanged during execution
Received: layer state changed

Changes:
  - Layer 'HardMode' was activated
```

---

### `.not.toChangeOtherLayersWhenActivating(layer)`

関数実行中に層が活性化されたとき、他の層が変化しないことを検証します。EMA.activate() による明示的活性化と、Signal による暗黙的活性化の両方を検出できます。スコープ内のメソッド呼び出しで発生する活性化も検出可能です。

```javascript
expect(fn).not.toChangeOtherLayersWhenActivating(Layer);
```

#### 使用例

```javascript
describeCop('活性化の副作用', () => {
    use.layer([HardModeLayer, TutorialLayer]);
    
    test('EMA.activate で活性化しても他の層が変わらない', () => {
        expect(() => {
            EMA.activate(HardModeLayer);
        }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
    });
    
    test('Signal で活性化しても他の層が変わらない', () => {
        difficultySignal.value = 'normal';
        
        expect(() => {
            difficultySignal.value = 'hard';
        }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
    });
    
    test('スコープ内のメソッド呼び出しで活性化しても検出できる', () => {
        function activateHardMode() {
            difficultySignal.value = 'hard';
        }
        
        expect(() => {
            activateHardMode();  // 関数内で活性化
        }).not.toChangeOtherLayersWhenActivating(HardModeLayer);
    });
    
    test('メソッド内部での活性化も検出できる', () => {
        expect(() => {
            player.enterBossRoom();  // 内部で BossWaveLayer が活性化
        }).not.toChangeOtherLayersWhenActivating(BossWaveLayer);
    });
});
```

#### エラー出力

```
expect(fn).not.toChangeOtherLayersWhenActivating(HardMode)

Expected: other layers NOT to change when activating 'HardMode'
Received: other layers changed

Changes:
  - Layer 'Tutorial' was deactivated
```

---

### `.not.toChangeOtherLayersWhenDeactivating(layer)`

関数実行中に層が非活性化されたとき、他の層が変化しないことを検証します。EMA.deactivate() による明示的非活性化と、Signal による暗黙的非活性化の両方を検出できます。

```javascript
expect(fn).not.toChangeOtherLayersWhenDeactivating(Layer);
```

#### 使用例

```javascript
describeCop('非活性化の副作用', () => {
    use.layer([HardModeLayer, TutorialLayer]);
    
    test('EMA.deactivate で非活性化しても他の層が変わらない', () => {
        EMA.activate(HardModeLayer);
        
        expect(() => {
            EMA.deactivate(HardModeLayer);
        }).not.toChangeOtherLayersWhenDeactivating(HardModeLayer);
    });
    
    test('Signal で非活性化しても他の層が変わらない', () => {
        difficultySignal.value = 'hard';
        
        expect(() => {
            difficultySignal.value = 'normal';
        }).not.toChangeOtherLayersWhenDeactivating(HardModeLayer);
    });
    
    test('スコープ内のメソッド呼び出しで非活性化しても検出できる', () => {
        difficultySignal.value = 'hard';
        
        function deactivateHardMode() {
            difficultySignal.value = 'normal';
        }
        
        expect(() => {
            deactivateHardMode();
        }).not.toChangeOtherLayersWhenDeactivating(HardModeLayer);
    });
});
```

#### エラー出力

```
expect(fn).not.toChangeOtherLayersWhenDeactivating(HardMode)

Expected: other layers NOT to change when deactivating 'HardMode'
Received: other layers changed

Changes:
  - Layer 'Tutorial' was activated
```

---


---

## セットアップ

### マッチャーの登録

テストファイルでマッチャーを使用するには、`expect.extend` で登録する必要があります。

```javascript
import { 
    describeCop,
    toBeActive,
    toBeActiveFor,
    toBePartialMethodOf,
    toBeOriginalMethod,
    toHaveLastExecutedBehaviorOf,
    toHaveNthExecutedBehaviorOf,
    toHaveAllExecutedBehaviorOf,
    toExecuteInOrder,
    toHaveUsedConflictResolution,
    toCallConflictingMethod,
    toTransitionLayerState,
    toKeepLayerStateUnchanged,
    toChangeOtherLayersWhenActivating,
    toChangeOtherLayersWhenDeactivating
} from 'cop-assertions';

expect.extend({ 
    toBeActive,
    toBeActiveFor,
    toBePartialMethodOf,
    toBeOriginalMethod,
    toHaveLastExecutedBehaviorOf,
    toHaveNthExecutedBehaviorOf,
    toHaveAllExecutedBehaviorOf,
    toExecuteInOrder,
    toHaveUsedConflictResolution,
    toCallConflictingMethod,
    toTransitionLayerState,
    toKeepLayerStateUnchanged,
    toChangeOtherLayersWhenActivating,
    toChangeOtherLayersWhenDeactivating
});
```

### Jest 設定

```javascript
// jest.config.js
export default {
    testEnvironment: 'node',
    transform: {},
    moduleFileExtensions: ['js'],
    testMatch: ['**/__tests__/**/*.test.js'],
};
```

---

## API 一覧

### 層の状態

| マッチャー | 用途 |
|-----------|------|
| `.toBeActive()` | 層がアクティブか |
| `.toBeActiveFor(object)` | オブジェクトに対して層がアクティブか |

### メソッド検証

| マッチャー | 用途 |
|-----------|------|
| `.toBePartialMethodOf(layer)` | 層の部分メソッドか |
| `.toBeOriginalMethod()` | オリジナルメソッドか |

### 振る舞い検証

| マッチャー | 用途 |
|-----------|------|
| `.toHaveLastExecutedBehaviorOf(layer)` | 最後の呼び出しがどの層の振る舞いか |
| `.toHaveNthExecutedBehaviorOf(n, layer)` | n回目の呼び出しがどの層の振る舞いか |
| `.toHaveAllExecutedBehaviorOf(layer)` | 全呼び出しがどの層の振る舞いか |

### チェーン・コンフリクト

| マッチャー | 用途 |
|-----------|------|
| `.toExecuteInOrder(layers)` | proceed チェーンの実行順序 |
| `.toHaveUsedConflictResolution()` | コンフリクト解決が使われたか |
| `.toCallConflictingMethod()` | コンフリクトが発生したか |

### 状態遷移・副作用

| マッチャー | 用途 |
|-----------|------|
| `.toTransitionLayerState({ from, to })` | 状態が期待通り遷移 |
| `.toKeepLayerStateUnchanged()` | 状態が変化しない |
| `.not.toChangeOtherLayersWhenActivating(layer)` | 活性化時に他の層が変化しない |
| `.not.toChangeOtherLayersWhenDeactivating(layer)` | 非活性化時に他の層が変化しない |