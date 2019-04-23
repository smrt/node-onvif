/* ------------------------------------------------------------------
* node-onvif - service-device.js
*
* Copyright (c) 2016, Futomi Hatano, All rights reserved.
* Released under the MIT license
* Date: 2016-10-02
* ---------------------------------------------------------------- */
'use strict';
const URL = require('url').URL;
const mOnvifSoap = require('./soap.js');
const helpers = require('./helpers.js');

/* ------------------------------------------------------------------
* Constructor: OnvifServiceDevice(params)
*  - xaddr   : URL of the entry point for the device management service
*              (Required)
*  - user  : User name (Optional)
*  - pass  : Password (Optional)
* ---------------------------------------------------------------- */
function OnvifServiceDevice(xaddr, user, pass) {
    if (!helpers.validateXAddr(xaddr)) helpers.throwLast();

    this.oxaddr = new URL(xaddr);
    this.user = user || '';
    this.pass = pass || '';
    this.oxaddr.auth = this.user ? `${this.user}:${this.pass}` : '';
    this.timeDifference = 0;
    this.namespaces = [
		'xmlns:tds="http://www.onvif.org/ver10/device/wsdl"',
        'xmlns:tt="http://www.onvif.org/ver10/schema"'
    ];
}

OnvifServiceDevice.prototype.sendRequest = function (endpoint, soapBody) {
    return mOnvifSoap.requestCommand(this.oxaddr, endpoint, this._createRequestSoap(soapBody));
};

OnvifServiceDevice.prototype._createRequestSoap = function(body) {
	return mOnvifSoap.createRequestSoap({
		'body': body,
		'xmlns': this.namespaces,
		'diff': this.timeDifference,
		'user': this.user,
		'pass': this.pass
	});
};

OnvifServiceDevice.prototype.getTimeDifference = function() {
	return this.timeDifference;
};

OnvifServiceDevice.prototype.setTimeDifference = function(systemDateTime) {
    if (systemDateTime.utcDateTime) {
		this.timeDifference = systemDateTime.utcDateTime.getTime() - (new Date()).getTime();
	}
};

OnvifServiceDevice.prototype._parseSystemDateAndTime = function (data) {
    return {
        type: data['DateTimeType'],
		daylightSavings: data['DaylightSavings'] === 'true',
		timeZone: ('TimeZone' in data) ? data['TimeZone']['TZ'] : null,
		utcDateTime: ('UTCDateTime' in data) ? new Date(
			parseInt(data['UTCDateTime']['Date']['Year']),
			parseInt(data['UTCDateTime']['Date']['Month']) - 1,
			parseInt(data['UTCDateTime']['Date']['Day']),
			parseInt(data['UTCDateTime']['Time']['Hour']),
			parseInt(data['UTCDateTime']['Time']['Minute']),
			parseInt(data['UTCDateTime']['Time']['Second']),
		) : null,
        localDateTime: ('LocalDateTime' in data) ? new Date(
			parseInt(data['LocalDateTime']['Date']['Year']),
			parseInt(data['UTCDateTime']['Date']['Month']) - 1,
			parseInt(data['LocalDateTime']['Date']['Day']),
			parseInt(data['LocalDateTime']['Time']['Hour']),
			parseInt(data['LocalDateTime']['Time']['Minute']),
			parseInt(data['LocalDateTime']['Time']['Second']),
		) : null,
    };
};

/* ------------------------------------------------------------------
* Method: getCapabilities()
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getCapabilities = function() {
    let soapBody = '';
    soapBody += '<tds:GetCapabilities>';
    soapBody += '<tds:Category>All</tds:Category>';
    soapBody += '</tds:GetCapabilities>';

	return this.sendRequest('GetCapabilities', soapBody)
		.then(result => result['Capabilities']);
};

/* ------------------------------------------------------------------
* Method: getWsdlUrl([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getWsdlUrl = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetWsdlUrl/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetWsdlUrl', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getDiscoveryMode(callback)
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getDiscoveryMode = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetDiscoveryMode/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetDiscoveryMode', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getScopes([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getScopes = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetScopes/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetScopes', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setScopes(params[, callback])
* - params:
*   - Scopes  | Array  | required | a list of URI
*
* {
*   'Scopes': [
*     'onvif://www.onvif.org/location/town/Nerima',
*     'onvif://www.onvif.org/location/city/Tokyo'
*   ]
* }
*
* If you want to delete all Configurable scopes, specify an empty
* Array object as the `Scope` property.
*
* {'Scopes': []}
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setScopes = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}

		let scope_list = params['Scopes'];
		if(err_msg = mOnvifSoap.isInvalidValue(scope_list, 'array', true)) {
			reject(new Error('The "Scopes" property was invalid: ' + err_msg));
			return;
		}

		let soap_body = '';
		soap_body += '<tds:SetScopes>';
		scope_list.forEach((s) => {
			soap_body += '<tds:Scopes>' + s + '</tds:Scopes>';
		});
		soap_body += '</tds:SetScopes>';
		let soap = this._createRequestSoap(soap_body);

		mOnvifSoap.requestCommand(this.oxaddr, 'SetScopes', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: addScopes(params[, callback])
* - params:
*   - Scopes  | Array  | required | a list of URI
*
* {
*   'Scopes': [
*     'onvif://www.onvif.org/location/town/Nerima',
*     'onvif://www.onvif.org/location/city/Tokyo'
*   ]
* }
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.addScopes = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}

		let scope_list = params['Scopes'];
		if(err_msg = mOnvifSoap.isInvalidValue(scope_list, 'array', true)) {
			reject(new Error('The "Scopes" property was invalid: ' + err_msg));
			return;
		}

		let soap_body = '';
		soap_body += '<tds:AddScopes>';
		scope_list.forEach((s) => {
			soap_body += '<tds:ScopeItem>' + s + '</tds:ScopeItem>';
		});
		soap_body += '</tds:AddScopes>';
		let soap = this._createRequestSoap(soap_body);

		mOnvifSoap.requestCommand(this.oxaddr, 'AddScopes', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: removeScopes(params[, callback])
* - params:
*   - Scopes  | Array  | required | a list of URI
*
* {
*   'Scopes': [
*     'onvif://www.onvif.org/location/town/Nerima',
*     'onvif://www.onvif.org/location/city/Tokyo'
*   ]
* }
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.removeScopes = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}

		let scope_list = params['Scopes'];
		if(err_msg = mOnvifSoap.isInvalidValue(scope_list, 'array')) {
			reject(new Error('The "Scopes" property was invalid: ' + err_msg));
			return;
		}

		let soap_body = '';
		soap_body += '<tds:RemoveScopes>';
		scope_list.forEach((s) => {
			soap_body += '<tds:ScopeItem>' + s + '</tds:ScopeItem>';
		});
		soap_body += '</tds:RemoveScopes>';
		let soap = this._createRequestSoap(soap_body);

		mOnvifSoap.requestCommand(this.oxaddr, 'RemoveScopes', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getHostname([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getHostname = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetHostname/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetHostname', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setHostname(params[, callback])
* - params:
*   - Name  | string  | required | a host name
*
* {'Name': 'test'}
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setHostname = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}

		let hostname = params['Name'];
		if(err_msg = mOnvifSoap.isInvalidValue(hostname, 'string')) {
			reject(new Error('The "Name" property was invalid: ' + err_msg));
			return;
		}

		let soap_body = '';
		soap_body += '<tds:SetHostname>';
		soap_body += '<tds:Name>' + hostname + '</tds:Name>';
		soap_body += '</tds:SetHostname>';
		let soap = this._createRequestSoap(soap_body);

		mOnvifSoap.requestCommand(this.oxaddr, 'SetHostname', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getDNS([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getDNS = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetDNS/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetDNS', soap).then((result) => {
			try {
				let di = result['data']['DNSInformation'];
				if(!di['SearchDomain']) {
					di['SearchDomain'] = [];
				} else if(!Array.isArray(di['SearchDomain'])) {
					di['SearchDomain'] = [di['SearchDomain']];
				}
				if(!di['DNSManual']) {
					di['DNSManual'] = [];
				} else if(!Array.isArray(di['DNSManual'])) {
					di['DNSManual'] = [di['DNSManual']];
				}
				result['data'] = di;
			} catch(e) {}
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setDNS(params[, callback])
* - params:
*   - FromDHCP      | boolean | required | true or false
*   - SearchDomain  | Array   | optional | a list of search domains
*   - DNSManual     | Array   | optional | a list of DNS addresses
*     - Type        | String  | required | "IPv4" or "IPv6"
*     - IPv4Address | String  | optional | IPv4 address
*     - IPv6Address | String  | optional | IPv6 address
*
* {
*   'FromDHCP'    : false,
*   'SearchDomain': ['futomi.gr.jp', 'hatano.gr.jp'],
*   'DNSManual'   : [
*     {'Type': 'IPv4', 'IPv4Address': '192.168.10.1'},
*     {'Type': 'IPv4', 'IPv4Address': '192.168.10.2'}
*   ]
* }
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setDNS = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}

		if(err_msg = mOnvifSoap.isInvalidValue(params['FromDHCP'], 'boolean')) {
			reject(new Error('The "FromDHCP" property was invalid: ' + err_msg));
			return;
		}

		if('SearchDomain' in params) {
			if(err_msg = mOnvifSoap.isInvalidValue(params['SearchDomain'], 'array', true)) {
				reject(new Error('The "SearchDomain" property was invalid: ' + err_msg));
				return;
			}
			for(let i=0; i<params['SearchDomain'].length; i++) {
				if(err_msg = mOnvifSoap.isInvalidValue(params['SearchDomain'][i], 'string')) {
					reject(new Error('The "SearchDomain" property was invalid: ' + err_msg));
					return;
				}
			}
		}

		if('DNSManual' in params) {
			if(err_msg = mOnvifSoap.isInvalidValue(params['DNSManual'], 'array', true)) {
				reject(new Error('The "DNSManual" property was invalid: ' + err_msg));
				return;
			}

			for(let i=0; i<params['DNSManual'].length; i++) {
				let o = params['DNSManual'][i];
				if(err_msg = mOnvifSoap.isInvalidValue(o, 'object')) {
					reject(new Error('The "DNSManual" property was invalid: ' + err_msg));
					return;
				}

				let type = o['Type'];
				if(err_msg = mOnvifSoap.isInvalidValue(type, 'string')) {
					reject(new Error('The "Type" property was invalid: ' + err_msg));
					return;
				} else if(!type.match(/^(IPv4|IPv6)$/)) {
					reject(new Error('The "Type" property was invalid: The value must be either "IPv4" or "IPv6".'));
					return;
				}

				if(type === 'IPv4') {
					if(err_msg = mOnvifSoap.isInvalidValue(o['IPv4Address'], 'string')) {
						reject(new Error('The "IPv4Address" property was invalid: ' + err_msg));
						return;
					}
				} else if(type === 'IPv6') {
					if(err_msg = mOnvifSoap.isInvalidValue(o['IPv6Address'], 'string')) {
						reject(new Error('The "IPv6Address" property was invalid: ' + err_msg));
						return;
					}
				}
			}
		}

		let soap_body = '';
		soap_body += '<tds:SetDNS>';
		if('FromDHCP' in params) {
			soap_body += '<tds:FromDHCP>' + params['FromDHCP'] + '</tds:FromDHCP>';
		}
		if('SearchDomain' in params) {
			params['SearchDomain'].forEach((s) => {
				soap_body += '<tds:SearchDomain>' + s + '</tds:SearchDomain>';
			});
		}
		if('DNSManual' in params) {
			if(params['DNSManual'].length === 0) {
				soap_body += '<tds:DNSManual></tds:DNSManual>';
			} else {
				params['DNSManual'].forEach((o) => {
					soap_body += '<tds:DNSManual>';
					soap_body += '<tt:Type>' + o['Type'] + '</tt:Type>';
					if(o['Type'] === 'IPv4') {
						soap_body += '<tt:IPv4Address>' + o['IPv4Address'] + '</tt:IPv4Address>';
					} else {
						soap_body += '<tt:IPv6Address>' + o['IPv6Address'] + '</tt:IPv6Address>';
					}
					soap_body += '</tds:DNSManual>';
				});
			}
		}
		soap_body += '</tds:SetDNS>';

		let soap = this._createRequestSoap(soap_body);

		mOnvifSoap.requestCommand(this.oxaddr, 'SetDNS', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getNetworkInterfaces([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getNetworkInterfaces = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetNetworkInterfaces/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetNetworkInterfaces', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getNetworkProtocols([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getNetworkProtocols = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetNetworkProtocols/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetNetworkProtocols', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setNetworkProtocols(params[, callback])
* - params:
*   - NetworkProtocols | Array   | required | a list of protocols
*     - Name           | String  | required |
*     - Enabled        | Boolean | optional |
*     - Port           | Integer | optional |
*
* {
*   'NetworkProtocols': [
*     {'Name': 'HTTP', 'Enabled': true, 'Port': 80},
*     {'Name': 'RTSP', 'Enabled': false, 'Port': 554},
*   ]
* }
*
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setNetworkProtocols = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			callback(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}

		if(err_msg = mOnvifSoap.isInvalidValue(params['NetworkProtocols'], 'array', true)) {
			callback(new Error('The "NetworkProtocols" property was invalid: ' + err_msg));
			return;
		}

		for(let i=0; i<params['NetworkProtocols'].length; i++) {
			let o = params['NetworkProtocols'][i];
			if(err_msg = mOnvifSoap.isInvalidValue(o, 'object')) {
				callback(new Error('The "NetworkProtocols" property was invalid: ' + err_msg));
				return;
			}

			if(err_msg = mOnvifSoap.isInvalidValue(o['Name'], 'string')) {
				callback(new Error('The "Name" property was invalid: ' + err_msg));
				return;
			} else if(!o['Name'].match(/^(HTTP|HTTPS|RTSP)$/)) {
				callback(new Error('The "Name" property was invalid: It must be "HTTP", "HTTPS", or "RTSP".'));
				return;
			}

			let flag = false;

			if('Enabled' in o) {
				if(err_msg = mOnvifSoap.isInvalidValue(o['Enabled'], 'boolean')) {
					callback(new Error('The "Enabled" property was invalid: ' + err_msg));
					return;
				}
				flag = true;
			}

			if('Port' in o) {
				if(err_msg = mOnvifSoap.isInvalidValue(o['Port'], 'integer')) {
					callback(new Error('The "Port" property was invalid: ' + err_msg));
					return;
				}
				flag = true;
			}

			if(flag === false) {
				callbackError('Either "Enabled" or "Port" property is required.');
				return;
			}
		}

		let soap_body = '';
		soap_body += '<tds:SetNetworkProtocols>';
		params['NetworkProtocols'].forEach((o) => {
			soap_body += '<tds:NetworkProtocols>';
			for(let k in o) {
				if(k.match(/^(Name|Enabled|Port)$/)) {
					soap_body += '<tt:' + k + '>' + o[k] + '</tt:' + k + '>';
				}
			}
			soap_body += '</tds:NetworkProtocols>';
		});
		soap_body += '</tds:SetNetworkProtocols>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'SetNetworkProtocols', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getNetworkDefaultGateway([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getNetworkDefaultGateway = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetNetworkDefaultGateway/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetNetworkDefaultGateway', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setNetworkDefaultGateway(params[, callback])
* - params:
*   - NetworkGateway | Array | required | a list of IP addresses of gateways
*
* {
*   'NetworkGateway': [
*     {'IPv4Address': '192.168.10.1'},
*     {'IPv4Address': '192.168.10.2'}
*   ]
* }
*
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setNetworkDefaultGateway = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}

		if(err_msg = mOnvifSoap.isInvalidValue(params['NetworkGateway'], 'array', true)) {
			reject(new Error('The "NetworkGateway" property was invalid: ' + err_msg));
			return;
		}

		for(let i=0; i<params['NetworkGateway'].length; i++) {
			let o = params['NetworkGateway'][i];
			if('IPv4Address' in o) {
				if(err_msg = mOnvifSoap.isInvalidValue(o['IPv4Address'], 'string')) {
					reject(new Error('The "IPv4Address" property was invalid: ' + err_msg));
					return;
				}
			}
			if('IPv6Address' in o) {
				if(err_msg = mOnvifSoap.isInvalidValue(o['IPv6Address'], 'string')) {
					reject(new Error('The "IPv6Address" property was invalid: ' + err_msg));
					return;
				}
			}
			if(!('IPv4Address' in o) && !('IPv6Address' in o)) {
				reject(new Error('Either "IPv4Address" or "IPv6Address" property must be specified.'));
				return;
			}
		}

		let soap_body = '';
		soap_body += '<tds:SetNetworkDefaultGateway>';
		params['NetworkGateway'].forEach((o) => {
			for(let k in o) {
				if(k.match(/^(IPv4Address|IPv6Address)$/)) {
					soap_body += '<tds:' + k + '>' + o[k] + '</tds:' + k + '>';
				}
			}
		});
		soap_body += '</tds:SetNetworkDefaultGateway>';
		let soap = this._createRequestSoap(soap_body);

		mOnvifSoap.requestCommand(this.oxaddr, 'SetNetworkDefaultGateway', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getDeviceInformation()
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getDeviceInformation = function() {
	let soapBody = '<tds:GetDeviceInformation/>';

	return this.sendRequest('GetDeviceInformation', soapBody);
};

/* ------------------------------------------------------------------
* Method: getSystemDateAndTime()
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getSystemDateAndTime = function() {
    let soapBody = '<tds:GetSystemDateAndTime/>';

    return this.sendRequest('GetSystemDateAndTime', soapBody)
        .then(data => this._parseSystemDateAndTime(data['SystemDateAndTime']));
};


/* ------------------------------------------------------------------
* Method: setSystemDateAndTime(params[, callback])
* - params:
*   - DateTimeType    | string  | required | "NTP" or "Manual".
*   - DaylightSavings | boolean | required | true or false.
*   - TimeZone        | string  | optional | e.g., "EST5EDT", "GMT0", "JST-9".
*   - UTCDateTime     | Date    | optional | A Date object of ECMAScript.
*
* Setting the "UTCDateTime" does not work well for now.
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setSystemDateAndTime = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['DateTimeType'], 'string')) {
			reject(new Error('The "DateTimeType" property was invalid: ' + err_msg));
			return;
		} else if(!params['DateTimeType'].match(/^(NTP|Manual)$/)) {
			reject(new Error('The "DateTimeType" property must be either "NTP" or "Manual".'));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['DaylightSavings'], 'boolean')) {
			reject(new Error('The "DaylightSavings" property was invalid: ' + err_msg));
			return;
		}
	
		if('TimeZone' in params) {
			if(err_msg = mOnvifSoap.isInvalidValue(params['TimeZone'], 'string')) {
				reject(new Error('The "TimeZone" property was invalid: ' + err_msg));
				return;
			} else if(!params['TimeZone'].match(/^[A-Z]{3}\-?\d{1,2}([A-Z]{3,4})?$/)) {
				reject(new Error('The "TimeZone" property must be a string representing a time zone which is defined in POSIX 1003.1.'));
				return;
			}
		}
	
		if('UTCDateTime' in params) {
			let v = params['UTCDateTime'];
			if(!v instanceof Date) {
				reject(new Error('The "UTCDateTime" property must be a Date object of ECMAScript.'));
				return;
			}
		}
	
		let soap_body = '';
		soap_body += '<tds:SetSystemDateAndTime>';
		soap_body += '<tds:DateTimeType>' + params['DateTimeType'] + '</tds:DateTimeType>';
		soap_body += '<tds:DaylightSavings>' + params['DaylightSavings'] + '</tds:DaylightSavings>';
		if(params['TimeZone']) {
			soap_body += '<tds:TimeZone>';
			soap_body +=   '<tt:TZ>' + params['TimeZone'] + '</tt:TZ>';
			soap_body += '</tds:TimeZone>';
		}
		if(params['UTCDateTime']) {
			let dt = params['UTCDateTime'];
			soap_body += '<tds:UTCDateTime>';
			soap_body +=   '<tt:Time>';
			soap_body +=     '<tt:Hour>' + dt.getUTCHours() + '</tt:Hour>';
			soap_body +=     '<tt:Minute>' + dt.getUTCMinutes() + '</tt:Minute>';
			soap_body +=     '<tt:Second>' + dt.getUTCSeconds() + '</tt:Second>';
			soap_body +=   '</tt:Time>';
			soap_body +=   '<tt:Date>';
			soap_body +=     '<tt:Year>' + dt.getUTCFullYear() + '</tt:Year>';
			soap_body +=     '<tt:Month>' + (dt.getUTCMonth() + 1) + '</tt:Month>';
			soap_body +=     '<tt:Day>' + dt.getUTCDate() + '</tt:Day>';
			soap_body +=   '</tt:Date>';
			soap_body += '</tds:UTCDateTime>';
		}
		soap_body += '</tds:SetSystemDateAndTime>';
		let soap = this._createRequestSoap(soap_body);
	
		mOnvifSoap.requestCommand(this.oxaddr, 'SetSystemDateAndTime', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: reboot([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.reboot = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:SystemReboot/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'SystemReboot', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getUsers([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getUsers = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetUsers/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetUsers', soap).then((result) => {
			try {
				let d = result['data']['GetUsersResponse']['User'];
				if(!Array.isArray(d)) {
					result['data']['GetUsersResponse']['User'] = [d];
				}
			} catch(e) {}
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: createUsers(params[, callback])
* - params:
*   - User        | Array  | required |
*     - Username  | string | required | Username
*     - Password  | string | required | Password
*     - UserLevel | string | required | Either "Administrator", "Operator", "User", or "Anonymous"
*
* {
*   'User' : [
*     {'Username': 'test1', 'Password' : 'password', 'UserLevel': 'Administrator'},
*     {'Username': 'test2', 'Password' : 'password', 'UserLevel': 'Operator'},
*     {'Username': 'test3', 'Password' : 'password', 'UserLevel': 'User'}
*   ]
* }
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.createUsers = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['User'], 'array')) {
			reject(new Error('The "User" property was invalid: ' + err_msg));
			return;
		}
	
		for(let i=0; i<params['User'].length; i++) {
			let u = params['User'][i];
			if(err_msg = mOnvifSoap.isInvalidValue(u, 'object')) {
				reject(new Error('The "User" property was invalid: ' + err_msg));
				return;
			}
	
			if(err_msg = mOnvifSoap.isInvalidValue(u['Username'], 'string')) {
				reject(new Error('The "Username" property was invalid: ' + err_msg));
				return;
			}
	
			if(err_msg = mOnvifSoap.isInvalidValue(u['Password'], 'string')) {
				reject(new Error('The "Password" property was invalid: ' + err_msg));
				return;
			}
	
			if(err_msg = mOnvifSoap.isInvalidValue(u['UserLevel'], 'string')) {
				reject(new Error('The "UserLevel" property was invalid: ' + err_msg));
				return;
			} else if(!u['UserLevel'].match(/^(Administrator|Operator|User|Anonymous)$/)) {
				reject(new Error('The "UserLevel" property must be either "Administrator", "Operator", "User", or "Anonymous".'));
				return;
			}
		}
	
		let soap_body = '';
		soap_body += '<tds:CreateUsers>';
		params['User'].forEach((u) => {
			soap_body += '<tds:User>';
			soap_body += '<tt:Username>' + u['Username'] + '</tt:Username>';
			soap_body += '<tt:Password>' + u['Password'] + '</tt:Password>';
			soap_body += '<tt:UserLevel>' + u['UserLevel'] + '</tt:UserLevel>';
			soap_body += '</tds:User>';
		});
		soap_body += '</tds:CreateUsers>';
		let soap = this._createRequestSoap(soap_body);
	
		mOnvifSoap.requestCommand(this.oxaddr, 'CreateUsers', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: deleteUsers(params[, callback])
* - params:
*   - User        | Array  | required |
*     - Username  | string | required | Username
*
* {
*   'User' : [
*     {'Username': 'test1'},
*     {'Username': 'test2'},
*     {'Username': 'test3'}
*   ]
* }
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.deleteUsers = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['User'], 'array')) {
			reject(new Error('The "User" property was invalid: ' + err_msg));
			return;
		}
	
		for(let i=0; i<params['User'].length; i++) {
			let u = params['User'][i];
			if(err_msg = mOnvifSoap.isInvalidValue(u, 'object')) {
				reject(new Error('The "User" property was invalid: ' + err_msg));
				return;
			}
	
			if(err_msg = mOnvifSoap.isInvalidValue(u['Username'], 'string')) {
				reject(new Error('The "Username" property was invalid: ' + err_msg));
				return;
			}
		}
	
		let soap_body = '';
		soap_body += '<tds:DeleteUsers>';
		params['User'].forEach((u) => {
			//soap_body += '<tds:User>';
			soap_body += '<tt:Username>' + u['Username'] + '</tt:Username>';
			//soap_body += '</tds:User>';
		});
		soap_body += '</tds:DeleteUsers>';
		let soap = this._createRequestSoap(soap_body);
	
		mOnvifSoap.requestCommand(this.oxaddr, 'DeleteUsers', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setUser(params[, callback])
* - params:
*   - User        | Array  | required |
*     - Username  | string | required | Username
*     - Password  | string | optional | Password
*     - UserLevel | string | optional | Either "Administrator", "Operator", "User", or "Anonymous"
*
* {
*   'User' : [
*     {'Username': 'test1', 'Password' : 'password', 'UserLevel': 'Administrator'},
*     {'Username': 'test2', 'Password' : 'password', 'UserLevel': 'Operator'},
*     {'Username': 'test3', 'Password' : 'password', 'UserLevel': 'User'}
*   ]
* }
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setUser = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['User'], 'array')) {
			reject(new Error('The "User" property was invalid: ' + err_msg));
			return;
		}
	
		for(let i=0; i<params['User'].length; i++) {
			let u = params['User'][i];
			if(err_msg = mOnvifSoap.isInvalidValue(u, 'object')) {
				reject(new Error('The "User" property was invalid: ' + err_msg));
				return;
			}
	
			if(err_msg = mOnvifSoap.isInvalidValue(u['Username'], 'string')) {
				reject(new Error('The "Username" property was invalid: ' + err_msg));
				return;
			}
	
			if('Password' in u) {
				if(err_msg = mOnvifSoap.isInvalidValue(u['Password'], 'string')) {
					reject(new Error('The "Password" property was invalid: ' + err_msg));
					return;
				}
			}
	
			if('UserLevel' in u) {
				if(err_msg = mOnvifSoap.isInvalidValue(u['UserLevel'], 'string')) {
					reject(new Error('The "UserLevel" property was invalid: ' + err_msg));
					return;
				} else if(!u['UserLevel'].match(/^(Administrator|Operator|User|Anonymous)$/)) {
					reject(new Error('The "UserLevel" property must be either "Administrator", "Operator", "User", or "Anonymous".'));
					return;
				}
			}
		}
	
		let soap_body = '';
		soap_body += '<tds:SetUser>';
		params['User'].forEach((u) => {
			soap_body += '<tds:User>';
			soap_body += '<tt:Username>' + u['Username'] + '</tt:Username>';
			if('Password' in u) {
				soap_body += '<tt:Password>' + u['Password'] + '</tt:Password>';
			}
			if('UserLevel' in u) {
				soap_body += '<tt:UserLevel>' + u['UserLevel'] + '</tt:UserLevel>';
			}
			soap_body += '</tds:User>';
		});
		soap_body += '</tds:SetUser>';
		let soap = this._createRequestSoap(soap_body);
	
		mOnvifSoap.requestCommand(this.oxaddr, 'SetUser', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getRelayOutputs([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getRelayOutputs = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetRelayOutputs/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetRelayOutputs', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getNTP([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getNTP = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetNTP/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetNTP', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setNTP(params[, callback])
* - params:
*   - FromDHCP      | Boolean | required | true or false
*   - NTPManual     | Object  | optional |
*     - Type        | String  | required | "IPv4" or "IPv6"
*     - IPv4Address | String  | required | IP address
*
* {
*    "FromDHCP": "false",
*    "NTPManual": {"Type": "IPv4", "IPv4Address": "192.168.10.1"}
* }
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setNTP = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['FromDHCP'], 'boolean')) {
			reject(new Error('The "FromDHCP" property was invalid: ' + err_msg));
			return;
		}
	
		if('NTPManual' in params) {
			if(err_msg = mOnvifSoap.isInvalidValue(params['NTPManual'], 'object')) {
				reject(new Error('The "NTPManual" property was invalid: ' + err_msg));
				return;
			}
	
			let o = params['NTPManual'];
	
			let type = o['Type'];
			if(err_msg = mOnvifSoap.isInvalidValue(type, 'string')) {
				reject(new Error('The "Type" property was invalid: ' + err_msg));
				return;
			} else if(!type.match(/^(IPv4|IPv6)$/)) {
				reject(new Error('The "Type" property was invalid: The value must be either "IPv4" or "IPv6".'));
				return;
			}
	
			if(type === 'IPv4') {
				if(err_msg = mOnvifSoap.isInvalidValue(o['IPv4Address'], 'string')) {
					reject(new Error('The "IPv4Address" property was invalid: ' + err_msg));
					return;
				}
			} else if(type === 'IPv6') {
				if(err_msg = mOnvifSoap.isInvalidValue(o['IPv6Address'], 'string')) {
					reject(new Error('The "IPv6Address" property was invalid: ' + err_msg));
					return;
				}
			}
		}
	
		let soap_body = '';
		soap_body += '<tds:SetNTP>';
		soap_body += '<tds:FromDHCP>' + params['FromDHCP'] + '</tds:FromDHCP>';
		if('NTPManual' in params) {
			let o = params['NTPManual'];
			soap_body += '<tds:NTPManual>';
			soap_body += '<tt:Type>' + o['Type'] + '</tt:Type>';
			if(o['Type'] === 'IPv4') {
				soap_body += '<tt:IPv4Address>' + o['IPv4Address'] + '</tt:IPv4Address>';
			} else {
				soap_body += '<tt:IPv6Address>' + o['IPv6Address'] + '</tt:IPv6Address>';
			}
			soap_body += '</tds:NTPManual>';
		}
		soap_body += '</tds:SetNTP>';
		let soap = this._createRequestSoap(soap_body);
	
		mOnvifSoap.requestCommand(this.oxaddr, 'SetNTP', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getDynamicDNS([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getDynamicDNS = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetDynamicDNS/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetDynamicDNS', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getZeroConfiguration([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getZeroConfiguration = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetZeroConfiguration/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetZeroConfiguration', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getIPAddressFilter([callback])
* No devcie I own supports this method for now.
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getIPAddressFilter = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetIPAddressFilter/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetIPAddressFilter', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: setIPAddressFilter(params[, callback])
* - params:
*   - Type:          | String  | required | 'Allow', 'Deny' 
*   - IPv4Address    | Array   | required | 
*     - Address      | String  | required | IPv4 address
*     - PrefixLength | Integer | required | Prefix/submask length
*
* {
*    "Type": "Allow",
*    "IPv4Address": [
*      {
*        "Address": "192.168.10.3",
*        "PrefixLength": 24
*      }
*    ]
* ]}
*
* No devcie I own supports this method for now.
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.setIPAddressFilter = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['Type'], 'string')) {
			reject(new Error('The "Type" property was invalid: ' + err_msg));
			return;
		} else if(!params['Type'].match(/^(Allow|Deny)$/)) {
			reject(new Error('The "Type" property was invalid: The value must be either "Allow" or "Deny".'));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['IPv4Address'], 'array')) {
			reject(new Error('The "IPv4Address" property was invalid: ' + err_msg));
			return;
		}
	
		for(let i=0; i<params['IPv4Address'].length; i++) {
			let o = params['IPv4Address'][i];
			if(err_msg = mOnvifSoap.isInvalidValue(o, 'object')) {
				reject(new Error('The "IPv4Address" property was invalid: ' + err_msg));
				return;
			}
			if(err_msg = mOnvifSoap.isInvalidValue(o['Address'], 'string')) {
				reject(new Error('The "Address" property was invalid: ' + err_msg));
				return;
			} else if(!o['Address'].match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
				reject(new Error('The "Address" property was invalid as a IPv4 address.'));
				return;
			}
			if(err_msg = mOnvifSoap.isInvalidValue(o['PrefixLength'], 'integer')) {
				reject(new Error('The "PrefixLength" property was invalid: ' + err_msg));
				return;
			}
		}
	
		let soap_body = '';
		soap_body += '<tds:SetIPAddressFilter>';
		soap_body += '<tds:IPAddressFilter>';
		soap_body += '<tt:Type>' + params['Type'] + '</tt:Type>';
		params['IPv4Address'].forEach((o) => {
			soap_body += '<tt:IPv4Address>';
			soap_body += '<tt:Address>' + o['Address'] + '</tt:Address>';
			soap_body += '<tt:PrefixLength>' + o['PrefixLength'] + '</tt:PrefixLength>';
			soap_body += '</tt:IPv4Address>';
		});
		soap_body += '</tds:IPAddressFilter>';
		soap_body += '</tds:SetIPAddressFilter>';
		let soap = this._createRequestSoap(soap_body);
	
		mOnvifSoap.requestCommand(this.oxaddr, 'SetIPAddressFilter', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getServices(params[, callback])
* - params:
*   - IncludeCapability | boolean | required | true or false
*
* {'IncludeCapability': false}
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getServices = function(params, callback) {
	let promise = new Promise((resolve, reject) => {
		let err_msg = '';
		if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
			reject(new Error('The value of "params" was invalid: ' + err_msg));
			return;
		}
	
		if(err_msg = mOnvifSoap.isInvalidValue(params['IncludeCapability'], 'boolean')) {
			reject(new Error('The "IncludeCapability" property was invalid: ' + err_msg));
			return;
		}
	
		let soap_body = '';
		soap_body += '<tds:GetServices>';
		soap_body += '<tds:IncludeCapability>' + params['IncludeCapability'] + '</tds:IncludeCapability>';
		soap_body += '</tds:GetServices>';
		let soap = this._createRequestSoap(soap_body);
	
		mOnvifSoap.requestCommand(this.oxaddr, 'GetServices', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

/* ------------------------------------------------------------------
* Method: getServiceCapabilities([callback])
* ---------------------------------------------------------------- */
OnvifServiceDevice.prototype.getServiceCapabilities = function(callback) {
	let promise = new Promise((resolve, reject) => {
		let soap_body = '<tds:GetServiceCapabilities/>';
		let soap = this._createRequestSoap(soap_body);
		mOnvifSoap.requestCommand(this.oxaddr, 'GetServiceCapabilities', soap).then((result) => {
			resolve(result);
		}).catch((error) => {
			reject(error);
		});
	});
	if(callback) {
		promise.then((result) => {
			callback(null, result);
		}).catch((error) => {
			callback(error);
		});
	} else {
		return promise;
	}
};

module.exports = OnvifServiceDevice;