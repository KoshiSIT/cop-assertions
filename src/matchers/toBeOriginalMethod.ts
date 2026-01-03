/**
 * toBeOriginalMethod マッチャー
 * 
 * 現在のメソッドがオリジナル（層の部分メソッドでない）であるかを検証する。
 */

import PartialMethodsPool from '../ema/PartialMethodsPool.js';
import OriginalMethodsPool from '../ema/OriginalMethodsPool.js';
import { MatcherResult } from '../core/types.js';

/**
 * 現在のメソッドがオリジナルであるかを検証
 * 
 * @example
 * // 層が活性化されていない状態
 * expect(screen.getBrightness).toBeOriginalMethod();
 */
export function toBeOriginalMethod(received: any): MatcherResult {
    const pool = (PartialMethodsPool as any)._partialMethods || [];
    
    // CallTracker でラップされている場合は、中身を取得
    const actualMethod = received?.__callTracked__ && received?.__wrappedMethod__ 
        ? received.__wrappedMethod__ 
        : received;
    
    // received（関数）が元のメソッドかどうかを判定
    let foundMethodName: string | null = null;
    let foundClassName: string | null = null;
    let originalMethod: any = null;
    let installedLayer: any = null;
    
    // まず、received がどのメソッドかを特定
    for (const pm of pool) {
        const [obj, methodName] = pm;
        
        // 現在インストールされているメソッドと比較
        if (obj[methodName] === received) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            originalMethod = (OriginalMethodsPool as any).get(obj, methodName);
            installedLayer = actualMethod?.__layer__ || null;
            break;
        }
        
        // 元のメソッドと比較
        const original = (OriginalMethodsPool as any).get(obj, methodName);
        if (original === received || original === actualMethod) {
            foundMethodName = methodName;
            foundClassName = obj.constructor?.name || 'unknown';
            originalMethod = original;
            break;
        }
    }
    
    // actualMethod の __layer__ メタ情報があれば部分メソッド
    const hasLayerMetadata = actualMethod?.__layer__ != null;
    
    // pass: 元のメソッドである（__layer__ がない、かつ OriginalMethodsPool のメソッドと一致）
    const isOriginal = !hasLayerMetadata && (originalMethod === actualMethod);
    
    const methodInfo = foundMethodName 
        ? `${foundClassName}.${foundMethodName}` 
        : 'unknown method';
    
    return {
        pass: isOriginal,
        message: () => {
            if (isOriginal) {
                // pass: true の場合（.not で失敗した場合）
                return `expect(received).not.toBeOriginalMethod()\n\n` +
                       `Expected: ${methodInfo} not to be the original method\n` +
                       `Received: ${methodInfo} is the original method`;
            }
            
            if (hasLayerMetadata) {
                const layerName = received.__layer__?.name || 'unknown';
                return `expect(received).toBeOriginalMethod()\n\n` +
                       `Expected: ${methodInfo} to be the original method\n` +
                       `Received: ${methodInfo} is a partial method of ${layerName}`;
            }
            
            if (originalMethod && originalMethod !== received) {
                return `expect(received).toBeOriginalMethod()\n\n` +
                       `Expected: ${methodInfo} to be the original method\n` +
                       `Received: ${methodInfo} is not the original method (modified)`;
            }
            
            return `expect(received).toBeOriginalMethod()\n\n` +
                   `Expected: ${methodInfo} to be the original method\n` +
                   `Received: ${methodInfo} is not a registered method`;
        },
    };
}

export default toBeOriginalMethod;
