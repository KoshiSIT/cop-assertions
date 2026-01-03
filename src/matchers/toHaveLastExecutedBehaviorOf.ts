/**
 * toHaveLastExecutedBehaviorOf マッチャー
 * 
 * メソッドの最後の呼び出しが指定した層の振る舞いを実行したことを検証する。
 */

import { CallTracker } from '../core/CallTracker.js';
import { MatcherResult } from '../core/types.js';

/**
 * メソッドの最後の呼び出しが指定した層の振る舞いを実行したことを検証
 * 
 * @example
 * screen.adjustBrightness();
 * expect(screen.adjustBrightness).toHaveLastExecutedBehaviorOf(NightLayer);
 */
export function toHaveLastExecutedBehaviorOf(received: any, expectedLayer: any): MatcherResult {
    // received から (obj, methodName) を取得
    const methodInfo = CallTracker.getMethodInfo(received);
    
    if (!methodInfo) {
        return {
            pass: false,
            message: () => 
                `expect(received).toHaveLastExecutedBehaviorOf(Layer)\n\n` +
                `Error: The received function is not being tracked.\n` +
                `Make sure the method is defined as a partial method for a layer declared with use.layer().`
        };
    }
    
    const { obj, methodName } = methodInfo;
    const lastCall = CallTracker.getLastCallFor(obj, methodName);
    
    if (!lastCall) {
        const className = obj.constructor?.name || 'Object';
        return {
            pass: false,
            message: () =>
                `expect(${className}.${methodName}).toHaveLastExecutedBehaviorOf(${expectedLayer?.name || 'Layer'})\n\n` +
                `Error: No calls recorded for ${className}.${methodName}.\n` +
                `Make sure the method was called before this assertion.`
        };
    }
    
    const actualLayer = lastCall.layer;
    const pass = actualLayer === expectedLayer;
    
    const className = obj.constructor?.name || 'Object';
    const expectedLayerName = expectedLayer?.name || 'Layer';
    const actualLayerName = actualLayer?.name || 'Original (no layer)';
    const callCount = CallTracker.getCallCountFor(obj, methodName);
    
    return {
        pass,
        message: () => {
            if (pass) {
                // .not で失敗した場合
                return `expect(${className}.${methodName}).not.toHaveLastExecutedBehaviorOf(${expectedLayerName})\n\n` +
                       `Expected: last call NOT to execute behavior of ${expectedLayerName}\n` +
                       `Received: last call (call #${callCount}) executed behavior of ${expectedLayerName}`;
            } else {
                return `expect(${className}.${methodName}).toHaveLastExecutedBehaviorOf(${expectedLayerName})\n\n` +
                       `Expected: last call to execute behavior of ${expectedLayerName}\n` +
                       `Received: last call (call #${callCount}) executed behavior of ${actualLayerName}`;
            }
        }
    };
}

export default toHaveLastExecutedBehaviorOf;
