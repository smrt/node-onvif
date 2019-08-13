/* ------------------------------------------------------------------
* node-onvif - device.js
*
* Copyright (c) 2016-2018, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2018-08-13
* ---------------------------------------------------------------- */
'use strict';
const mCrypto = require('crypto');
const url = require('url');
const Util = require('util');
const EventEmitter = require('events').EventEmitter;

const OnvifServiceDevice = require('./service-device.js');
const OnvifServiceMedia = require('./service-media.js');
const mOnvifServicePtz = require('./service-ptz.js');
const mOnvifServiceEvents = require('./service-events.js');
const mOnvifHttpAuth = require('./http-auth.js');

/* ------------------------------------------------------------------
* Constructor: OnvifDevice(params)
* - params:
*    - address : IP address of the targeted device
*                (Required if the `xaddr` is not specified)
*    - xaddr   : URL of the entry point for the device management service
*                (Required if the `address' is not specified)
*                If the `xaddr` is specified, the `address` is ignored.
*    - user  : User name (Optional)
*    - pass  : Password (Optional)
* ---------------------------------------------------------------- */
function OnvifDevice(params) {
    if (!params || typeof (params) !== 'object') {
        throw new Error('The parameter was invalid.');
    }

    if ('xaddr' in params && (typeof params.xaddr) === 'string') {
        const uri = new url.URL(params.xaddr);
        this.address = uri.hostname;
        this.xaddr = params.xaddr;
        this.keepAddr = false;
    }
    else if ('address' in params && (typeof params.address) === 'string') {
        this.address = params.address;
        this.xaddr = 'http://' + this.address + '/onvif/device_service';
        this.keepAddr = true;
    }
    else {
        throw new Error('Could not parse "xaddr" not "address" from the parameters..');
    }

    this.user = params.user || '';
    this.pass = params.pass || '';
    this.oxaddr = new url.URL(this.xaddr);

    if (this.user) {
        this.oxaddr.auth = this.user + ':' + this.pass;
    }

    this.timeDifference = 0;

    this.services = {
        'device': new OnvifServiceDevice(this.xaddr, this.user, this.pass),
        'events': null,
        'imaging': null,
        'media': null,
        'ptz': null
    };

    EventEmitter.call(this);
}

Util.inherits(OnvifDevice, EventEmitter);

OnvifDevice.prototype._isValidCallback = function (callback) {
    return (callback && typeof (callback) === 'function') ? true : false;
};

OnvifDevice.prototype._execCallback = function (callback, arg1, arg2) {
    if (this._isValidCallback(callback)) {
        callback(arg1, arg2);
    }
};

/* ------------------------------------------------------------------
* Method: getInformation()
* ---------------------------------------------------------------- */
OnvifDevice.prototype.getInformation = function () {
    let o = this.information;
    if (o) {
        return JSON.parse(JSON.stringify(o));
    } else {
        return null;
    }
};

/* ------------------------------------------------------------------
* Method: getCurrentProfile()
* ---------------------------------------------------------------- */
OnvifDevice.prototype.getCurrentProfile = function () {
    let o = this.current_profile;
    if (o) {
        return JSON.parse(JSON.stringify(o));
    } else {
        return null;
    }
};

/* ------------------------------------------------------------------
* Method: getProfileList()
* ---------------------------------------------------------------- */
OnvifDevice.prototype.getProfileList = function () {
    return JSON.parse(JSON.stringify(this.profile_list));
};

/* ------------------------------------------------------------------
* Method: changeProfile(index|token)
* ---------------------------------------------------------------- */
OnvifDevice.prototype.changeProfile = function (index) {
    if (typeof (index) === 'number' && index >= 0 && index % 1 === 0) {
        let p = this.profile_list[index];
        if (p) {
            this.current_profile = p;
            return this.getCurrentProfile();
        } else {
            return null;
        }
    } else if (typeof (index) === 'string' && index.length > 0) {
        let new_profile = null;
        for (let i = 0; i < this.profile_list.length; i++) {
            if (this.profile_list[i]['token'] === index) {
                new_profile = this.profile_list[i];
                break;
            }
        }
        if (new_profile) {
            this.current_profile = new_profile;
            return this.getCurrentProfile();
        } else {
            return null;
        }
    } else {
        return null;
    }
};

/* ------------------------------------------------------------------
* Method: getUdpStreamUrl()
* ---------------------------------------------------------------- */
OnvifDevice.prototype.getUdpStreamUrl = function () {
    if (!this.current_profile) {
        return '';
    }
    let url = this.current_profile['stream']['udp'];
    return url ? url : '';
};

/* ------------------------------------------------------------------
* Method: fetchSnapshot()
* ---------------------------------------------------------------- */
OnvifDevice.prototype.fetchSnapshot = function (snapshotUri) {
    const uri = new url.URL(snapshotUri.uri);
    const options = {
        protocol: uri.protocol,
        user: this.user,
        pass: this.pass,
        hostname: uri.hostname,
        port: uri.port,
        path: uri.pathname + uri.search,
    };

    return new Promise((resolve, reject) => {
        const responseHandler = (response) => {
            const dataArray = [];

            response.on('data', (data) => {
                dataArray.push(data);
            });
            response.on('error', reject);
            response.on('end', () => {
                if (response.statusCode !== 200) {
                    reject(new Error(`${response.statusCode} - ${response.statusMessage}`));
                }

                const imageData = Buffer.concat(dataArray);

                let contentType = response.headers['content-type'] || 'image/jpeg';
                if (contentType.match(/image\//)) {
                    resolve({'headers': response.headers, 'body': imageData});
                } else if (contentType.match(/^text\//)) {
                    reject(new Error(imageData.toString()));
                } else {
                    reject(new Error(`Unexpected data: ${imageData}`));
                }
            });

        };

        const req = mOnvifHttpAuth.request(options, responseHandler);
        req.on('error', reject);
        req.end();
    });
};

/* ------------------------------------------------------------------
* Method: ptzMove(params[, callback])
* - params:
*   - speed:
*     - x     | Float   | required | speed for pan (in the range of -1.0 to 1.0)
*     - y     | Float   | required | speed for tilt (in the range of -1.0 to 1.0)
*     - z     | Float   | required | speed for zoom (in the range of -1.0 to 1.0)
*   - timeout | Integer | optional | seconds (Default 1)
* ---------------------------------------------------------------- */
OnvifDevice.prototype.ptzMove = function (params, callback) {
    let promise = new Promise((resolve, reject) => {
        if (!this.current_profile) {
            reject(new Error('No media profile is selected.'));
            return;
        }
        if (!this.services['ptz']) {
            reject(new Error('The device does not support PTZ.'));
            return;
        }

        let speed = params['speed'];
        if (!speed) {
            speed = {};
        }
        let x = speed['x'] || 0;
        let y = speed['y'] || 0;
        let z = speed['z'] || 0;

        let timeout = params['timeout'];
        if (!timeout || typeof (timeout) !== 'number') {
            timeout = 1;
        }
        let p = {
            'ProfileToken': this.current_profile['token'],
            'Velocity': { 'x': x, 'y': y, 'z': z },
            'Timeout': timeout
        };
        this.ptz_moving = true;
        this.services['ptz'].continuousMove(p).then(() => {
            resolve();
        }).catch((error) => {
            reject(error);
        });
    });
    if (this._isValidCallback(callback)) {
        promise.then(() => {
            callback(null);
        }).catch((error) => {
            callback(error);
        });
    } else {
        return promise;
    }
};

/* ------------------------------------------------------------------
* Method: ptzStop([callback])
* ---------------------------------------------------------------- */
OnvifDevice.prototype.ptzStop = function (callback) {
    let promise = new Promise((resolve, reject) => {
        if (!this.current_profile) {
            reject(new Error('No media profile is selected.'));
            return;
        }
        if (!this.services['ptz']) {
            reject(new Error('The device does not support PTZ.'));
            return;
        }
        this.ptz_moving = false;
        let p = {
            'ProfileToken': this.current_profile['token'],
            'PanTilt': true,
            'Zoom': true
        };
        this.services['ptz'].stop(p).then((result) => {
            resolve(result);
        }).catch((error) => {
            reject(error);
        });
    });
    if (this._isValidCallback(callback)) {
        promise.then((res) => {
            callback(null, res);
        }).catch((error) => {
            callback(error);
        });
    } else {
        return promise;
    }
};

/* ------------------------------------------------------------------
* Method: setAuth(user, pass)
* ---------------------------------------------------------------- */
OnvifDevice.prototype.setAuth = function (user, pass) {
    this.user = user || '';
    this.pass = pass || '';
    if (this.user) {
        this.oxaddr.auth = this.user + ':' + this.pass;
    }
    for (let k in this.services) {
        let s = this.services[k];
        if (s) {
            this.services[k].setAuth(user, pass);
        }
    }
};

/* ------------------------------------------------------------------
* Method: init()
* ---------------------------------------------------------------- */
OnvifDevice.prototype.init = function () {
    return this._getSystemDateAndTime()
        .then(() => this._getCapabilities())
        .catch(error => {
            throw new Error('Failed to initialize the device: ' + error.toString());
        });
};

// GetSystemDateAndTime (Access Class: PRE_AUTH)
OnvifDevice.prototype._getSystemDateAndTime = function () {
    return this.services.device.getSystemDateAndTime()
        .then(result => {
            this.services.device.setTimeDifference(result);
            this.timeDifference = this.services.device.getTimeDifference();
        })
        .catch(() => {});
        // Ignore the error because some devices do not support the GetSystemDateAndTime command and the error does
        // not cause any trouble.
};

// GetCapabilities (Access Class: PRE_AUTH)
OnvifDevice.prototype._getCapabilities = function () {
    return this.services.device.getCapabilities()
        .then(capabilities => {
            const events = capabilities['Events'];
            if (events && events['XAddr']) {
                // TODO: Temporarily disabled due to rewrite
            }

            const imaging = capabilities['Imaging'];
            if (imaging && imaging['XAddr']) {
                // TODO: Temporarily disabled due to rewrite
            }

            const media = capabilities['Media'];
            if (media && media['XAddr']) {
                this.services.media = new OnvifServiceMedia(
                    this._getXaddr(media['XAddr']),
                    this.user,
                    this.pass,
                    this.timeDifference
                );
            }

            const ptz = capabilities['PTZ'];
            if (ptz && ptz['XAddr']) {
                // TODO: Temporarily disabled due to rewrite
            }
        });
};

// Media::GetProfiles (Access Class: READ_MEDIA)
OnvifDevice.prototype._mediaGetProfiles = function () {
    return this.services.media.getProfiles()
        .then(profiles => {
            if (profiles.length > 0) {
                this.profile_list = profiles;
                this.current_profile = profiles[0]
            }
        })
        .catch(error => new Error('Failed to initialize the device: ' + error.toString()));
};

// Media::GetStreamURI (Access Class: READ_MEDIA)
OnvifDevice.prototype._mediaGetStreamURI = function () {
    return Promise.all(this.profile_list.map(profile => this._setStreamUrisForProfile(profile)));
};

OnvifDevice.prototype._setStreamUrisForProfile = function (profile) {
    const protocols = ['UDP', 'HTTP', 'RTSP'];
    profile.stream = {};

    return Promise.all(protocols.map(protocol => this._setProtocolSpecificStremaUriForProfile(profile, protocol)));
};

OnvifDevice.prototype._setProtocolSpecificStremaUriForProfile = function (profile, protocol) {
    this.services.media.getStreamUri(profile.token, protocol)
        .then(streamUri => {
            profile.stream[protocol.toLowerCase()] = this._getUri(streamUri.uri);

            return Promise.resolve();
        });
};

// Media::GetSnapshotUri (Access Class: READ_MEDIA)
OnvifDevice.prototype._mediaGetSnapshotUri = function () {
    return Promise.all(this.profile_list.map(profile => this._setSnapshotUriForProfile(profile)));
};

OnvifDevice.prototype._setSnapshotUriForProfile = function (profile) {
    return this.services.media.getSnapshotUri(profile.token)
        .then(data => {
            profile.snapshot = this._parseSnapshotUri(data);

            return Promise.resolve();
        });
};

OnvifDevice.prototype._getXaddr = function (directXaddr) {
    if (!this.keepAddr) return directXaddr;
    const path = url.parse(directXaddr).path;
    return 'http://' + this.address + path;
};

OnvifDevice.prototype._getUri = function (directUri) {
    if(typeof(directUri) === 'object' && directUri['_']) {
        directUri = directUri['_'];
    }
    if (!this.keepAddr) return directUri;
    const base = url.parse('http://' + this.address);
    const parts = url.parse(directUri);
    const newParts = {
        host: base.host,
        pathname: base.pathname + parts.pathname
    };
    const newUri = url.format(newParts);
    return newUri;
};

OnvifDevice.prototype._parseSnapshotUri = function (directUri) {
    if(typeof(directUri) === 'object' && directUri['_']) {
        directUri = directUri['_'];
    }
    if (!this.keepAddr) return directUri;
    const base = url.parse('http://' + this.address);
    const parts = url.parse(directUri);
    const newParts = {
        protocol: parts.protocol,
        host: base.host,
        pathname: base.pathname + parts.pathname
    };
    const newUri = url.format(newParts);
    return newUri;
};

module.exports = OnvifDevice;
