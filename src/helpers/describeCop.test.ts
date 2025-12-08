import { describeCop } from './describeCop';

describe('describeCop', () => {
    test('関数として存在する', () => {
        expect(typeof describeCop).toBe('function');
    });
});

// describeCop の動作確認
let fnCalled = false;

describeCop('describeCop が関数を実行する', () => {
    fnCalled = true;
    
    test('関数が実行された', () => {
        expect(fnCalled).toBe(true);
    });
});

describeCop('use.layer が提供される', () => {
    test('use.layer が使える', () => {
        expect(typeof use.layer).toBe('function');
    });
});

describeCop('use.layer が layer を収集する', () => {
    const mockLayer = { name: 'HardMode', condition: 'difficulty === "hard"' };
    
    use.layer(mockLayer);
    
    test('layer が収集される', () => {
        // 後で getCurrentConfig を使って確認
        expect(true).toBe(true);
    });
});

describeCop('use.layer が配列を受け取れる', () => {
    const mockLayer1 = { name: 'HardMode', condition: 'difficulty === "hard"' };
    const mockLayer2 = { name: 'EasyMode', condition: 'difficulty === "easy"' };
    
    use.layer([mockLayer1, mockLayer2]);
    
    test('複数の layer が収集される', () => {
        // 後で getCurrentConfig を使って確認
        expect(true).toBe(true);
    });
});

// EMA を使った統合テスト
import EMA from '../ema/EMA.js';
import Signal from '../ema/Signal.js';
import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import OriginalMethodsPool from '../ema/OriginalMethodsPool.js';

// テスト用の COP 環境をセットアップ
describe('use.layer から関連オブジェクトを取得', () => {
    // テスト用の Signal, Layer, Class
    let difficultySignal: any;
    let HardModeLayer: any;
    let Enemy: any;
    
    beforeAll(() => {
        // Signal を作成
        difficultySignal = new Signal('normal', 'difficulty');
        
        // Class を作成
        Enemy = class {
            getEnemyHP() { return 1; }
        };
        
        // Layer を作成
        HardModeLayer = {
            name: 'HardMode',
            condition: 'difficulty === "hard"',
        };
        
        // EMA に登録
        EMA.addPartialMethod(HardModeLayer, Enemy.prototype, 'getEnemyHP', function() {
            return 3;
        });
        EMA.deploy(HardModeLayer);
        EMA.exhibit({}, { difficulty: difficultySignal });
    });
    
    test('Layer から Signal を取得できる', () => {
        // Layer の condition から Signal を特定
        // deployedLayer._cond._signals にある
        const deployedLayers = EMA.getLayers((layer: any) => 
            layer.__original__ === HardModeLayer
        );
        
        expect(deployedLayers.length).toBe(1);
        
        const deployedLayer = deployedLayers[0];
        const signals = deployedLayer._cond._signals;
        
        expect(signals).toContain(difficultySignal);
    });
    
    test('Layer から Class を取得できる', () => {
        // PartialMethodsPool から Layer に関連する Class を取得
        const pool = (PartialMethodsPool as any)._partialMethods || [];
        const partialMethods = pool.filter(
            (pm: any) => pm[3] === HardModeLayer
        );
        
        expect(partialMethods.length).toBeGreaterThan(0);
        
        // obj (Enemy.prototype) を取得
        const obj = partialMethods[0][0];
        expect(obj).toBe(Enemy.prototype);
    });
});

// 状態の独立性テスト
// Layer と Signal を describe の外で定義
const testSignal2 = new Signal('initial', 'testSignal2');

const TestLayer2 = {
    name: 'TestLayer2',
    condition: 'testSignal2 === "active"',
};

// EMA に登録
EMA.deploy(TestLayer2);
EMA.exhibit({}, { testSignal2: testSignal2 });

describeCop('テスト間で環境が独立する - Signal の値', () => {
    use.layer(TestLayer2);
    
    test('test1: Signal を変更', () => {
        testSignal2.value = 'changed';
        expect(testSignal2.value).toBe('changed');
    });
    
    test('test2: Signal は初期値に戻っている', () => {
        // test1 の変更が test2 に影響しないことを確認
        expect(testSignal2.value).toBe('initial');
    });
});

// 指定外の Layer の影響がないことをテスト
// テスト用のクラスと Layer を定義
class Player {
    getHP() { return 10; }
}

const playerSignal = new Signal('normal', 'playerMode');
const tutorialSignal = new Signal(true, 'tutorial');

const PlayerBoostLayer = {
    name: 'PlayerBoost',
    condition: 'playerMode === "boost"',
};

const TutorialLayer = {
    name: 'Tutorial',
    condition: 'tutorial === true',
};

// 両方の Layer を EMA に登録
EMA.addPartialMethod(PlayerBoostLayer, Player.prototype, 'getHP', function() {
    return 100;
});
EMA.addPartialMethod(TutorialLayer, Player.prototype, 'getHP', function() {
    return 999;  // チュートリアル中は無敵
});

EMA.deploy(PlayerBoostLayer);
EMA.deploy(TutorialLayer);
EMA.exhibit({}, { playerMode: playerSignal, tutorial: tutorialSignal });

describeCop('指定外の Layer の影響がない', () => {
    use.layer(PlayerBoostLayer);  // TutorialLayer は指定しない
    
    test('TutorialLayer が活性化条件を満たしても影響しない', () => {
        // tutorialSignal は true なので、通常なら TutorialLayer が活性化
        // しかし use.layer で指定していないので影響しないはず
        
        const player = new Player();
        
        // PlayerBoostLayer も活性化していない（playerMode === "normal"）
        // TutorialLayer も影響しない
        // → 元の getHP() が呼ばれるはず
        expect(player.getHP()).toBe(10);
    });
    
    test('指定した Layer だけが機能する', () => {
        playerSignal.value = 'boost';
        
        const player = new Player();
        
        // PlayerBoostLayer だけが活性化
        // TutorialLayer は影響しない
        expect(player.getHP()).toBe(100);
    });
});
