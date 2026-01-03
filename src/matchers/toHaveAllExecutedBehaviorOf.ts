/**
 * toHaveAllExecutedBehaviorOf マッチャー
 * 
 * メソッドの全ての呼び出しが指定した層の振る舞いを実行したことを検証する。
 */

import { CallTracker } from '../core/CallTracker.js';
import { MatcherResult } from '../core/types.js';

/**
 * メソッドの全ての呼び出しが指定した層の振る舞いを実行したことを検証
 * 
 * @example
 * Night.enable();
 * door.close();  // 1回目
 * door.close();  // 2回目
 * door.close();  // 3回目
 * 
 * expect(door.close).toHaveAllExecutedBehaviorOf(NightLayer);
 */
export function toHaveAllExecutedBehaviorOf(received: any, expectedLayer: any): MatcherResult {
    // received から (obj, methodName) を取得
    const methodInfo = CallTracker.getMethodInfo(received);
    
    if (!methodInfo) {
        return {
            pass: false,
            message: () => 
                `expect(received).toHaveAllExecutedBehaviorOf(Layer)\n\n` +
                `Error: The received function is not being tracked.\n` +
                `Make sure the method is defined as a partial method for a layer declared with use.layer().`
        };
    }
    
    const { obj, methodName } = methodInfo;
    const allCalls = CallTracker.getCallsFor(obj, methodName);
    
    if (allCalls.length === 0) {
        const className = obj.constructor?.name || 'Object';
        return {
            pass: false,
            message: () =>
                `expect(${className}.${methodName}).toHaveAllExecutedBehaviorOf(${expectedLayer?.name || 'Layer'})\n\n` +
                `Error: No calls recorded for ${className}.${methodName}.\n` +
                `Make sure the method was called before this assertion.`
        };
    }
    
    // 全ての呼び出しが期待する層か確認
    const mismatches: { callNumber: number; actualLayer: any }[] = [];
    for (let i = 0; i < allCalls.length; i++) {
        const call = allCalls[i];
        if (call.layer !== expectedLayer) {
            mismatches.push({ callNumber: i + 1, actualLayer: call.layer });
        }
    }
    
    const pass = mismatches.length === 0;
    const className = obj.constructor?.name || 'Object';
    const expectedLayerName = expectedLayer?.name || 'Layer';
    const totalCalls = allCalls.length;
    
    return {
        pass,
        message: () => {
            if (pass) {
                // .not で失敗した場合
                return `expect(${className}.${methodName}).not.toHaveAllExecutedBehaviorOf(${expectedLayerName})\n\n` +
                       `Expected: NOT all calls to execute behavior of ${expectedLayerName}\n` +
                       `Received: all ${totalCalls} call(s) executed behavior of ${expectedLayerName}`;
            } else {
                // 通常の失敗
                const traceLines = allCalls.map((call, i) => {
                    const layerName = call.layer?.name || 'Original (no layer)';
                    const isMatch = call.layer === expectedLayer;
                    return `  - call #${i + 1}: ${layerName} ${isMatch ? '✓' : '✗'}`;
                });
                
                return `expect(${className}.${methodName}).toHaveAllExecutedBehaviorOf(${expectedLayerName})\n\n` +
                       `Expected: all calls to execute behavior of ${expectedLayerName}\n` +
                       `Received: ${mismatches.length} of ${totalCalls} call(s) executed different behavior\n\n` +
                       `Trace:\n${traceLines.join('\n')}`;
            }
        }
    };
}

export default toHaveAllExecutedBehaviorOf;
