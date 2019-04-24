/* ------------------------------------------------------------------
* node-onvif - soap.js
*
* Copyright (c) 2016-2018, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2018-08-13
* ---------------------------------------------------------------- */
'use strict';
const mXml2Js = require('xml2js');
const http   = require('http');
const mCrypto = require('crypto');
let mHtml   = null;
try {
    mHtml   = require('html');
} catch(e) {}

/* ------------------------------------------------------------------
* Constructor: OnvifSoap()
* ---------------------------------------------------------------- */
function OnvifSoap() {
    this.HTTP_TIMEOUT = 3000; // milliseconds
}

/* ------------------------------------------------------------------
* Method: parse(soap)
* ---------------------------------------------------------------- */
OnvifSoap.prototype.parseXML = function(soap) {
    return new Promise((resolve, reject) => {
        let options = {
            'explicitRoot'     : false,
            'explicitArray'    : false,
            'ignoreAttrs'      : false, // Never change to `true`
            'tagNameProcessors': [
                (name) => {
                    const m = name.match(/^([^\:]+)\:([^\:]+)$/);
                    return (m ? m[2] : name);
                }
            ]
        };

        mXml2Js.parseString(soap, options, (error, result) => {
            if(error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
};

/* ------------------------------------------------------------------
* Method: requestCommand(oxaddr, method_name, soap)
* ---------------------------------------------------------------- */
OnvifSoap.prototype.requestCommand = function(oxaddr, methodName, soap) {
    return this._request(oxaddr, soap, methodName)
        .then(xml => this.parseXML(xml))
        .then(response => {
            const responseKey = `${methodName}Response`;

            if (!('Body' in response) || !(responseKey in response['Body'])) {
                throw new Error(`The device does not seem to support the ${methodName}() method.`);
            }

            return Promise.resolve(response['Body'][responseKey]);
        });
};

OnvifSoap.prototype._error = function(methodName, httpError, xmlError, onvifError) {
    let message = `${methodName}():`;

    if (httpError) {
        message += ` [HTTP status: ${httpError}]`;
    }

    if (xmlError) {
        message += ` [XML parsing error: ${xmlError.toString()}]`;
    }

    if (onvifError) {
        message += ` [Onvif error: ${onvifError.toString()}]`;
    }

    return new Error(message);
};

OnvifSoap.prototype._request = function(xaddr, soap, methodName) {
    return new Promise((resolve, reject) => {
        const postOptions = {
            protocol: xaddr.protocol,
            hostname: xaddr.hostname,
            port    : xaddr.port || 80,
            path    : xaddr.pathname,
            method  : 'POST',
            headers: {
                'Content-Type': 'application/soap+xml; charset=utf-8;',
                'Content-Length': Buffer.byteLength(soap)
            }
        };

        const request = http.request(postOptions);
        request.setTimeout(this.HTTP_TIMEOUT);

        const responseHandler = (response) => {
            response.setEncoding('utf8');

            let xml = '';
            response.on('data', (chunk) => {
                xml += chunk;
            });

            response.on('end', () => {
                if (request) {
                    request.removeAllListeners('error');
                    request.removeAllListeners('timeout');
                    request.removeAllListeners('response');
                }

                if (response.statusCode === 200) {
                    resolve(xml);
                }
                else {
                    const httpError = `${response.statusCode} ${response.statusMessage}`;

                    if (!xml) {
                        reject(this._error(methodName, httpError));
                    }

                    this.parseXML(xml)
                        .then((parsed) => {
                            let onvifMessage = parsed['Body']['Fault']['Reason']['Text'];
                            if ((typeof onvifMessage) === 'object') {
                                onvifMessage = onvifMessage['_'];
                            }

                            const detail = parsed['Body']['Fault']['Detail']['Text'];
                            onvifMessage += ' - ' + ((typeof detail) === 'object' ? detail['_'] : detail);

                            reject(this._error(methodName, httpError, null, onvifMessage));
                        })
                        .catch((xmlError) => reject(this._error(methodName, httpError, xmlError)));
                }
            });
        };

        request.on('response', responseHandler);
        request.on('timeout', () => request.abort());
        request.on('error', (error) => {
            request.removeAllListeners('error');
            request.removeAllListeners('timeout');
            reject(new Error('Network Error: ' + (error ? error.message : '')));
        });
        request.write(soap, 'utf8');
        request.end();
    });
};

/* ------------------------------------------------------------------
* Method: createRequestSoap(params)
* - params:
*   - body: description in the <s:Body>
*   - xmlns: a list of xmlns attributes used in the body
*       e.g., xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
*   - diff: Time difference [ms]
*   - user: user name
*   - pass: password
* ---------------------------------------------------------------- */
OnvifSoap.prototype.createRequestSoap = function(params) {
    let soap = '';
    soap += '<?xml version="1.0" encoding="UTF-8"?>';
    soap += '<s:Envelope';
    soap += '  xmlns:s="http://www.w3.org/2003/05/soap-envelope"';
    if(params['xmlns'] && Array.isArray(params['xmlns'])) {
        params['xmlns'].forEach((ns) => {
            soap += ' ' + ns;
        });
    }
    soap += '>';
    soap += '<s:Header>';
    if(params['user']) {
        soap += this._createSoapUserToken(params['diff'], params['user'], params['pass']);
    }
    soap += '</s:Header>';
    soap += '<s:Body>' + params['body'] + '</s:Body>';
    soap += '</s:Envelope>';

    soap = soap.replace(/\>\s+\</g, '><');
    return soap;
};

OnvifSoap.prototype._createSoapUserToken = function(diff, user, pass) {
    if(!diff) {diff = 0;}
    if(!pass) {pass = '';}
    let date = (new Date(Date.now() + diff)).toISOString();
    let nonce_buffer = this._createNonce(16);
    let nonce_base64 = nonce_buffer.toString('base64');
    let shasum = mCrypto.createHash('sha1');
    shasum.update(Buffer.concat([nonce_buffer, Buffer.from(date), new Buffer.from(pass)]));
    let digest = shasum.digest('base64');
    let soap = '';
    soap += '<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">';
    soap += '  <UsernameToken>';
    soap += '    <Username>' + user + '</Username>';
    soap += '    <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' + digest + '</Password>';
    soap += '    <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' + nonce_base64 + '</Nonce>';
    soap += '    <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' + date + '</Created>';
    soap += '  </UsernameToken>';
    soap += '</Security>';
    return soap;
};

OnvifSoap.prototype._createNonce = function(digit) {
    let nonce = Buffer.alloc(digit);
    for(let i=0; i<digit; i++){
        nonce.writeUInt8(Math.floor(Math.random() * 256), i);
    }
    return nonce;
};




OnvifSoap.prototype.isStringValue = function(value, allow_empty) {
    return !this.isInvalidValue(value, 'string', allow_empty);
};

OnvifSoap.prototype.isIntValue = function(value, allow_empty) {
    return !this.isInvalidValue(value, 'integer', allow_empty);
};

OnvifSoap.prototype.isFloatValue = function(value, allow_empty) {
    return !this.isInvalidValue(value, 'float', allow_empty);
};

OnvifSoap.prototype.isObjectValue = function(value, allow_empty) {
    return !this.isInvalidValue(value, 'object', allow_empty);
};

OnvifSoap.prototype.isBooleanValue = function(value, allow_empty) {
    return !this.isInvalidValue(value, 'boolean', allow_empty);
};

/* ------------------------------------------------------------------
* Method: isInvalidValue(value, type, allow_empty)
* - type: 'undefined', 'null', 'array', 'integer', 'float', 'boolean', 'object'
* ---------------------------------------------------------------- */
OnvifSoap.prototype.isInvalidValue = function(value, type, allow_empty) {
    let vt = this._getTypeOfValue(value);
    if(type === 'float') {
        if(!vt.match(/^(float|integer)$/)) {
            return 'The type of the value must be "' + type + '".';
        }
    } else {
        if(vt !== type) {
            return 'The type of the value must be "' + type + '".';
        }
    }

    if(!allow_empty) {
        if(vt === 'array' && value.length === 0) {
            return 'The value must not be an empty array.';
        } else if(vt === 'string' && value === '') {
            return 'The value must not be an empty string.';
        }
    }
    if(typeof(value) === 'string') {
        if(value.match(/[^\x20-\x7e]/)) {
            return 'The value must consist of ascii characters.';
        }
        if(value.match(/[\<\>]/)) {
            return 'Invalid characters were found in the value ("<", ">")';
        }
    }
    return '';
};

OnvifSoap.prototype._getTypeOfValue = function(value) {
    if(value === undefined) {
        return 'undefined';
    } else if(value === null) {
        return 'null';
    } else if(Array.isArray(value)) {
        return 'array';
    }
    let t = typeof(value);
    if(t === 'boolean') {
        return 'boolean';
    } else if(t === 'string') {
        return 'string';
    } else if(t === 'number') {
        if(value % 1 === 0) {
            return 'integer';
        } else {
            return 'float';
        }
    } else if(t === 'object') {
        if(Object.prototype.toString.call(value) === '[object Object]') {
            return 'object';
        } else {
            return 'unknown';
        }
    } else {
        return 'unknown';
    }
};

module.exports = new OnvifSoap();
