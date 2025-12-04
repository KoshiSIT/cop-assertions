// Browser ES Module loader for EMA.js
import EMA from './EMA.js';
import Layer from './Layer.js';
import Signal from './Signal.js';
import SignalComp from './SignalComp.js';

// Export for ES Modules
export { EMA, Layer, Signal, SignalComp };
export const show = console.log;

// Also expose globally for DevTools hook
window.EMA = EMA;
window.Layer = Layer;
window.Signal = Signal;
