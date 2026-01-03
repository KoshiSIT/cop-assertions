/**
 * toExecuteInOrder マッチャー
 * 
 * メソッドの最後の呼び出しで、proceed チェーンが指定した順序で実行されたことを検証する。
 */

import { CallTracker } from '../core/CallTracker.js';
import { MatcherResult } from '../core/types.js';

/**
 * メソッドの最後の呼び出しで、proceed チェーンが指定した順序で実行されたことを検証
 * 
 * @example
 * EMA.config({ proceedMode: 'chain' });
 * EMA.resolveConflict(Player.prototype, 'takeDamage', [EasyModeLayer, TutorialLayer]);
 * 
 * EMA.activate(EasyModeLayer);
 * EMA.activate(TutorialLayer);
 * player.takeDamage(10);
 * 
 * expect(player.takeDamage).toExecuteInOrder([EasyModeLayer, TutorialLayer]);
 */
export function toExecuteInOrder(received: any, expectedLayers: any[]): MatcherResult {
    // received から (obj, methodName) を取得
    const methodInfo = CallTracker.getMethodInfo(received);
    
    if (!methodInfo) {
        return {
            pass: false,
            message: () => 
                `expect(received).toExecuteInOrder([...])

Error: The received function is not being tracked.
Make sure the method is defined as a partial method for a layer declared with use.layer().`
        };
    }
    
    const { obj, methodName } = methodInfo;
    const className = obj.constructor?.name || 'Object';
    const lastCall = CallTracker.getLastCallFor(obj, methodName);
    
    if (!lastCall) {
        return {
            pass: false,
            message: () =>
                `expect(${className}.prototype.${methodName}).toExecuteInOrder([...])

Error: No execution chain recorded for this method.
Make sure the method was called before this assertion.`
        };
    }
    
    const actualChain = lastCall.chain || [];
    const expectedLayerNames = expectedLayers.map(l => l?.name || 'unknown');
    const actualLayerNames = actualChain.map((l: any) => l?.name || 'unknown');
    
    // 順序と内容が完全に一致するか確認
    const pass = expectedLayers.length === actualChain.length &&
                 expectedLayers.every((layer, i) => layer === actualChain[i]);
    
    // 差分を計算
    const missingLayers = expectedLayers.filter(l => !actualChain.includes(l));
    const extraLayers = actualChain.filter((l: any) => !expectedLayers.includes(l));
    
    const formatOrder = (layers: string[]): string => {
        if (layers.length === 0) return '  (empty)';
        return layers.map((name, i) => `  ${i + 1}. ${name}`).join('\n');
    };
    
    return {
        pass,
        message: () => {
            if (pass) {
                // .not で失敗した場合
                return `expect(${className}.prototype.${methodName}).not.toExecuteInOrder([${expectedLayerNames.join(', ')}])

Expected: execution order NOT to be [${expectedLayerNames.join(', ')}]
Received: execution order is [${actualLayerNames.join(', ')}]`;
            }
            
            let msg = `expect(${className}.prototype.${methodName}).toExecuteInOrder([${expectedLayerNames.join(', ')}])

Expected execution order:
${formatOrder(expectedLayerNames)}

Received execution order:
${formatOrder(actualLayerNames)}`;
            
            if (missingLayers.length > 0) {
                const missingNames = missingLayers.map(l => l?.name || 'unknown');
                msg += `\n\nMissing layers: [${missingNames.join(', ')}]`;
            }
            
            if (extraLayers.length > 0) {
                const extraNames = extraLayers.map((l: any) => l?.name || 'unknown');
                msg += `\n\nExtra layers executed: [${extraNames.join(', ')}]`;
            }
            
            return msg;
        }
    };
}

export default toExecuteInOrder;
