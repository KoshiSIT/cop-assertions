// ES Module loader for EMA.js
import EMA from './EMA.js';
import Layer from './Layer.js';
import Signal from './Signal.js';
import SignalComp from './SignalComp.js';
import { 
    installObjectScopeExtension, 
    uninstallObjectScopeExtension, 
    isObjectScopeExtensionInstalled 
} from './ObjectScopeExtension.js';

// Export for ES Modules
export { 
    EMA, 
    Layer, 
    Signal, 
    SignalComp,
    installObjectScopeExtension,
    uninstallObjectScopeExtension,
    isObjectScopeExtensionInstalled
};
export const show = console.log;
