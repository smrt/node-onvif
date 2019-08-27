/* ------------------------------------------------------------------
* node-onvif - node-onvif.js
*
* Copyright (c) 2016 - 2017, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2017-09-30
* ---------------------------------------------------------------- */
'use strict';
const dgram = require('dgram');
const crypto = require('crypto');
const helpers = require('./modules/helpers.js');

const DISCOVERY_RETRIES_MAX = 3;
const DISCOVERY_RETRY_INTERVAL = 150; // ms
const DISCOVERY_TIMEOUT = 3000; // ms
const WS_DISCOVERY_MULTICAST_ADDRESS = '239.255.255.250';
const WS_DISCOVERY_PORT = 3702;

function Onvif() {
    this.OnvifDevice = require('./modules/device.js');
    this._activeProbes = {};
}

Onvif.prototype.startProbe = function (deviceTypes = ['NetworkVideoTransmitter', 'Device', 'NetworkVideoDisplay']) {
    const requestId = createUuidV4();
    const probe = createProbe();
    this._activeProbes[requestId] = probe;

    return this._setupUdpSocketAndStartProbing(probe, deviceTypes, requestId);
};

Onvif.prototype.stopAllProbes = function () {
    return Promise.all(Object.keys(this._activeProbes).map(requestId => {
        const probe = this._activeProbes[requestId];
        clearProbeTimeouts(probe);

        return closeUdpSocket(probe)
            .then(() => this._removeProbe(requestId))
            .catch(() => {
            });
    }));
};

Onvif.prototype._setupUdpSocketAndStartProbing = function (probe, deviceTypes, requestId) {
    return new Promise((resolve, reject) => {
        probe.udpSocket.once('error', reject);
        probe.udpSocket.on('message', buf => onUdpMessage(probe, buf));
        probe.udpSocket.bind(() => {
            probe.udpSocket.removeAllListeners('error');
            probe.discovery_timeout_timer = setTimeout(this._finishProbe.bind(this), DISCOVERY_TIMEOUT, probe, requestId, resolve, reject);

            sendProbe(probe, deviceTypes)
                .then(() => this._finishProbe(probe, requestId, resolve, reject)) // Clears the timer, don't worry about executing twice
                .catch(reject);
        });
    });
};

Onvif.prototype._finishProbe = function (probe, requestId, resolve, reject) {
    clearProbeTimeouts(probe);

    return closeUdpSocket(probe)
        .then(() => this._removeProbe(requestId))
        .then(() => createDeviceList(probe.devices))
        .then(resolve)
        .catch(reject);
};

Onvif.prototype._removeProbe = function (requestId) {
    delete this._activeProbes[requestId];
};

function createProbe() {
    return {
        udpSocket: dgram.createSocket('udp4'),
        devices: {},
        discovery_timeout_timer: null,
        discovery_interval_timer: null
    };
}

function onUdpMessage(probe, buf) {
    helpers.parseXml(buf.toString())
        .then(parseDataFromXmlResponse)
        .then(parseScopedData)
        .then(data => setDeviceData(probe, data))
        .catch(() => {
        });
}

function parseDataFromXmlResponse(xml) {
    const data = {
        urn: '',
        xaddrs: [],
        scopes: [],
        types: ''
    };

    try {
        const probeMatches = xml['Body']['ProbeMatches'];

        if (probeMatches !== undefined) {
            const probeMatch = probeMatches['ProbeMatch'];
            data.urn = probeMatch['EndpointReference']['Address'];
            data.xaddrs = probeMatch['XAddrs'].split(/\s+/);

            if (typeof (probeMatch['Scopes']) === 'string') {
                data.scopes = probeMatch['Scopes'].split(/\s+/);
            } else if (typeof (probeMatch['Scopes']) === 'object' && typeof (probeMatch['Scopes']['_']) === 'string') {
                data.scopes = probeMatch['Scopes']['_'].split(/\s+/);
            }

            // modified to support Pelco cameras
            if (typeof (probeMatch['Types']) === 'string') {
                data.types = probeMatch['Types'].split(/\s+/);
            } else if (typeof (probeMatch['Types']) === 'object' && typeof (probeMatch['Types']['_']) === 'string') {
                data.types = probeMatch['Types']['_'].split(/\s+/)
            }
        }
    } catch {
    }

    return data;
}

function parseScopedData(data) {
    if (data.urn && data.xaddrs.length > 0 && data.scopes.length > 0) {
        data.name = '';
        data.hardware = '';
        data.location = '';

        data.scopes.forEach(scope => {
            if (scope.indexOf('onvif://www.onvif.org/hardware/') === 0) {
                data.hardware = scope.split('/').pop();
            } else if (scope.indexOf('onvif://www.onvif.org/location/') === 0) {
                data.location = scope.split('/').pop();
            } else if (scope.indexOf('onvif://www.onvif.org/name/') === 0) {
                data.name = scope.split('/').pop();
                data.name = data.name.replace(/_/g, ' ');
            }
        });
    } else {
        data = null;
    }

    return data;
}

function setDeviceData(probe, data) {
    if (data === null || probe.devices[data.urn]) {
        return;
    }

    probe.devices[data.urn] = data;
}

function sendProbe(probe, deviceTypes) {
    return new Promise((resolve, reject) => {
        if (!probe.udpSocket) {
            reject(new Error('No UDP connection is available. The init() method might not be called yet.'));
        }

        sendSoapRequest(probe, resolve, buildSoapRequests(deviceTypes));
    });
}

function buildSoapRequests(deviceTypes) {
    const soapSet = deviceTypes.map(type => fillProbeSoapTemplate(type, createUuidV4()));

    const soapRequests = [];
    for (let i = 0; i < DISCOVERY_RETRIES_MAX; i++) {
        soapSet.forEach((s) => {
            soapRequests.push(s);
        });
    }

    return soapRequests;
}

function fillProbeSoapTemplate(type, uuid) {
    let soapBody = '';
    soapBody += '<?xml version="1.0" encoding="UTF-8"?>';
    soapBody += '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing">';
    soapBody += '<s:Header>';
    soapBody += '<a:Action s:mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>';
    soapBody += `<a:MessageID>uuid:${uuid}</a:MessageID>`;
    soapBody += '<a:ReplyTo>';
    soapBody += '<a:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:Address>';
    soapBody += '</a:ReplyTo>';
    soapBody += '<a:To s:mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>';
    soapBody += '</s:Header>';
    soapBody += '<s:Body>';
    soapBody += '<Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">';
    soapBody += `<d:Types xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dp0="http://www.onvif.org/ver10/network/wsdl">dp0:${type}</d:Types>`;
    soapBody += '</Probe>';
    soapBody += '</s:Body>';
    soapBody += '</s:Envelope>';

    return soapBody;
}

function sendSoapRequest(probe, resolve, soapRequests) {
    const soapRequest = soapRequests.shift();
    if (!soapRequest) {
        return resolve();
    }

    const buf = Buffer.from(soapRequest, 'utf8');
    probe.udpSocket.send(buf, 0, buf.length, WS_DISCOVERY_PORT, WS_DISCOVERY_MULTICAST_ADDRESS, () => {
        probe.discovery_interval_timer = setTimeout(sendSoapRequest, DISCOVERY_RETRY_INTERVAL, probe, resolve, soapRequests);
    });
}

function clearProbeTimeouts(probe) {
    if (probe.discovery_interval_timer !== null) {
        clearTimeout(probe.discovery_interval_timer);
        probe.discovery_interval_timer = null;
    }

    if (probe.discovery_timeout_timer !== null) {
        clearTimeout(probe.discovery_timeout_timer);
        probe.discovery_timeout_timer = null;
    }
}

function closeUdpSocket(probe) {
    return new Promise(resolve => {
        if (!probe.udpSocket) {
            return resolve();
        }

        probe.udpSocket.close(() => onUdpSocketClosed(probe, resolve));
    });
}

function onUdpSocketClosed(probe, resolve) {
    probe.udpSocket.unref();
    probe.udpSocket = null;

    resolve();
}

function createDeviceList(deviceObject) {
    const list = [];
    Object.keys(deviceObject).forEach(urn => {
        list.push(deviceObject[urn]);
    });

    return list;
}

function createUuidV4() {
    const charList = crypto.randomBytes(16).toString('hex').toLowerCase().split('');
    charList[12] = '4';
    charList[16] = (parseInt(charList[16], 16) & 3 | 8).toString(16);
    const m = charList.join('').match(/^(.{8})(.{4})(.{4})(.{4})(.{12})/);

    return [m[1], m[2], m[3], m[4], m[5]].join('-');
}

module.exports = new Onvif();
