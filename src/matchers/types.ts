/**
 * マッチャーの共通型定義
 */

// Jest のマッチャー結果
export interface MatcherResult {
    pass: boolean;
    message: () => string;
}
