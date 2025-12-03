/**
 * cop-assertions
 * 
 * Custom Jest matchers for testing Context-Oriented Programming (COP) applications.
 * 
 * @example
 * // In jest.config.js
 * module.exports = {
 *   setupFilesAfterEnv: ['cop-assertions/all'],
 * };
 * 
 * // In your test file
 * test('layer is active', () => {
 *   expect(EasyModeLayer).toBeActive();
 * });
 */

import matchers from './matchers';

export default matchers;
export * from './matchers';
