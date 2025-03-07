//import confJson from "./dist/conf.json";
import util from "./util.js";
import conf from '../../dist/conf.json' with { type: "json" };

const webdis = (function() {
    //var util = require('./util.js');

    const
        WEBDIS_HOST = conf.webdisUrl
    ;

    return {

        scripts: {
            getChannel: '',
            publishState: '',
            newStream: '',
            getReconnect: ''
        },

        init: function() {
            var requiredKeys = Object.keys(this.scripts);
            var response = this.hmget('scripts', requiredKeys);
            if (response.length !== requiredKeys.length) {
                return false;
            }
            for (var i = 0; i < response.length; i++) {
                this.scripts[requiredKeys[i]] = response[i];
            }
            return true;
        },

        publish: function(stream, password, code, state) {
            var url = this._buildEvalshaUrl(this.scripts.publishState, [stream, password, code, state]);
            var xhr = util.buildGetXhr(url, function(){
                if (xhr.readyState === 4) {
                    var responseBody = JSON.parse(xhr.responseText).EVALSHA;
                    if (responseBody[0] !== 'SUCCESS') {
                        this._errorHandler();
                    }
                }
            });
        },

        hmget: function(key, fields) {
            var url = this._buildHmgetUrl(key, fields);
            var response = util.buildSyncGetXhr(url);
            return JSON.parse(response.responseText).HMGET;
        },

        subscribe: function(channel) {
            var prev_length = 0;
            var url = this._buildSubscribeUrl(channel);
            var xhr = util.buildGetXhr(url, function() {
                if (xhr.readyState === 3) {
                    var response = xhr.responseText;
                    try {
                        var chunk = JSON.parse(response.slice(prev_length));
                        if (!chunk || typeof chunk !== 'object') {
                            this._errorHandler();
                        }
                    } catch(e) {
                        this._errorHandler();
                    }
                    var newState = chunk.SUBSCRIBE[2];
                    prev_length = response.length;
                    var evt = new CustomEvent('il2:streamupdate', {detail: newState});
                    window.dispatchEvent(evt);
                }
            });
        },

        unsubscribe: function(channel) {
            var url = this._buildUnsubscribeUrl(channel);
            util.buildGetXhr(url, function(){});
        },

        getStreamList: function() {
            var url = this._buildKeysUrl('stream:*');
            var response = util.buildSyncGetXhr(url);
            return JSON.parse(response.responseText).KEYS;
        },

        getStreamInfo: function(stream, password) {
            var url = this._buildEvalshaUrl(this.scripts.getChannel, [stream, password]);
            var response = util.buildSyncGetXhr(url);
            return JSON.parse(response.responseText).EVALSHA;
        },

        getStreamReconnect: function(stream, password, code) {
            var url = this._buildEvalshaUrl(this.scripts.getReconnect, [stream, password, code]);
            var response = util.buildSyncGetXhr(url);
            return JSON.parse(response.responseText).EVALSHA;
        },

        startStream: function(name, password, code, state) {
            var url = this._buildEvalshaUrl(this.scripts.newStream, [name, password, code, state]);
            var response = util.buildSyncGetXhr(url);
            return JSON.parse(response.responseText).EVALSHA;
        },

        _buildEvalshaUrl: function(hash, args) {
            var url = WEBDIS_HOST + '/EVALSHA/' + hash + '/0';
            for (var i = 0; i < args.length; i++) {
                url += ('/' + args[i]);
            }
            return url;
        },

        _buildHmgetUrl: function(key, fields) {
            var url = WEBDIS_HOST + '/HMGET/' + key;
            for (var i = 0; i < fields.length; i++) {
                url += ('/' + fields[i]);
            }
            return url;
        },

        _buildKeysUrl: function(pattern) {
            return WEBDIS_HOST + '/KEYS/' + pattern;
        },

        _buildSubscribeUrl: function(channel) {
            return WEBDIS_HOST + '/SUBSCRIBE/' + channel;
        },

        _buildPublishUrl: function(channel, value) {
            return WEBDIS_HOST + '/PUBLISH/' + channel + '/' + value;
        },

        _buildUnsubscribeUrl: function(channel, value) {
            return WEBDIS_HOST + '/UNSUBSCRIBE/' + channel;
        },

        _errorHandler: function() {
            var evt = new CustomEvent('il2:streamerror');
            window.dispatchEvent(evt);
        }
    };
})();

export default webdis;
