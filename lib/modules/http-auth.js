/* ------------------------------------------------------------------
* node-onvif - http-auth.js
*
* Copyright (c) 2016, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2017-08-26
* ---------------------------------------------------------------- */
'use strict';
const http = require('http');
const https = require('https');
const crypto = require('crypto');

function request(options, callback) {
    if (!options) {
        throw new Error('Must supply options object');
    }

    const requestLib = options.protocol === 'https:' ? https : http;
    const requestOptions = _setRequestOptions(options);

    return requestLib.request(requestOptions, (res) => {
        const authHeader = res.headers['www-authenticate'];

        if (res.statusCode === 401 && authHeader) {
            const authData = _parseAuthString(authHeader);
            _handleHttpAuthResponse(requestLib, requestOptions, callback, authData, options.user, options.pass);
        } else {
            callback(res);
        }
    });
}

function _setRequestOptions(options) {
    return {
        method: options.method || 'GET',
        hostname: options.hostname,
        port: options.port || 80,
        path: options.path,
        timeout: options.timeout || 30000
    };
}

function _handleHttpAuthResponse(requestLib, requestOptions, callback, authData, user, pass) {
    const {path, method} = requestOptions;

    requestOptions.headers = {};
    requestOptions.headers['Authorization'] = _buildAuthHeaderString(authData, path, method, user, pass);

    const request = requestLib.request(requestOptions, callback);
    request.end();
}

function _buildAuthHeaderString(authData, path, method, user, pass) {
    switch (authData.authType) {
        case 'Digest':
            return _buildDigestAuthHeaderString(authData.authParams, path, method, user, pass);
        case 'Basic':
            return _buildBasicAuthHeaderString(user, pass);
        default:
            throw new Error(`Unsupported authentication type: ${authData.authType}`);
    }
}

function _buildBasicAuthHeaderString(user, pass) {
    const b64 = Buffer
        .from(`${user}:${pass}`)
        .toString('base64');

    return `Basic ${b64}`;
}

function _buildDigestAuthHeaderString(authParams, path, method, user, pass) {
    const {realm, nonce, algorithm, qop} = authParams;

    let ha1;
    if (!algorithm || algorithm === 'MD5') {
        ha1 = _md5Hash(`${user}:${realm}:${pass}`);
    }

    let ha2;
    if (!qop || qop === 'auth') {
        ha2 = _md5Hash(`${method}:${path}`);
    }

    const args = {
        username: user,
        realm: realm,
        nonce: nonce,
        uri: path,
    };

    if (!qop) {
        args.response = _md5Hash(`${ha1}:${nonce}:${ha2}`);
    } else {
        const clientNonce = _createClientNonce(32);
        const nonceCount = '00000001';

        if (algorithm === 'MD5-sess') {
            ha1 = _md5Hash(`${ha1}:${nonce}:${clientNonce}`)
        }

        if (qop === 'auth-int') {
            throw new Error('qop = auth-int currently not supported');
        }

        args.cnonce = clientNonce;
        args.nc = nonceCount;
        args.qop = qop;
        args.algorithm = algorithm;
        args.response = _md5Hash(`${ha1}:${nonce}:${nonceCount}:${clientNonce}:${qop}:${ha2}`);
    }

    const digestString = Object.entries(args).map(([key, value]) => `${key}="${value}"`).join(',');

    return `Digest ${digestString}`;
}

function _createClientNonce(length) {
    const arr = Array.from({ length }, () => Math.floor(Math.random() * 256));

    return Buffer.from(arr).toString('hex');
}

function _md5Hash(str) {
    return crypto
        .createHash('MD5')
        .update(str)
        .digest('hex');
}

function _parseAuthString(header) {
    const regex = new RegExp(/([a-zA-Z]+)\s*=\s*"?((?<=").*?(?=")|.*?(?=,?\s*[a-zA-Z]+\s*=)|.+[^=])/, 'g');
    const [authType] = header.split(' ');
    const authParams = {};

    let match;
    while ((match = regex.exec(header)) !== null) {
        const [, key, value] = match;

        if (value) {
            authParams[key] = value;
        }
    }

    return {
        authType,
        authParams
    };
}

module.exports = {
    request
};