/**
 * toBeActiveFor マッチャー
 * 
 * 層が特定のオブジェクトに対して活性化されているかを検証する。
 * ObjectScopeExtension をインストールしてから使用する。
 */

import EMA from '../ema/EMA.js';
import { MatcherResult } from '../core/types.js';

/**
 * 層が特定のオブジェクトに対して活性化されているかを検証
 * 
 * @example
 * import { installObjectScopeExtension } from './ema/ObjectScopeExtension.js';
 * installObjectScopeExtension();
 * 
 * EMA.activateFor(NightLayer, screen1);
 * 
 * expect(NightLayer).toBeActiveFor(screen1);
 * expect(NightLayer).not.toBeActiveFor(screen2);
 */
export function toBeActiveFor(received: any, obj: any): MatcherResult {
    const layerName = received?.name || 'unknown';
    const className = obj?.constructor?.name || 'Object';
    
    // EMA.isActiveFor が存在するか確認（拡張がインストールされているか）
    const emaAny = EMA as any;
    if (typeof emaAny.isActiveFor !== 'function') {
        return {
            pass: false,
            message: () =>
                `expect(${layerName}).toBeActiveFor(${className})

Error: ObjectScopeExtension is not installed.
Call installObjectScopeExtension() before using toBeActiveFor.`
        };
    }
    
    const isActiveFor = emaAny.isActiveFor(received, obj);
    
    return {
        pass: isActiveFor,
        message: () => {
            if (isActiveFor) {
                // .not で失敗した場合
                return `expect(${layerName}).not.toBeActiveFor(${className})

Expected: ${layerName} NOT to be active for the object
Received: ${layerName} IS active for the object`;
            }
            
            // 通常の失敗
            return `expect(${layerName}).toBeActiveFor(${className})

Expected: ${layerName} to be active for the object
Received: ${layerName} is NOT active for the object

Did you call EMA.activateFor(${layerName}, obj)?`;
        }
    };
}

export default toBeActiveFor;
