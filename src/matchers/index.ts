/**
 * COP テスト用マッチャー
 */

// 層の状態検証
export { toBeActive } from './toBeActive.js';
export { toBeActiveFor } from './toBeActiveFor.js';

// メソッドの検証
export { toBePartialMethodOf } from './toBePartialMethodOf.js';
export { toBeOriginalMethod } from './toBeOriginalMethod.js';

// 呼び出し履歴の検証
export { toHaveLastExecutedBehaviorOf } from './toHaveLastExecutedBehaviorOf.js';
export { toHaveNthExecutedBehaviorOf } from './toHaveNthExecutedBehaviorOf.js';
export { toExecuteInOrder } from './toExecuteInOrder.js';

// Jest への一括登録
export function registerMatchers() {
    if (typeof expect !== 'undefined' && typeof expect.extend === 'function') {
        const { toBeActive } = require('./toBeActive.js');
        const { toBeActiveFor } = require('./toBeActiveFor.js');
        const { toBePartialMethodOf } = require('./toBePartialMethodOf.js');
        const { toBeOriginalMethod } = require('./toBeOriginalMethod.js');
        const { toHaveLastExecutedBehaviorOf } = require('./toHaveLastExecutedBehaviorOf.js');
        const { toHaveNthExecutedBehaviorOf } = require('./toHaveNthExecutedBehaviorOf.js');
        const { toExecuteInOrder } = require('./toExecuteInOrder.js');
        
        expect.extend({
            toBeActive,
            toBeActiveFor,
            toBePartialMethodOf,
            toBeOriginalMethod,
            toHaveLastExecutedBehaviorOf,
            toHaveNthExecutedBehaviorOf,
            toExecuteInOrder,
        });
    }
}
