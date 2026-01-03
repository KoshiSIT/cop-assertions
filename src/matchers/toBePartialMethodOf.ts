/**
 * toBePartialMethodOf マッチャー
 * 
 * 現在のメソッドが指定した層の部分メソッドであるかを検証する。
 */

import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import OriginalMethodsPool from '../ema/OriginalMethodsPool.js';
import { MatcherResult } from '../core/types.js';

/**
 * 現在のメソッドが指定した層の部分メソッドであるかを検証
 * 
 * @example
 * EMA.activate(NightLayer);
 * expect(screen.getBrightness).toBePartialMethodOf(NightLayer);
 */
export function toBePartialMethodOf(received: any, layer: any): MatcherResult {
    const pool = (PartialMethodsPool as any)._partialMethods || [];
    
    // received（関数）が layer の部分メソッドかどうかを判定
    let foundMethodName: string | null = null;
    let foundClassName: string | null = null;
    let isOriginalMethod = false;
    
    // まず、received がどのメソッドかを特定
    for (const pm of pool) {
        const [obj, methodName] = pm;
        
        if (obj[methodName] === received) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            break;
        }
        
        // 元のメソッドかどうか確認
        const original = (OriginalMethodsPool as any).get(obj, methodName);
        if (original === received) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            isOriginalMethod = true;
        }
    }
    
    // received の __layer__ メタ情報から現在インストールされている Layer を取得
    const installedLayer = received?.__layer__ || null;
    
    // pass: 指定した Layer の部分メソッドがインストールされている
    const pass = installedLayer === layer;
    const methodInfo = foundMethodName 
        ? `${foundClassName}.${foundMethodName}` 
        : 'unknown method';
    const layerName = layer.name || 'Layer';
    
    return {
        pass,
        message: () => {
            if (isOriginalMethod && !installedLayer) {
                return `expect(received).toBePartialMethodOf(${layerName})\n\n` +
                       `Expected: ${methodInfo} to be a partial method of ${layerName}\n` +
                       `Received: ${methodInfo} is the original method (no Layer applied)`;
            }
            
            if (!installedLayer) {
                return `expect(received).toBePartialMethodOf(${layerName})\n\n` +
                       `Expected: ${methodInfo} to be a partial method of ${layerName}\n` +
                       `Received: ${methodInfo} is not a partial method`;
            }
            
            if (installedLayer !== layer) {
                return `expect(received).toBePartialMethodOf(${layerName})\n\n` +
                       `Expected: ${methodInfo} to be a partial method of ${layerName}\n` +
                       `Received: ${methodInfo} is a partial method of ${installedLayer?.name || 'unknown'}`;
            }
            
            // pass: true の場合（.not で失敗した場合）
            return `expect(received).not.toBePartialMethodOf(${layerName})\n\n` +
                   `Expected: ${methodInfo} not to be a partial method of ${layerName}\n` +
                   `Received: ${methodInfo} is a partial method of ${layerName}`;
        },
    };
}

export default toBePartialMethodOf;
