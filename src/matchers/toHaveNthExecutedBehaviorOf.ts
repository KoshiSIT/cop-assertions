/**
 * toHaveNthExecutedBehaviorOf マッチャー
 * 
 * メソッドの n 番目の呼び出しが指定した層の振る舞いを実行したことを検証する。
 */

import { CallTracker } from '../core/CallTracker.js';
import { MatcherResult } from '../core/types.js';

/**
 * メソッドの n 番目の呼び出しが指定した層の振る舞いを実行したことを検証
 * 
 * @example
 * screen.adjustBrightness();  // 1回目
 * screen.adjustBrightness();  // 2回目
 * expect(screen.adjustBrightness).toHaveNthExecutedBehaviorOf(1, DayLayer);
 * expect(screen.adjustBrightness).toHaveNthExecutedBehaviorOf(2, NightLayer);
 */
export function toHaveNthExecutedBehaviorOf(received: any, n: number, expectedLayer: any): MatcherResult {
    // received から (obj, methodName) を取得
    const methodInfo = CallTracker.getMethodInfo(received);
    
    if (!methodInfo) {
        return {
            pass: false,
            message: () => 
                `expect(received).toHaveNthExecutedBehaviorOf(${n}, Layer)\n\n` +
                `Error: The received function is not being tracked.\n` +
                `Make sure the method is defined as a partial method for a layer declared with use.layer().`
        };
    }
    
    const { obj, methodName } = methodInfo;
    const className = obj.constructor?.name || 'Object';
    const expectedLayerName = expectedLayer?.name || 'Layer';
    const callCount = CallTracker.getCallCountFor(obj, methodName);
    
    // n のバリデーション
    if (n < 1) {
        return {
            pass: false,
            message: () =>
                `expect(${className}.${methodName}).toHaveNthExecutedBehaviorOf(${n}, ${expectedLayerName})\n\n` +
                `Error: n must be >= 1 (1-indexed). Received: ${n}`
        };
    }
    
    const nthCall = CallTracker.getNthCallFor(obj, methodName, n);
    
    if (!nthCall) {
        return {
            pass: false,
            message: () =>
                `expect(${className}.${methodName}).toHaveNthExecutedBehaviorOf(${n}, ${expectedLayerName})\n\n` +
                `Error: Call #${n} does not exist.\n` +
                `Total calls: ${callCount}`
        };
    }
    
    const actualLayer = nthCall.layer;
    const pass = actualLayer === expectedLayer;
    
    const actualLayerName = actualLayer?.name || 'Original (no layer)';
    
    return {
        pass,
        message: () => {
            if (pass) {
                // .not で失敗した場合
                return `expect(${className}.${methodName}).not.toHaveNthExecutedBehaviorOf(${n}, ${expectedLayerName})\n\n` +
                       `Expected: call #${n} NOT to execute behavior of ${expectedLayerName}\n` +
                       `Received: call #${n} executed behavior of ${expectedLayerName}`;
            } else {
                return `expect(${className}.${methodName}).toHaveNthExecutedBehaviorOf(${n}, ${expectedLayerName})\n\n` +
                       `Expected: call #${n} to execute behavior of ${expectedLayerName}\n` +
                       `Received: call #${n} executed behavior of ${actualLayerName}`;
            }
        }
    };
}

export default toHaveNthExecutedBehaviorOf;
