'use strict';
const mUrl    = require('url');
const mOnvifSoap = require('./soap.js');

/* ------------------------------------------------------------------
* Constructor: OnvifServiceMedia(xaddr, user, pass, timeDifference)
*  - xaddr : URL of the entry point for the media service (Required)
*  - user : User name (Optional)
*  - pass : Password (Optional)
*  - timeDifference: Time difference in milliseconds
* ---------------------------------------------------------------- */
function OnvifServiceMedia(xaddr, user, pass, timeDifference) {
    if (!this.validateXAddr(xaddr)) throw this.getLastError();

    this.oxaddr = mUrl.parse(xaddr);
    this.user = user || '';
    this.pass = pass || '';
    this.oxaddr.auth = this.user ? `${this.user}:${this.pass}` : '';
    this.timeDifference = timeDifference;
    this.namespaces = [
        'xmlns:trt="http://www.onvif.org/ver10/media/wsdl"',
        'xmlns:tt="http://www.onvif.org/ver10/schema"'
    ];
}

OnvifServiceMedia.prototype._createRequestSoap = function(body) {
    return mOnvifSoap.createRequestSoap({
        'body': body,
        'xmlns': this.namespaces,
        'diff': this.timeDifference,
        'user': this.user,
        'pass': this.pass
    });
};

OnvifServiceMedia.prototype.sendRequest = function (endpoint, soapBody) {
    return mOnvifSoap.requestCommand(this.oxaddr, endpoint, this._createRequestSoap(soapBody));
};

OnvifServiceMedia.prototype.ensureArray = function (data) {
    return Array.isArray(data) ? data : [data];
};

OnvifServiceMedia.prototype.getLastError = function () {
    return this._lastError;
};

OnvifServiceMedia.prototype.setLastError = function (errorMessage) {
    this._lastError = new Error(errorMessage);

    return false;
};

OnvifServiceMedia.prototype.validateXAddr = function (xaddr) {
 	const errorMessage = mOnvifSoap.isInvalidValue(xaddr, 'string');
    if (errorMessage) {
        return this.setLastError(`xaddr invalid: ${errorMessage}`);
    }

    return true;
};

OnvifServiceMedia.prototype.validateConfigurationToken = function (token) {
	const errorMessage = mOnvifSoap.isInvalidValue(token, 'string');
    if (errorMessage) {
        return this.setLastError(`configurationToken invalid: ${errorMessage}`);
    }

    return true;
};

OnvifServiceMedia.prototype.validateProfileToken = function (token, allowEmpty) { // TODO: Allow empty should accept undefined
	const errorMessage = mOnvifSoap.isInvalidValue(token, 'string', allowEmpty);
    if (errorMessage) {
        return this.setLastError(`profileToken invalid: ${errorMessage}`);
    }

    return true;
};

OnvifServiceMedia.prototype.validateProfileName = function (name) {
	const errorMessage = mOnvifSoap.isInvalidValue(name, 'string');
    if (errorMessage) {
        return this.setLastError(`profileName invalid: ${errorMessage}`);
    }

    return true;
};

OnvifServiceMedia.prototype.validateStreamingProtocol = function (protocol) {
	const errorMessage = mOnvifSoap.isInvalidValue(protocol, 'string');
    if (errorMessage) {
        return this.setLastError(`profileName invalid: ${errorMessage}`);
    }

    if (!protocol.match(/^(UDP|HTTP|RTSP)$/)) {
        return this.setLastError('Protocol must be one of "UDP", "HTTP" or "RTSP"');
    }

    return true;
};

OnvifServiceMedia.prototype.validateVideoEncoderConfiguration = function (c) {
    // Source: https://www.onvif.org/ver10/media/wsdl/media.wsdl 75. SetVideoEncoderConfiguration

    const errorMessage = mOnvifSoap.isInvalidValue(c, 'object');
    if (errorMessage) {
        return this.setLastError(`configuration invalid: ${errorMessage}`);
    }

    if (!('name' in c) || !mOnvifSoap.isStringValue(c.name) || c.name.length > 64) {
        return this.setLastError('configuration.name is required, must be a string with a maximum length of 64');
    }

    if (!('encoding' in c) || !mOnvifSoap.isStringValue(c.encoding) || !['JPEG', 'MPEG4', 'H264'].includes(c.encoding)) {
        return this.setLastError('configuration.encoding is required, must be a string with one of the following values: "JPEG", "MPEG4", "H264"');
    }

    if (!('resolution' in c) || !mOnvifSoap.isObjectValue(c.resolution)) {
        return this.setLastError('configuration.resolution is required, must be an object');
    }

    if (!('width' in c.resolution) || !mOnvifSoap.isIntValue(c.resolution.width) || c.resolution.width <= 0) {
        return this.setLastError('configuration.resolution.width is required, must be an integer > 0');
    }

    if (!('height' in c.resolution) || !mOnvifSoap.isIntValue(c.resolution.height) || c.resolution.height <= 0) {
        return this.setLastError('configuration.resolution.height is required, must be an integer > 0');
    }

    if (!('quality' in c) || !mOnvifSoap.isFloatValue(c.quality) || c.quality < 0) {
        return this.setLastError('configuration.quality is required, must be an float >= 0');
    }

    if ('rateControl' in c) {
        if (!mOnvifSoap.isObjectValue(c.rateControl)) {
            return this.setLastError('configuration.rateControl must be an object');
        }

        if (!('frameRateLimit' in c.rateControl) || !mOnvifSoap.isIntValue(c.rateControl.frameRateLimit)) {
            return this.setLastError('configuration.rateControl.frameRateLimit is required, must be an integer');
        }

        if (!('encodingInterval' in c.rateControl) || !mOnvifSoap.isIntValue(c.rateControl.encodingInterval)) {
            return this.setLastError('configuration.rateControl.encodingInterval is required, must be an integer');
        }

        if (!('bitrateLimit' in c.rateControl) || !mOnvifSoap.isIntValue(c.rateControl.bitrateLimit)) {
            return this.setLastError('configuration.rateControl.bitrateLimit is required, must be an integer');
        }
    }

    if (c.encoding === 'MPEG') {
        if (!('mpeg4' in c) || !mOnvifSoap.isObjectValue(c.mpeg4)) {
            return this.setLastError('configuration.mpeg4 is required, must be an object');
        }

        if (!('govLength' in c.mpeg4) || !mOnvifSoap.isIntValue(c.mpeg4.govLength)) {
            return this.setLastError('configuration.mpeg4.govLength is required, must be an integer');
        }

        if (!('mpeg4Profile' in c.mpeg4) || !mOnvifSoap.isStringValue(c.mpeg4.mpeg4Profile) || !['SP', 'ASP'].includes(c.mpeg4.mpeg4Profile)) {
            return this.setLastError('configuration.mpeg4.mpeg4Profile is required, must be a string with one of the following values: "SP", "ASP"');
        }
    }

    if (c.encoding === 'H264') {
        if (!('h264' in c) || !mOnvifSoap.isObjectValue(c.h264)) {
            return this.setLastError('configuration.h264 is required, must be an object');
        }

        if (!('govLength' in c.h264) || !mOnvifSoap.isIntValue(c.h264.govLength)) {
            return this.setLastError('configuration.h264.govLength is required, must be an integer');
        }

        if (!('h264Profile' in c.h264) || !mOnvifSoap.isStringValue(c.h264.h264Profile) || !['Baseline', 'Main', 'Extended', 'High'].includes(c.h264.h264Profile)) {
            return this.setLastError('configuration.h264.h264Profile is required, must be a string with one of the following values: "Baseline", "Main", "Extended", "High"');
        }
    }

    if (!('multicast' in c) || !mOnvifSoap.isObjectValue(c.multicast)) {
        return this.setLastError('configuration.multicast is required, must be an object');
    }

    if (!('address' in c.multicast) || !mOnvifSoap.isObjectValue(c.multicast.address)) {
        return this.setLastError('configuration.multicast.address is required, must be an object');
    }

    if (!('type' in c.multicast.address) || !mOnvifSoap.isStringValue(c.multicast.address.type) || !['IPv4', 'IPv6'].includes(c.multicast.address.type)) {
        return this.setLastError('configuration.multicast.address.type is required, must be a string with one of the following values: "IPv4", "IPv6"');
    }

    if (c.multicast.address.type === 'IPv4') {
        if (!('ipv4Address' in c.multicast.address) || !mOnvifSoap.isStringValue(c.multicast.address.ipv4Address)) {
            return this.setLastError('configuration.multicast.address.ipv4Address is required, must be a string');
        }
    }

    if (c.multicast.address.type === 'IPv6') {
        if (!('ipv6Address' in c.multicast.address) || !mOnvifSoap.isStringValue(c.multicast.address.ipv6Address)) {
            return this.setLastError('configuration.multicast.address.ipv6Address is required, must be a string');
        }
    }

    if (!('port' in c.multicast) || !mOnvifSoap.isIntValue(c.multicast.port)) {
        return this.setLastError('configuration.multicast.port is required, must be an int');
    }

    if (!('ttl' in c.multicast) || !mOnvifSoap.isIntValue(c.multicast.ttl)) {
        return this.setLastError('configuration.multicast.ttl is required, must be an int');
    }

    if (!('autoStart' in c.multicast) || !mOnvifSoap.isBooleanValue(c.multicast.autoStart)) {
        return this.setLastError('configuration.multicast.autoStart is required, must be a boolean');
    }

    if (!('sessionTimeout' in c) || !mOnvifSoap.isStringValue(c.sessionTimeout)) {
        return this.setLastError('configuration.sessionTimeout is required, must be a string');
    }

    return true;
};

OnvifServiceMedia.prototype.parseVideoSourceConfiguration = function (config) {
    return {
        token: config['$']['token'],
        name: config['Name'],
        useCount: parseInt(config['UseCount']),
        viewMode: config['ViewMode'],
        sourceToken: config['SourceToken'],
        bounds: {
            'x': parseInt(config['Bounds']['$']['x']),
            'y': parseInt(config['Bounds']['$']['y']),
            'width': parseInt(config['Bounds']['$']['width']),
            'height': parseInt(config['Bounds']['$']['height'])
        },
        extension: !('Extension' in config) ? null : {
            rotate: !('Rotate' in config) ? null : {
                mode: config['Extension']['Rotate']['Mode'],
                degree: parseInt(config['Extension']['Rotate']['Degree']),
                extension: config['Extension']['Rotate']['Degree']
            },
            extension: !('Extension' in config['Extension']) ? null : {
                lensDescription: !('LensDescription' in config['Extension']['Extension']) ? null : {
                    focalLength: parseFloat(config['Extension']['Extension']['LensDescription']['FocalLength']),
                    offset: {
                        x: parseFloat(config['Extension']['Extension']['LensDescription']['Offset']['$']['x']),
                        y: parseFloat(config['Extension']['Extension']['LensDescription']['Offset']['$']['y']),
                    },
                    projection: {
                        angle: parseFloat(config['Extension']['Extension']['LensDescription']['Projection']['Angle']),
                        radius: parseFloat(config['Extension']['Extension']['LensDescription']['Projection']['Radius']),
                        transmittance: parseFloat(config['Extension']['Extension']['LensDescription']['Projection']['Transmittance']),
                    },
                    xFactor: parseFloat(config['Extension']['Extension']['LensDescription']['XFactor'])
                },
                sceneOrientation: !('SceneOrientation' in config['Extension']['Extension']) ? null : {
                    mode: config['Extension']['Extension']['SceneOrientation']['Mode'],
                    orientation: config['Extension']['Extension']['SceneOrientation']['Orientation']
                }
            }
        }
    };
};

OnvifServiceMedia.prototype.parseVideoEncoderConfiguration = function (config) {
    return {
        token: config['$']['token'],
        name: config['Name'],
        useCount: parseInt(config['UseCount']),
        encoding: config['Encoding'],
        resolution: {
            width: parseInt(config['Resolution']['Width']),
            height: parseInt(config['Resolution']['Height'])
        },
        quality: parseInt(config['Quality']),
        rateControl: {
            frameRateLimit: parseInt(config['RateControl']['FrameRateLimit']),
            encodingInterval: parseInt(config['RateControl']['EncodingInterval']),
            bitrateLimit: parseInt(config['RateControl']['BitrateLimit'])
        },
        mpeg4: config['Encoding'] !== 'MPEG4' ? null : {
            govLength: parseInt(config['MPEG4']['GovLength']),
            mpeg4Profile: config['MPEG4']['Mpeg4Profile']

        },
        h264: config['Encoding'] !== 'H264' ? null : {
            govLength: parseInt(config['H264']['GovLength']),
            h264Profile: config['H264']['H264Profile']
        },
        multicast: {
            address: {
                type: config['Multicast']['Address']['Type'],
                ipv4Address: config['Multicast']['Address']['Type'] === 'IPv4' ? config['Multicast']['Address']['IPv4Address'] : null,
                ipv6Address: config['Multicast']['Address']['Type'] === 'IPv6' ? config['Multicast']['Address']['IPv6Address'] : null
            },
            port: parseInt(config['Multicast']['Port']),
            ttl: parseInt(config['Multicast']['TTL']),
            autoStart: config['Multicast']['AutoStart'].toLowerCase() === 'true',
        },
        sessionTimeout: config['SessionTimeout']
    };
};

OnvifServiceMedia.prototype.parseVideoSourceConfigurationOptions = function (config) {
    return {
        maximumNumberOfProfiles: parseInt(config['MaximumNumberOfProfiles']),
        boundsRange: {
            xRange: {
                min: parseInt(config['BoundsRange']['XRange']['Min']),
                max: parseInt(config['BoundsRange']['XRange']['Max'])
            },
            yRange: {
                min: parseInt(config['BoundsRange']['YRange']['Min']),
                max: parseInt(config['BoundsRange']['YRange']['Max'])
            },
            widthRange: {
                min: parseInt(config['BoundsRange']['WidthRange']['Min']),
                max: parseInt(config['BoundsRange']['WidthRange']['Max'])
            },
            heightRange: {
                min: parseInt(config['BoundsRange']['HeightRange']['Min']),
                max: parseInt(config['BoundsRange']['HeightRange']['Max'])
            }
        },
        videoSourceTokensAvailable: config['VideoSourceTokensAvailable'],
        extension: !('Extension' in config) ? null : {
            rotate: !('Rotate' in config['Extension']) ? null : {
                mode: config['Extension']['Rotate']['Mode'],
                degreeList: !('DegreeList' in config['Extension']['Rotate']) ? [] : config['Extension']['Rotate']['DegreeList']['Items'].map(val => parseInt(val)),
                extension: !('Extension' in config['Extension']['Rotate']) ? null : config['Extension']['Rotate']['Extension']
            },
            extension: !('Extension' in config['Extension']) ? null : {
                sceneOrientation: config['Extension']['Extension']['SceneOrientationMode']
            }
        }
    };
};

OnvifServiceMedia.prototype.parseVideoEncoderConfigurationOptions = function (options) {
    return {
        qualityRange: {
            min: parseInt(options['QualityRange']['Min']),
            max: parseInt(options['QualityRange']['Max'])
        },
        jpeg: 'JPEG' in options ? this.parseJPEGVideoEncoderConfigurationOptions(options['JPEG']) : null,
        mpeg4: 'MPEG4' in options ? this.parseMpeg4VideoEncoderConfigurationOptions(options['MPEG4']) : null,
        h264: 'H264' in options ? this.parseH264VideoEncoderConfigurationOptions(options['H264']) : null,
        extension: {
            jpeg: 'JPEG' in options['Extension'] ? this.parseJPEGVideoEncoderConfigurationOptions(options['Extension']['JPEG']) : null,
            mpeg4: 'MPEG4' in options['Extension'] ? this.parseMpeg4VideoEncoderConfigurationOptions(options['Extension']['MPEG4']) : null,
            h264: 'H264' in options['Extension'] ? this.parseH264VideoEncoderConfigurationOptions(options['Extension']['H264']) : null,
            extension: options['Extension']['Extension'],
        }
    };
};

OnvifServiceMedia.prototype.parseJPEGVideoEncoderConfigurationOptions = function (options) {
    return {
        resolutionsAvailable: options['ResolutionsAvailable'].map(resolution => ({
            width: parseInt(resolution['Width']),
            height: parseInt(resolution['Height'])
        })),
        frameRateRange: {
            min: parseInt(options['FrameRateRange']['Min']),
            max: parseInt(options['FrameRateRange']['Max'])
        },
        encodingIntervalRange: {
            min: parseInt(options['EncodingIntervalRange']['Min']),
            max: parseInt(options['EncodingIntervalRange']['Max'])
        },
        bitrateRange: !('BitrateRange' in options) ? null : { // Only present in version 2
            min: parseInt(options['BitrateRange']['Min']),
            max: parseInt(options['BitrateRange']['Max'])
        }
    };
};

OnvifServiceMedia.prototype.parseMpeg4VideoEncoderConfigurationOptions = function (options) {
    return {
        resolutionsAvailable: options['ResolutionsAvailable'].map(resolution => ({
            width: parseInt(resolution['Width']),
            height: parseInt(resolution['Height'])
        })),
        govLengthRange: {
            min: parseInt(options['GovLengthRange']['Min']),
            max: parseInt(options['GovLengthRange']['Max'])
        },
        frameRateRange: {
            min: parseInt(options['FrameRateRange']['Min']),
            max: parseInt(options['FrameRateRange']['Max'])
        },
        encodingIntervalRange: {
            min: parseInt(options['EncodingIntervalRange']['Min']),
            max: parseInt(options['EncodingIntervalRange']['Max'])
        },
        mpeg4ProfilesSupported: options['Mpeg4ProfilesSupported'],
        bitrateRange: !('BitrateRange' in options) ? null : { // Only present in version 2
            min: parseInt(options['BitrateRange']['Min']),
            max: parseInt(options['BitrateRange']['Max'])
        }
    };
};

OnvifServiceMedia.prototype.parseH264VideoEncoderConfigurationOptions = function (options) {
    return {
        resolutionsAvailable: options['ResolutionsAvailable'].map(resolution => ({
            width: parseInt(resolution['Width']),
            height: parseInt(resolution['Height'])
        })),
        govLengthRange: {
            min: parseInt(options['GovLengthRange']['Min']),
            max: parseInt(options['GovLengthRange']['Max'])
        },
        frameRateRange: {
            min: parseInt(options['FrameRateRange']['Min']),
            max: parseInt(options['FrameRateRange']['Max'])
        },
        encodingIntervalRange: {
            min: parseInt(options['EncodingIntervalRange']['Min']),
            max: parseInt(options['EncodingIntervalRange']['Max'])
        },
        h264ProfilesSupported: options['H264ProfilesSupported'],
        bitrateRange: !('BitrateRange' in options) ? null : { // Only present in version 2
            min: parseInt(options['BitrateRange']['Min']),
            max: parseInt(options['BitrateRange']['Max'])
        }
    };
};

OnvifServiceMedia.prototype.parseGuaranteedNumberOfVideoEncoderInstances = function (data) {
    return {
        totalNumber: parseInt(data['TotalNumber']),
        jpeg: 'JPEG' in data ? parseInt(data['JPEG']) : null,
        mpeg4: 'MPEG4' in data ? parseInt(data['MPEG4']) : null,
        h264: 'H264' in data ? parseInt(data['H264']) : null
    };
};

OnvifServiceMedia.prototype.parseProfile = function (profile) {
    return {
        token: profile['$']['token'],
        fixed: profile['$']['fixed'].toLowerCase() === 'true',
        name: profile['Name'],
        videoSourceConfiguration: !('VideoSourceConfiguration' in profile) ? null : this.parseVideoSourceConfiguration(profile['VideoSourceConfiguration']),
        audioSourceConfiguration: null, // TODO: Not implemented yet
        videoEncoderConfiguration: !('VideoEncoderConfiguration' in profile) ? null : this.parseVideoEncoderConfiguration(profile['VideoEncoderConfiguration']),
        audioEncoderConfiguration: null, // TODO: Not implemented yet
        videoAnalyticsConfiguration: null, // TODO: Not implemented yet
        ptzConfiguration: null, // TODO: Not implemented yet
        metadataConfiguration: null, // TODO: Not implemented yet
        Extension: null // TODO: Not implemented yet
    };
};

OnvifServiceMedia.prototype.parseStreamUri = function (data) {
    return {
        uri: data['Uri'],
        invalidAfterConnect: data['InvalidAfterConnect'].toLowerCase() === 'true',
        invalidAfterReboot: data['InvalidAfterReboot'].toLowerCase() === 'true',
        timeout: data['Timeout']
    };
};

/* ------------------------------------------------------------------
* Method: getStreamUri(profileToken, protocol)
* - profileToken | String | required | a token of the profile
* - protocol     | String | required | "UDP", "HTTP", or "RTSP"
*
* Source:
*   47: GetStreamUri, https://www.onvif.org/ver10/media/wsdl/media.wsdl
*
* Note: Parameter Transport.Tunnel not implemented (TODO: Not implemented yet)
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getStreamUri = function(profileToken, protocol) {
    if (!this.validateProfileToken(profileToken)) throw this.getLastError();
    if (!this.validateStreamingProtocol(protocol)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:GetStreamUri>';
    soapBody += '<trt:StreamSetup>';
    soapBody += '<tt:Stream>RTP-Unicast</tt:Stream>';
    soapBody += '<tt:Transport>';
    soapBody += `<tt:Protocol>${protocol}</tt:Protocol>`;
    soapBody += '</tt:Transport>';
    soapBody += '</trt:StreamSetup>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += '</trt:GetStreamUri>';

    return this.sendRequest('GetStreamUri', soapBody)
        .then(data => this.parseStreamUri(data['MediaUri']));
};

/* ------------------------------------------------------------------
* Method: getVideoEncoderConfigurations()
*
* Source:
*   52: GetVideoEncoderConfigurations, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getVideoEncoderConfigurations = function() {
    const soapBody = '<trt:GetVideoEncoderConfigurations />';

    return this.sendRequest('GetVideoEncoderConfigurations', soapBody)
        .then(data => data['Configurations'])
        .then(this.ensureArray)
        .then(data => data.map(config => this.parseVideoEncoderConfiguration(config)));
};

/* ------------------------------------------------------------------
* Method: getVideoEncoderConfiguration(configurationToken)
* - configurationToken | String | required | a token of the configuration
*
* Source:
*   50: GetVideoEncoderConfiguration, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getVideoEncoderConfiguration = function(configurationToken) {
    if (!this.validateConfigurationToken(configurationToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:GetVideoEncoderConfiguration>';
    soapBody += `<trt:ConfigurationToken>${configurationToken}</trt:ConfigurationToken>`;
    soapBody += '</trt:GetVideoEncoderConfiguration>';

    return this.sendRequest('GetVideoEncoderConfiguration', soapBody)
        .then(data => this.parseVideoEncoderConfiguration(data['Configuration']));
};

/* ------------------------------------------------------------------
* Method: setVideoEncoderConfiguration(configurationToken, configuration)
* - configurationToken | String | required | a token of the configuration
* - configuration | Object | required | The new configuration object
*
* Source:
*   75: SetVideoEncoderConfiguration, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.setVideoEncoderConfiguration = function(configurationToken, config) {
    if (!this.validateConfigurationToken(configurationToken)) throw this.getLastError();
    if (!this.validateVideoEncoderConfiguration(config)) throw this.getLastError();

    const {
        name,
        encoding,
        resolution,
        quality,
        rateControl,
        multicast,
        sessionTimeout,
        mpeg4,
        h264
    } = config;

    let resolutionBody = ``;
    resolutionBody += `<tt:Width>${resolution.width}</tt:Width>`;
    resolutionBody += `<tt:Height>${resolution.height}</tt:Height>`;

    let rateControlBody = ``;
    if (rateControl !== undefined) {
        rateControlBody += `<tt:FrameRateLimit>${rateControl.frameRateLimit}</tt:FrameRateLimit>`;
        rateControlBody += `<tt:EncodingInterval>${rateControl.encodingInterval}</tt:EncodingInterval>`;
        rateControlBody += `<tt:BitrateLimit>${rateControl.bitrateLimit}</tt:BitrateLimit>`;
    }

    let mpeg4Body = ``;
    if (mpeg4 !== undefined) {
        mpeg4Body += `<tt:GovLength>${mpeg4.govLength}</tt:GovLength>`;
        mpeg4Body += `<tt:Mpeg4Profile>${mpeg4.mpeg4Profile}</tt:Mpeg4Profile>`;
    }

    let h264Body = ``;
    if (h264 !== undefined) {
        h264Body += `<tt:GovLength>${h264.govLength}</tt:GovLength>`;
        h264Body += `<tt:H264Profile>${h264.h264Profile}</tt:H264Profile>`;
    }

    let addressBody = ``;
    addressBody += `<tt:Type>${multicast.address.type}</tt:Type>`;
    addressBody += (multicast.address.type === 'IPv4') ? `<tt:IPv4Address>${multicast.address.ipv4Address}</tt:IPv4Address>` : ``;
    addressBody += (multicast.address.type === 'IPv6') ? `<tt:IPv6Address>${multicast.address.ipv6Address}</tt:IPv6Address>` : ``;

    let multicastBody = ``;
    multicastBody += `<tt:Address>${addressBody}</tt:Address>`;
    multicastBody += `<tt:Port>${multicast.port}</tt:Port>`;
    multicastBody += `<tt:TTL>${multicast.ttl}</tt:TTL>`;
    multicastBody += `<tt:AutoStart>${multicast.autoStart}</tt:AutoStart>`;

    let configBody = ``;
    configBody += `<tt:Name>${name}</tt:Name>`;
    configBody += `<tt:UseCount>0</tt:UseCount>`;
    configBody += `<tt:Encoding>${encoding}</tt:Encoding>`;
    configBody += `<tt:Resolution>${resolutionBody}</tt:Resolution>`;
    configBody += `<tt:Quality>${quality}</tt:Quality>`;
    configBody += rateControl ? `<tt:RateControl>${rateControlBody}</tt:RateControl>` : ``;
    configBody += (encoding === 'MPEG4') ? `<tt:MPEG4>${mpeg4Body}</tt:MPEG4>` : ``;
    configBody += (encoding === 'H264') ? `<tt:H264>${h264Body}</tt:H264>` : ``;
    configBody += `<tt:Multicast>${multicastBody}</tt:Multicast>`;
    configBody += `<tt:SessionTimeout>${sessionTimeout}</tt:SessionTimeout>`;

    let soapBody = ``;
    soapBody += `<trt:SetVideoEncoderConfiguration>`;
    soapBody += `<trt:Configuration token="${configurationToken}">${configBody}</trt:Configuration>`;
    soapBody += '<trt:ForcePersistence>true</trt:ForcePersistence>';
    soapBody += '</trt:SetVideoEncoderConfiguration>';

    return this.sendRequest('SetVideoEncoderConfiguration', soapBody);
};

/* ------------------------------------------------------------------
* Method: addVideoEncoderConfiguration(profileToken, configurationToken)
* - profileToken | String | required | The associate profile token
* - configurationToken | String | required | a token of the configuration
*
* Source:
*   8: AddVideoEncoderConfiguration, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.addVideoEncoderConfiguration = function(profileToken, configurationToken) {
    if (!this.validateProfileToken(profileToken)) throw this.getLastError();
    if (!this.validateConfigurationToken(configurationToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:AddVideoEncoderConfiguration>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += `<trt:ConfigurationToken>${configurationToken}</trt:ConfigurationToken>`;
    soapBody += '</trt:AddVideoEncoderConfiguration>';

    return this.sendRequest('AddVideoEncoderConfiguration', soapBody);
};

/* ------------------------------------------------------------------
* Method: addVideoSourceConfiguration(profileToken, configurationToken)
* - profileToken | String | required | The associate profile token
* - configurationToken | String | required | a token of the configuration
*
* Source:
*   9: AddVideoSourceConfiguration, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.addVideoSourceConfiguration = function(profileToken, configurationToken) {
    if (!this.validateConfigurationToken(configurationToken)) throw this.getLastError();
    if (!this.validateProfileToken(profileToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:AddVideoSourceConfiguration>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += `<trt:ConfigurationToken>${configurationToken}</trt:ConfigurationToken>`;
    soapBody += '</trt:AddVideoSourceConfiguration>';

    return this.sendRequest('AddVideoSourceConfiguration', soapBody);
};

/* ------------------------------------------------------------------
* Method: getCompatibleVideoEncoderConfigurations(profileToken)
* - profileToken | String | required | a token of the profile
*
* Source:
*   34: GetCompatibleVideoEncoderConfigurations, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getCompatibleVideoEncoderConfigurations = function (profileToken) {
    if (!this.validateProfileToken(profileToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:GetCompatibleVideoEncoderConfigurations>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += '</trt:GetCompatibleVideoEncoderConfigurations>';

    return this.sendRequest('GetCompatibleVideoEncoderConfigurations', soapBody)
        .then(data => data['Configurations'])
        .then(this.ensureArray)
        .then(data => data.map(config => this.parseVideoEncoderConfiguration(config)));
};

/* ------------------------------------------------------------------
* Method: getVideoEncoderConfigurationOptions(params)
* - params:
*   - profileToken       | String | optional | a token of the profile
*   - configurationToken | String | optional | a token of the configuration
*
* Source:
*   51: GetVideoEncoderConfigurationOptions, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getVideoEncoderConfigurationOptions = function (params) {
    let soapBody = '';
    soapBody += '<trt:GetVideoEncoderConfigurationOptions>';

    if (params) {
        if ('profileToken' in params && mOnvifSoap.isStringValue(params.profileToken)) {
            soapBody += `<trt:ProfileToken>${params.profileToken}</trt:ProfileToken>`;
        }
        if ('configurationToken' in params && mOnvifSoap.isStringValue(params.configurationToken)) {
            soapBody += `<trt:ConfigurationToken>${params.configurationToken}</trt:ConfigurationToken>`;
        }
    }

    soapBody += '</trt:GetVideoEncoderConfigurationOptions>';

    return this.sendRequest('GetVideoEncoderConfigurationOptions', soapBody)
        .then(data => this.parseVideoEncoderConfigurationOptions(data['Options']));
};

/* ------------------------------------------------------------------
* Method: getGuaranteedNumberOfVideoEncoderInstances(configurationToken)
* - configurationToken | String | required | a token of the configuration
*
* Source:
*   36: GetGuaranteedNumberOfVideoEncoderInstances, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getGuaranteedNumberOfVideoEncoderInstances = function(configurationToken) {
    if (!this.validateConfigurationToken(configurationToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:GetGuaranteedNumberOfVideoEncoderInstances>';
    soapBody += `<trt:ConfigurationToken>${configurationToken}</trt:ConfigurationToken>`;
    soapBody += '</trt:GetGuaranteedNumberOfVideoEncoderInstances>';

    return this.sendRequest('GetGuaranteedNumberOfVideoEncoderInstances', soapBody)
        .then(this.parseGuaranteedNumberOfVideoEncoderInstances);
};

/* ------------------------------------------------------------------
* Method: getProfiles()
*
* Source:
*   44: GetProfiles, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getProfiles = function() {
    let soapBody = '<trt:GetProfiles/>';

    return this.sendRequest('GetProfiles', soapBody)
        .then(data => data['Profiles'])
        .then(this.ensureArray)
        .then(data => data.map(profile => this.parseProfile(profile)));
};

/* ------------------------------------------------------------------
* Method: getProfile(profileToken)
* - profileToken | required | a token of the profile
*
* Source:
*   43: GetProfile, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getProfile = function (profileToken) {
    if (!this.validateProfileToken(profileToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:GetProfile>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += '</trt:GetProfile>';

    return this.sendRequest('GetProfile', soapBody)
        .then(data => this.parseProfile(data['Profile']));
};

/* ------------------------------------------------------------------
* Method: createProfile(profileName, profileToken)
* - profileName  | String | required | a name of the profile
* - profileToken | String | optional | a token of the profile
*
* Source:
*   11: CreateProfile, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.createProfile = function (profileName, profileToken) {
    if (!this.validateProfileName(profileName)) throw this.getLastError();
    if (!this.validateProfileToken(profileToken, true)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:CreateProfile>';
    soapBody += `<trt:Name>${profileName}</trt:Name>`;
    soapBody += profileToken ? `<trt:Token>${profileToken}</trt:Token>` : '';
    soapBody += '</trt:CreateProfile>';

    return this.sendRequest('CreateProfile', soapBody)
        .then(data => this.parseProfile(data['Profile']));
};

/* ------------------------------------------------------------------
* Method: deleteProfile(profileToken)
* - profileToken | String | required |
*
* Source:
*   13: DeleteProfile, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.deleteProfile = function (profileToken) {
    if (!this.validateProfileToken(profileToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:DeleteProfile>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += '</trt:DeleteProfile>';

    return this.sendRequest('DeleteProfile', soapBody);
};

/* ------------------------------------------------------------------
* Method: getVideoSources()
*
* Source:
*   57: GetVideoSources, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getVideoSources = function () {
    let soapBody = '<trt:GetVideoSources/>';

    return this.sendRequest('GetVideoSources', soapBody);
    // TODO: Parse the video sources response data
};

/* ------------------------------------------------------------------
* Method: getVideoSourceConfiguration(configurationToken)
* - configurationToken | String | required |
*
* Source:
*   53: GetVideoSourceConfiguration, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getVideoSourceConfiguration = function (configurationToken) {
    if (!this.validateConfigurationToken(configurationToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:GetVideoSourceConfiguration>';
    soapBody += `<trt:ConfigurationToken>${configurationToken}</trt:ConfigurationToken>`;
    soapBody += '</trt:GetVideoSourceConfiguration>';

    return this.sendRequest('GetVideoSourceConfiguration', soapBody)
        .then(data => this.parseVideoSourceConfiguration(data['Configuration']));
};

/* ------------------------------------------------------------------
* Method: getVideoSourceConfigurations()
*
* Sources:
*   55: GetVideoSourceConfigurations, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getVideoSourceConfigurations = function () {
    let soapBody = '<trt:GetVideoSourceConfigurations/>';

    return this.sendRequest('GetVideoSourceConfigurations', soapBody)
        .then(data => data['Configurations'])
        .then(this.ensureArray)
        .then(data => data.map(config => this.parseVideoSourceConfiguration(config)));
};

/* ------------------------------------------------------------------
* Method: getCompatibleVideoSourceConfigurations(profileToken)
* - profileToken | String | required | a token of the profile
*
* Source:
*   35: GetCompatibleVideoSourceConfigurations, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getCompatibleVideoSourceConfigurations = function(profileToken) {
    if (!this.validateProfileToken(profileToken)) throw this.getLastError();

    let soapBody = '';
    soapBody += '<trt:GetCompatibleVideoSourceConfigurations>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += '</trt:GetCompatibleVideoSourceConfigurations>';

    return this.sendRequest('GetCompatibleVideoSourceConfigurations', soapBody)
        .then(data => data['Configurations'])
        .then(this.ensureArray)
        .then(data => data.map(config => this.parseVideoSourceConfiguration(config)));
};

/* ------------------------------------------------------------------
* Method: getVideoSourceConfigurationOptions(params)
* - params:
*   - profileToken       | optional | a token of the Profile
*   - configurationToken | optional | a token of the configuration
*
* Source:
*   54: GetVideoSourceConfigurationOptions, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getVideoSourceConfigurationOptions = function(params) {
    let soapBody = '';
    soapBody += '<trt:GetVideoSourceConfigurationOptions>';

    if (params) {
        if ('profileToken' in params && mOnvifSoap.isStringValue(params.profileToken)) {
            soapBody += `<trt:ProfileToken>${params.profileToken}</trt:ProfileToken>`;
        }
        if ('configurationToken' in params && mOnvifSoap.isStringValue(params.configurationToken)) {
            soapBody += `<trt:ConfigurationToken>${params.configurationToken}</trt:ConfigurationToken>`;
        }
    }
    soapBody += '</trt:GetVideoSourceConfigurationOptions>';

    return this.sendRequest('GetVideoSourceConfigurationOptions', soapBody)
        .then(data => this.parseVideoSourceConfigurationOptions(data['Options']));
};

/* ------------------------------------------------------------------
* Method: getMetadataConfiguration(params[, callback])
* - params:
*   - ConfigurationToken | required | 
*
* {
*   'ConfigurationToken': 'Conf1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getMetadataConfiguration = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
            reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:GetMetadataConfiguration>';
        soap_body +=   '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        soap_body += '</trt:GetMetadataConfiguration>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetMetadataConfiguration', soap).then((result) => {
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
* Method: getMetadataConfigurations([callback])
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getMetadataConfigurations = function(callback) {
    let promise = new Promise((resolve, reject) => {
        let soap_body = '<trt:GetMetadataConfigurations/>';
        let soap = this._createRequestSoap(soap_body);
        mOnvifSoap.requestCommand(this.oxaddr, 'GetMetadataConfigurations', soap).then((result) => {
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
* Method: addMetadataConfiguration(params[, callback])
* - params:
*   - ProfileToken       | String | required | a token of the Profile
*   - ConfigurationToken | String | required | 
*
* {
*   'ProfileToken': 'Profile1'
*   'ConfigurationToken': 'Conf1'
* }
*
* No device I own does not support this command
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.addMetadataConfiguration = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
            reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:AddMetadataConfiguration>';
        soap_body +=   '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body +=   '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        soap_body += '</trt:AddMetadataConfiguration>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'AddMetadataConfiguration', soap).then((result) => {
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
* Method: getCompatibleMetadataConfigurations(params[, callback])
* - params:
*   - ProfileToken | String | required | a token of the Profile
*
* {
*   'ProfileToken': 'Profile1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getCompatibleMetadataConfigurations = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:GetCompatibleMetadataConfigurations>';
        soap_body +=   '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body += '</trt:GetCompatibleMetadataConfigurations>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetCompatibleMetadataConfigurations', soap).then((result) => {
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
* Method: getMetadataConfigurationOptions(params[, callback])
* - params:
*   - ProfileToken       | String | optional | a token of the Profile
*   - ConfigurationToken | String | optional | 
*
* {
*   'ProfileToken': 'Profile1'
*   'ConfigurationToken': 'Conf1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getMetadataConfigurationOptions = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if('ProfileToken' in params) {
            if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
                reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
                return;
            }
        }

        if('ConfigurationToken' in params) {
            if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
                reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
                return;
            }
        }

        let soap_body = '';
        soap_body += '<trt:GetMetadataConfigurationOptions>';
        if('ProfileToken' in params) {
            soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        }
        if('ConfigurationToken' in params) {
            soap_body += '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        }
        soap_body += '</trt:GetMetadataConfigurationOptions>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetMetadataConfigurationOptions', soap).then((result) => {
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
* Method: getAudioSources([callback])
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getAudioSources = function(callback) {
    let promise = new Promise((resolve, reject) => {
        let soap_body = '<trt:GetAudioSources/>';
        let soap = this._createRequestSoap(soap_body);
        mOnvifSoap.requestCommand(this.oxaddr, 'GetAudioSources', soap).then((result) => {
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
* Method: getAudioSourceConfiguration(params[, callback])
* - params:
*   - ConfigurationToken | String | required | 
*
* {
*   'ConfigurationToken': 'Conf1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getAudioSourceConfiguration = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
            reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:GetAudioSourceConfiguration>';
        soap_body += '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        soap_body += '</trt:GetAudioSourceConfiguration>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetAudioSourceConfiguration', soap).then((result) => {
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
* Method: getAudioSourceConfigurations([callback])
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getAudioSourceConfigurations = function(callback) {
    let promise = new Promise((resolve, reject) => {
        let soap_body = '<trt:GetAudioSourceConfigurations/>';
        let soap = this._createRequestSoap(soap_body);
        mOnvifSoap.requestCommand(this.oxaddr, 'GetAudioSourceConfigurations', soap).then((result) => {
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
* Method: addAudioSourceConfiguration(params[, callback])
* - params:
*   - ProfileToken       | String | required | a token of the Profile
*   - ConfigurationToken | String | required |  
*
* {
*   'ProfileToken': 'Profile1',
*   'ConfigurationToken': 'Conf1'
* }
*
* No device I own does not support this command
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.addAudioSourceConfiguration = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
            reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:AddAudioSourceConfiguration>';
        soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body += '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        soap_body += '</trt:AddAudioSourceConfiguration>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'AddAudioSourceConfiguration', soap).then((result) => {
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
* Method: getCompatibleAudioSourceConfigurations(params[, callback])
* - params:
*   - ProfileToken | String | required | a token of the profile
*
* {
*   'ProfileToken': 'Profile1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getCompatibleAudioSourceConfigurations = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:GetCompatibleAudioSourceConfigurations>';
        soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body += '</trt:GetCompatibleAudioSourceConfigurations>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetCompatibleAudioSourceConfigurations', soap).then((result) => {
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
* Method: getAudioSourceConfigurationOptions(params[, callback])
* - params:
*   - ProfileToken       | String | optional | a token of the Profile
*   - ConfigurationToken | String | optional | 
*
* {
*   'ProfileToken': 'Profile1'
*   'ConfigurationToken': 'Conf1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getAudioSourceConfigurationOptions = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if('ProfileToken' in params) {
            if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
                reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
                return;
            }
        }

        if('ConfigurationToken' in params) {
            if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
                reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
                return;
            }
        }

        let soap_body = '';
        soap_body += '<trt:GetAudioSourceConfigurationOptions>';
        if('ProfileToken' in params) {
            soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        }
        if('ConfigurationToken' in params) {
            soap_body += '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        }
        soap_body += '</trt:GetAudioSourceConfigurationOptions>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetAudioSourceConfigurationOptions', soap).then((result) => {
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
* Method: getAudioEncoderConfiguration(params[, callback])
* - params:
*   - ConfigurationToken | String | required | 
*
* {
*   'ConfigurationToken': 'Profile1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getAudioEncoderConfiguration = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
            reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:GetAudioEncoderConfiguration>';
        soap_body += '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        soap_body += '</trt:GetAudioEncoderConfiguration>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetAudioEncoderConfiguration', soap).then((result) => {
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
* Method: getAudioEncoderConfigurations([callback])
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getAudioEncoderConfigurations = function(callback) {
    let promise = new Promise((resolve, reject) => {
        let soap_body = '<trt:GetAudioEncoderConfigurations/>';
        let soap = this._createRequestSoap(soap_body);
        mOnvifSoap.requestCommand(this.oxaddr, 'GetAudioEncoderConfigurations', soap).then((result) => {
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
* Method: addAudioEncoderConfiguration(params[, callback])
* - params:
*   - ProfileToken       | String | required | a token of the Profile
*   - ConfigurationToken | String | required |  
*
* {
*   'ProfileToken': 'Profile1',
*   'ConfigurationToken': 'Conf1'
* }
*
* Not device I own does not support this command
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.addAudioEncoderConfiguration = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
            reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:AddAudioEncoderConfiguration>';
        soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body += '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        soap_body += '</trt:AddAudioEncoderConfiguration>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'AddAudioEncoderConfiguration', soap).then((result) => {
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
* Method: getCompatibleAudioEncoderConfigurations(params[, callback])
* - params:
*   - ProfileToken | String | required | a token of the profile
*
* {
*   'ProfileToken': 'Profile1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getCompatibleAudioEncoderConfigurations = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:GetCompatibleAudioEncoderConfigurations>';
        soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body += '</trt:GetCompatibleAudioEncoderConfigurations>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetCompatibleAudioEncoderConfigurations', soap).then((result) => {
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
* Method: getAudioEncoderConfigurationOptions(params[, callback])
* - params:
*   - ProfileToken       | String | optional | a token of the Profile
*   - ConfigurationToken | String | optional | 
*
* {
*   'ProfileToken': 'Profile1'
*   'ConfigurationToken': 'Conf1'
* }
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getAudioEncoderConfigurationOptions = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if('ProfileToken' in params) {
            if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
                reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
                return;
            }
        }

        if('ConfigurationToken' in params) {
            if(err_msg = mOnvifSoap.isInvalidValue(params['ConfigurationToken'], 'string')) {
                reject(new Error('The "ConfigurationToken" property was invalid: ' + err_msg));
                return;
            }
        }

        let soap_body = '';
        soap_body += '<trt:GetAudioEncoderConfigurationOptions>';
        if('ProfileToken' in params) {
            soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        }
        if('ConfigurationToken' in params) {
            soap_body += '<trt:ConfigurationToken>' + params['ConfigurationToken'] + '</trt:ConfigurationToken>';
        }
        soap_body += '</trt:GetAudioEncoderConfigurationOptions>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'GetAudioEncoderConfigurationOptions', soap).then((result) => {
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
* Method: startMulticastStreaming(params[, callback])
* - params:
*   - ProfileToken | String | required | a token of the Profile
*
* {
*   'ProfileToken': 'Profile1'
* }
*
* No device I own does not support this command
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.startMulticastStreaming = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:StartMulticastStreaming>';
        soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body += '</trt:StartMulticastStreaming>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'StartMulticastStreaming', soap).then((result) => {
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
* Method: stopMulticastStreaming(params[, callback])
* - params:
*   - ProfileToken | String | required | a token of the Profile
*
* {
*   'ProfileToken': 'Profile1'
* }
*
* No device I own does not support this command
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.stopMulticastStreaming = function(params, callback) {
    let promise = new Promise((resolve, reject) => {
        let err_msg = '';
        if(err_msg = mOnvifSoap.isInvalidValue(params, 'object')) {
            reject(new Error('The value of "params" was invalid: ' + err_msg));
            return;
        }

        if(err_msg = mOnvifSoap.isInvalidValue(params['ProfileToken'], 'string')) {
            reject(new Error('The "ProfileToken" property was invalid: ' + err_msg));
            return;
        }

        let soap_body = '';
        soap_body += '<trt:StopMulticastStreaming>';
        soap_body += '<trt:ProfileToken>' + params['ProfileToken'] + '</trt:ProfileToken>';
        soap_body += '</trt:StopMulticastStreaming>';
        let soap = this._createRequestSoap(soap_body);

        mOnvifSoap.requestCommand(this.oxaddr, 'StopMulticastStreaming', soap).then((result) => {
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
* Method: getSnapshotUri(profileToken)
* - profileToken | String | required | a token of the Profile
*
* Source:
*   46: GetSnapshotUri, https://www.onvif.org/ver10/media/wsdl/media.wsdl
* ---------------------------------------------------------------- */
OnvifServiceMedia.prototype.getSnapshotUri = function(profileToken) {
    let soapBody = '';
    soapBody += '<trt:GetSnapshotUri>';
    soapBody += `<trt:ProfileToken>${profileToken}</trt:ProfileToken>`;
    soapBody += '</trt:GetSnapshotUri>';

    return this.sendRequest('GetSnapshotUri', soapBody)
        .then(data => this.parseStreamUri(data['MediaUri']));
};

module.exports = OnvifServiceMedia;
