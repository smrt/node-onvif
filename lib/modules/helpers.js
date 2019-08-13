const xml2Js = require('xml2js');

let lastError = '';

function setLastError(errorMessage) {
    lastError = new Error(errorMessage);

    return false;
}

function throwLast() {
    throw lastError;
}

function validateXAddr(xaddr) {
    const errorMessage = isInvalidValue(xaddr, 'string');
    if (errorMessage) {
        return setLastError(`xaddr invalid: ${errorMessage}`);
    }

    return true;
}

function parseXml(soap) {
    return new Promise((resolve, reject) => {
        let options = {
            'explicitRoot': false,
            'explicitArray': false,
            'ignoreAttrs': false, // Never change to `true`
            'tagNameProcessors': [
                (name) => {
                    const m = name.match(/^([^\:]+)\:([^\:]+)$/);
                    return (m ? m[2] : name);
                }
            ]
        };

        xml2Js.parseString(soap, options, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

function isStringValue(value, allow_empty) {
    return !isInvalidValue(value, 'string', allow_empty);
}

function isIntValue(value, allow_empty) {
    return !isInvalidValue(value, 'integer', allow_empty);
}

function isFloatValue(value, allow_empty) {
    return !isInvalidValue(value, 'float', allow_empty);
}

function isObjectValue(value, allow_empty) {
    return !isInvalidValue(value, 'object', allow_empty);
}

function isBooleanValue(value, allow_empty) {
    return !isInvalidValue(value, 'boolean', allow_empty);
}

/* ------------------------------------------------------------------
* Method: isInvalidValue(value, type, allow_empty)
* - type: 'undefined', 'null', 'array', 'integer', 'float', 'boolean', 'object'
* ---------------------------------------------------------------- */
function isInvalidValue(value, type, allow_empty) {
    let vt = getTypeOfValue(value);
    if (type === 'float') {
        if (!vt.match(/^(float|integer)$/)) {
            return 'The type of the value must be "' + type + '".';
        }
    } else {
        if (vt !== type) {
            return 'The type of the value must be "' + type + '".';
        }
    }

    if (!allow_empty) {
        if (vt === 'array' && value.length === 0) {
            return 'The value must not be an empty array.';
        } else if (vt === 'string' && value === '') {
            return 'The value must not be an empty string.';
        }
    }

    if (typeof (value) === 'string') {
        if (value.match(/[^\x20-\x7e]/)) {
            return 'The value must consist of ascii characters.';
        }
        if (value.match(/[\<\>]/)) {
            return 'Invalid characters were found in the value ("<", ">")';
        }
    }

    return '';
}

function getTypeOfValue(value) {
    if (value === undefined) {
        return 'undefined';
    } else if (value === null) {
        return 'null';
    } else if (Array.isArray(value)) {
        return 'array';
    }

    let t = typeof (value);
    if (t === 'boolean') {
        return 'boolean';
    } else if (t === 'string') {
        return 'string';
    } else if (t === 'number') {
        if (value % 1 === 0) {
            return 'integer';
        } else {
            return 'float';
        }
    } else if (t === 'object') {
        if (Object.prototype.toString.call(value) === '[object Object]') {
            return 'object';
        } else {
            return 'unknown';
        }
    } else {
        return 'unknown';
    }
}

function createNonce(digit) {
    let nonce = Buffer.alloc(digit);
    for (let i = 0; i < digit; i++) {
        nonce.writeUInt8(Math.floor(Math.random() * 256), i);
    }

    return nonce;
}

module.exports = {
    throwLast,
    validateXAddr,
    parseXml,
    isInvalidValue,
    isBooleanValue,
    isFloatValue,
    isIntValue,
    isObjectValue,
    isStringValue,
    createNonce
};
