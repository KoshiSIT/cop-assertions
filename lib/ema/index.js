const EMA = require('./EMA');
const Layer = require('./Layer');
const Signal =  require('./Signal');
const SignalComp = require('./SignalComp');

module.exports = {
    EMA: EMA,
    Layer: Layer,
    Signal: Signal,
    SignalComp: SignalComp,
    show: console.log
};
