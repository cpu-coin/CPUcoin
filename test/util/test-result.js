const util = require('util');
const assert = require('assert');
const colors = require('colors');

let result = 0;
let attempts = 0;
let successes = 0;

function logNamedValue(name, thing) {
    console.log(name + ": " + util.inspect(thing, false, null, true /* enable colors */))
}

function resultFunc() {
    // Used temporarily when debugging
    function log(label) {
        logNamedValue((label ? label : 'Result:'), result);
    }
    this.log = log;

    function set(value) {
        result = value;
    }
    this.set = set;

    function get() {
        return result;
    }
    this.get = get;

    function _checkValuesAreEqual(x, y, displayMessage) {
        attempts++;
        assert.equal(x, y, displayMessage);
        successes++;
    }
    this.checkValuesAreEqual = _checkValuesAreEqual;

    function _checkValuesAreNotEqual(x, y, displayMessage) {
        attempts++;
        assert.notEqual(x, y, displayMessage);
        successes++;
    }
    this.checkValuesAreNotEqual = _checkValuesAreNotEqual;

    function _fail(displayMessage) {
        attempts++;
        assert.fail(displayMessage);
    }

    function _checkIsEqual(y, displayMessage) {
        attempts++;
        assert.equal(result, y, displayMessage);
        successes++;
    }
    this.checkIsEqual = _checkIsEqual;

    function _checkIsNotEqual(y, displayMessage) {
        attempts++;
        assert.notEqual(result, y, displayMessage);
        successes++;
    }
    this.checkIsNotEqual = _checkIsNotEqual;

    function checkIsTrue(displayMessage) {
        _checkIsEqual(true, displayMessage);
    }
    this.checkIsTrue = checkIsTrue;

    function checkDidFail(displayMessage) {
        return checkIsTrue(displayMessage);
    }

    function checkIsFalse(displayMessage) {
        _checkIsEqual(false, displayMessage);
    }
    this.checkIsFalse = checkIsFalse;

    function checkTransactionOk(displayMessage) {
        if (result === undefined)
            assert(colors.red('Result was undefined!'));
        const success = (typeof result === 'object' && typeof result.status !== 'undefined' ? result.status : result);
        _checkValuesAreEqual(success, true, displayMessage);
    }
    this.checkTransactionOk = checkTransactionOk;

    function getResults() {
        return [attempts, successes];
    }
    this.getResults = getResults;


    return Object.freeze({
        log: log,

        set: set,
        value: get,

        checkValuesAreEqual: _checkValuesAreEqual,
        checkValuesAreNotEqual: _checkValuesAreNotEqual,

        fail: _fail,
        checkIsEqual: _checkIsEqual,
        checkIsNotEqual: _checkIsNotEqual,
        checkIsTrue: checkIsTrue,
        checkDidFail: checkDidFail,            // checkDidFail (after expectFail) is an alias for checkIsTrue (i.e. was successful).
        checkIsFalse: checkIsFalse,
        checkTransactionOk: checkTransactionOk,

        getResults: getResults
    });
}

module.exports = resultFunc;
