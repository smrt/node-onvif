/* ------------------------------------------------------------------
* node-onvif - device.js
*
* Copyright (c) 2016-2018, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2018-08-13
* ---------------------------------------------------------------- */
'use strict';
const mCrypto = require('crypto');
const mUrl = require('url');
const mUtil = require('util');
const mEventEmitter = require('events').EventEmitter;

const mOnvifServiceDevice = require('./service-device.js');
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

    this.address = '';
    this.xaddr = '';
    this.user = '';
    this.pass = '';
    this.keepAddr = false;
    this.lastResponse = null; // for debug

    if (('xaddr' in params) && typeof (params['xaddr']) === 'string') {
        this.xaddr = params['xaddr'];
        let ourl = mUrl.parse(this.xaddr);
        this.address = ourl.hostname;
    } else if (('address' in params) && typeof (params['address']) === 'string') {
        this.keepAddr = true;
        this.address = params['address'];
        this.xaddr = 'http://' + this.address + '/onvif/device_service';
    } else {
        throw new Error('The parameter was invalid.');
    }
    if (('user' in params) && typeof (params['user']) === 'string') {
        this.user = params['user'] || '';
    }
    if (('pass' in params) && typeof (params['pass']) === 'string') {
        this.pass = params['pass'] || '';
    }

    this.oxaddr = mUrl.parse(this.xaddr);
    if (this.user) {
        this.oxaddr.auth = this.user + ':' + this.pass;
    }

    this.time_diff = 0;

    this.information = null;
    this.services = {
        'device': new mOnvifServiceDevice({ 'xaddr': this.xaddr, 'user': this.user, 'pass': this.pass }),
        'events': null,
        'imaging': null,
        'media': null,
        'ptz': null
    };
    this.profile_list = [];

    this.current_profile = null;
    this.ptz_moving = false;

    mEventEmitter.call(this);
};
mUtil.inherits(OnvifDevice, mEventEmitter);

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
OnvifDevice.prototype.fetchSnapshot = function (callback) {
    let promise = new Promise((resolve, reject) => {
        if (!this.current_profile) {
            reject(new Error('No media profile is selected.'));
            return;
        }
        if (!this.current_profile['snapshot']) {
            reject(new Error('The device does not support snapshot or you have not authorized by the device.'));
            return;
        }
        let ourl = mUrl.parse(this.current_profile['snapshot']);
        let options = {
            protocol: ourl.protocol,
            auth: this.user + ':' + this.pass,
            hostname: ourl.hostname,
            port: ourl.port || 80,
            path: ourl.path,
            method: 'GET'
        };
        let req = mOnvifHttpAuth.request(options, (res) => {
            let buffer_list = [];
            res.on('data', (buf) => {
                buffer_list.push(buf);
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    let buffer = Buffer.concat(buffer_list);
                    let ct = res.headers['content-type'];
                    if (!ct) { // workaround for DBPOWER
                        ct = 'image/jpeg';
                    }
                    if (ct.match(/image\//)) {
                        resolve({ 'headers': res.headers, 'body': buffer });
                    } else if (ct.match(/^text\//)) {
                        reject(new Error(buffer.toString()));
                    } else {
                        reject(new Error('Unexpected data: ' + ct));
                    }
                } else {
                    reject(new Error(res.statusCode + ' ' + res.statusMessage));
                }
            });
            req.on('error', (error) => {
                reject(error);
            });
        });
        req.on('error', (error) => {
            reject(error);
        });
        req.end();
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
        .then(() => {
            return this._getCapabilities();
        })
        .then(() => {
            return this._getDeviceInformation();
        })
        .then(() => {
            return this._mediaGetProfiles();
        })
        .then(() => {
            return this._mediaGetStreamURI();
        })
        .then(() => {
            return this._mediaGetSnapshotUri();
        })
        .then(() => this.getInformation());
};

// GetSystemDateAndTime (Access Class: PRE_AUTH)
OnvifDevice.prototype._getSystemDateAndTime = function () {
    return new Promise((resolve, reject) => {
        this.services.device.getSystemDateAndTime((error, result) => {
            // Ignore the error becase some devices do not support
            // the GetSystemDateAndTime command and the error does
            // not cause any trouble.
            if (!error) {
                this.time_diff = this.services.device.getTimeDiff();
            }
            resolve();
        });
    });
};

// GetCapabilities (Access Class: PRE_AUTH)
OnvifDevice.prototype._getCapabilities = function () {
    return this.services.device.getCapabilities()
        .then(result => {
            const c = result['Capabilities'];
            if (!c) {
                throw new Error('Failed to initialize the device: No capabilities were found.');
            }

            let events = c['Events'];
            if (events && events['XAddr']) {
                /* TODO: Temporarily disabled due to rewrite
                this.services.events = new mOnvifServiceEvents({
                    'xaddr': this._getXaddr(events['XAddr']),
                    'time_diff': this.time_diff,
                    'user': this.user,
                    'pass': this.pass
                });
                */
            }
            let imaging = c['Imaging'];
            if (imaging && imaging['XAddr']) {
                /*
                this.services.imaging = new mOnvifServiceImaging({
                    'xaddr'    : imaging['XAddr'],
                    'time_diff': this.time_diff,
                    'user'     : this.user,
                    'pass'     : this.pass
                });
                */
            }
            let media = c['Media'];
            if (media && media['XAddr']) {
                this.services.media = new OnvifServiceMedia(
                    this._getXaddr(media['XAddr']),
                    this.user,
                    this.pass,
                    this.time_diff
                );
            }
            let ptz = c['PTZ'];
            if (ptz && ptz['XAddr']) {
                /* TODO: Temporarily disabled due to rewrite
                this.services.ptz = new mOnvifServicePtz({
                    'xaddr': this._getXaddr(ptz['XAddr']),
                    'time_diff': this.time_diff,
                    'user': this.user,
                    'pass': this.pass
                });

                */
            }
        })
        .catch(error => {
            throw new Error('Failed to initialize the device: ' + error.toString());
        });
};

// GetDeviceInformation (Access Class: READ_SYSTEM)
OnvifDevice.prototype._getDeviceInformation = function () {
    this.services.device.getDeviceInformation()
        .then(result => {
            this.information = result;
        })
        .catch(error => new Error('Failed to initialize the device: ' + error.toString()));
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
    const path = mUrl.parse(directXaddr).path;
    return 'http://' + this.address + path;
};

OnvifDevice.prototype._getUri = function (directUri) {
    if(typeof(directUri) === 'object' && directUri['_']) {
        directUri = directUri['_'];
    }
    if (!this.keepAddr) return directUri;
    const base = mUrl.parse('http://' + this.address);
    const parts = mUrl.parse(directUri);
    const newParts = {
        host: base.host,
        pathname: base.pathname + parts.pathname
    };
    const newUri = mUrl.format(newParts);
    return newUri;
};

OnvifDevice.prototype._parseSnapshotUri = function (directUri) {
    if(typeof(directUri) === 'object' && directUri['_']) {
        directUri = directUri['_'];
    }
    if (!this.keepAddr) return directUri;
    const base = mUrl.parse('http://' + this.address);
    const parts = mUrl.parse(directUri);
    const newParts = {
        protocol: parts.protocol,
        host: base.host,
        pathname: base.pathname + parts.pathname
    };
    const newUri = mUrl.format(newParts);
    return newUri;
};

module.exports = OnvifDevice;
