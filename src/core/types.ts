/**
 * COP テスト用の共通型定義
 */

// 層の状態
export interface LayerState {
    name: string;
    active: boolean;
}

// 層の期待状態
export interface LayerStateExpectation {
    active?: any[];
    inactive?: any[];
}

// フックのタイミング
export type HookTiming = 'before' | 'after';

// フックに渡されるコンテキスト
export interface HookContext {
    target: any;                         // 対象オブジェクト (EMA, deployedLayer 等)
    methodName: string;                  // メソッド名
    args: any[];                         // 引数
    result?: any;                        // 戻り値 (after のみ)
    extra?: Record<string, any>;         // 追加データ (otherLayersBefore 等)
}

// フックコールバック
export type HookCallback = (context: HookContext) => void;

// 登録されたフック情報
export interface RegisteredHook {
    id: number;
    timing: HookTiming;
    callback: HookCallback;
    filter?: (context: HookContext) => boolean;  // 実行条件（省略時は常に実行）
}

// 呼び出し記録の型
export interface CallRecord {
    obj: any;           // prototype オブジェクト (e.g., Enemy.prototype)
    methodName: string; // メソッド名
    layer: any | null;  // 実行された層 (null = オリジナル)
    thisArg: any;       // 呼び出し時の this
    args: any[];        // 引数
    result: any;        // 戻り値
    chain?: any[];      // proceed チェーンで実行された層の順序
    conflictResolution?: boolean;  // コンフリクト解決が使われたか
    conflictLayers?: any[];        // コンフリクトした層
}

// 関数 → (obj, methodName) の逆引き用
export interface MethodInfo {
    obj: any;
    methodName: string;
}

// グローバルに use を追加するための型拡張
export interface Use {
    layer: (layer: any | any[]) => void;
}

// 設定を保持する型
export interface Config {
    layers: any[];
}

// 保存する状態の型
export interface SavedState {
    signals: Array<{ ref: any; value: any }>;
    prototypes: Array<{
        obj: any;
        methodName: string;
        method: any;
        descriptor: PropertyDescriptor | undefined;
    }>;
    deployedLayers: any[];
    signalInterfacePool: any[];
    originalInstallMethods: Array<{ layer: any; original: any }>;
    layerActiveStates: Array<{ layer: any; active: boolean }>;
}

// Jest Matcher の戻り値
export interface MatcherResult {
    pass: boolean;
    message: () => string;
}
