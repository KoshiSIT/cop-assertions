/**
 * Setup file for Jest
 * 
 * This file is meant to be used with Jest's setupFilesAfterEnv option.
 * 
 * @example
 * // In jest.config.js
 * module.exports = {
 *   setupFilesAfterEnv: ['cop-assertions/all'],
 * };
 */

import matchers from './src/matchers';

expect.extend(matchers);
