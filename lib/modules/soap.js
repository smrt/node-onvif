/* ------------------------------------------------------------------
* node-onvif - soap.js
*
* Copyright (c) 2016-2018, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2018-08-13
* ---------------------------------------------------------------- */
'use strict';
const http = require('http');
const crypto = require('crypto');
const helpers = require('./helpers.js');

/* ------------------------------------------------------------------
* Constructor: OnvifSoap()
* ---------------------------------------------------------------- */
function OnvifSoap() {
    this.HTTP_TIMEOUT = 3000; // milliseconds
}

/* ------------------------------------------------------------------
* Method: requestCommand(xaddr, method_name, soap)
* ---------------------------------------------------------------- */
OnvifSoap.prototype.requestCommand = function (xaddr, methodName, soap) {
    return request(xaddr, soap, methodName, this.HTTP_TIMEOUT)
        .then(xml => helpers.parseXml(xml))
        .then(response => parseValidResponse(response, methodName));
};

function request(xaddr, soap, methodName, timeout) {
    return new Promise((resolve, reject) => {
        const request = http.request(buildSoapRequestPostParams(xaddr, soap));

        request.setTimeout(timeout);
        request.on('response', response => soapResponseHandler(response, request, methodName, resolve, reject));
        request.on('timeout', () => request.abort());
        request.on('error', (error) => {
            // Here we handle errors due to network losses
            request.removeAllListeners('error');
            request.removeAllListeners('timeout');
            reject(new Error('Network Error: ' + (error ? error.message : '')));
        });
        request.write(soap, 'utf8');
        request.end();
    });
}

function parseValidResponse(response, methodName) {
    const responseKey = `${methodName}Response`;

    if (!('Body' in response) || !(responseKey in response['Body'])) {
        throw new Error(`The device does not seem to support the ${methodName}() method.`);
    }

    return Promise.resolve(response['Body'][responseKey]);
}

function buildSoapRequestPostParams(xaddr, soap) {
    return {
        protocol: xaddr.protocol,
        hostname: xaddr.hostname,
        port: xaddr.port || 80,
        path: xaddr.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8;',
            'Content-Length': Buffer.byteLength(soap)
        }
    }
}

function soapResponseHandler(response, request, methodName, resolve, reject) {
    response.setEncoding('utf8');

    let xml = '';
    response.on('data', (chunk) => {
        xml += chunk;
    });

    response.on('end', () => {
        // Stop listening for request responses
        if (request) {
            request.removeAllListeners('error');
            request.removeAllListeners('timeout');
            request.removeAllListeners('response');
        }

        // Return successful responses
        if (response.statusCode === 200) {
            return resolve(xml);
        }

        // Handle errors
        const httpError = {
            code: response.statusCode,
            message: response.statusMessage
        };

        if (!xml) {
            return reject(formatError(methodName, httpError));
        }

        helpers.parseXml(xml)
            .then(parsed => reject(formatError(methodName, httpError, null, parseOnvifError(parsed))))
            .catch(xmlError => reject(formatError(methodName, httpError, xmlError)));
    });
}

function formatError(methodName, httpError, xmlError, onvifError) {
    let message = `${methodName}():`;

    if (httpError && httpError.code === 400 && onvifError && onvifError.message.includes('Sender not authorized')) {
        message += ' [HTTP status: 401 Unauthorized]';
    } else {
        if (httpError) {
            message += ` [HTTP status: ${httpError.code} ${httpError.message}]`;
        }

        if (xmlError) {
            message += ` [XML parsing error: ${xmlError.toString()}]`;
        }

        if (onvifError) {
            message += ` [Onvif error: ${onvifError.message} - ${onvifError.detail}]`;
        }
    }

    return new Error(message);
}

function parseOnvifError(parsedXml) {
    return {
        message: getOnvifErrorMessage(parsedXml),
        detail: getOnvifErrorDetail(parsedXml)
    };
}

function getOnvifErrorMessage(parsedXml) {
    let message = parsedXml['Body']['Fault']['Reason']['Text'];
    if ((typeof message) === 'object') {
        message = message['_'];
    }

    return message;
}

function getOnvifErrorDetail(parsedXml) {
    let detail = parsedXml['Body']['Fault']['Detail']['Text'];
    if ((typeof detail) === 'object') {
        detail = detail['_'];
    }

    return detail;
}

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
OnvifSoap.prototype.createRequestSoap = function (params) {
    let soap = '';
    soap += '<?xml version="1.0" encoding="UTF-8"?>';
    soap += '<s:Envelope';
    soap += '  xmlns:s="http://www.w3.org/2003/05/soap-envelope"';
    if (params['xmlns'] && Array.isArray(params['xmlns'])) {
        params['xmlns'].forEach((ns) => {
            soap += ' ' + ns;
        });
    }
    soap += '>';
    soap += '<s:Header>';
    if (params['user']) {
        soap += createSoapUserToken(params['diff'], params['user'], params['pass']);
    }
    soap += '</s:Header>';
    soap += `<s:Body>${params['body']}</s:Body>`;
    soap += '</s:Envelope>';

    soap = soap.replace(/>\s+</g, '><');
    return soap;
};

function createSoapUserToken(timeDiff, user, pass) {
    if (!timeDiff) {
        timeDiff = 0;
    }

    if (!pass) {
        pass = '';
    }

    const date = (new Date(Date.now() + timeDiff)).toISOString();
    const nonceBuffer = helpers.createNonce(16);
    const nonceBase64 = nonceBuffer.toString('base64');
    const shaSum = crypto.createHash('sha1');
    shaSum.update(Buffer.concat([nonceBuffer, Buffer.from(date), new Buffer.from(pass)]));
    const digest = shaSum.digest('base64');

    let soap = '';
    soap += '<Security s:mustUnderstand="1" xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">';
    soap += '  <UsernameToken>';
    soap += '    <Username>' + user + '</Username>';
    soap += '    <Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' + digest + '</Password>';
    soap += '    <Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' + nonceBase64 + '</Nonce>';
    soap += '    <Created xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' + date + '</Created>';
    soap += '  </UsernameToken>';
    soap += '</Security>';
    return soap;
}


module.exports = new OnvifSoap();
