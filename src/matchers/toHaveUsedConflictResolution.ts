/**
 * toHaveUsedConflictResolution マッチャー
 * 
 * メソッドの呼び出しがコンフリクト解決を経由したことを検証する。
 * 
 * @example
 * // 両方の層がアクティブ（コンフリクト状態）
 * difficultySignal.value = 'hard';
 * bossWaveSignal.value = true;
 * 
 * enemy.getSpeed();
 * 
 * expect(enemy.getSpeed).toHaveUsedConflictResolution();
 */

import { CallTracker } from '../core/CallTracker.js';
import { MatcherResult } from '../core/types.js';

/**
 * メソッドの最後の呼び出しがコンフリクト解決を経由したことを検証
 */
export function toHaveUsedConflictResolution(received: any): MatcherResult {
    // received から (obj, methodName) を取得
    const methodInfo = CallTracker.getMethodInfo(received);
    
    if (!methodInfo) {
        return {
            pass: false,
            message: () => 
                `expect(received).toHaveUsedConflictResolution()\n\n` +
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
                `expect(${className}.${methodName}).toHaveUsedConflictResolution()\n\n` +
                `Error: No calls recorded for ${className}.${methodName}.\n` +
                `Make sure the method was called before this assertion.`
        };
    }
    
    const pass = lastCall.conflictResolution === true;
    const className = obj.constructor?.name || 'Object';
    
    return {
        pass,
        message: () => {
            if (pass) {
                // .not で失敗した場合
                const layerNames = lastCall.conflictLayers?.map((l: any) => l?.name || 'unknown').join(', ') || '';
                return `expect(${className}.${methodName}).not.toHaveUsedConflictResolution()\n\n` +
                       `Expected: NOT to use conflict resolution\n` +
                       `Received: conflict resolution was used for layers [${layerNames}]`;
            } else {
                // 通常の失敗（コンフリクト解決が使われなかった）
                const layerName = lastCall.layer?.name || 'Original (no layer)';
                return `expect(${className}.${methodName}).toHaveUsedConflictResolution()\n\n` +
                       `Expected: to use conflict resolution\n` +
                       `Received: executed behavior of ${layerName} (no conflict resolution)`;
            }
        }
    };
}

export default toHaveUsedConflictResolution;
