const mOnvifSoap = require('./soap.js');

let lastError = '';

function setLastError(errorMessage) {
    lastError = new Error(errorMessage);

    return false;
}

function throwLast() {
    throw lastError;
}

function validateXAddr(xaddr) {
    const errorMessage = mOnvifSoap.isInvalidValue(xaddr, 'string');
    if (errorMessage) {
        return setLastError(`xaddr invalid: ${errorMessage}`);
    }

    return true;
}

module.exports = {
    throwLast,
    validateXAddr,
};
