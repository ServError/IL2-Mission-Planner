//import confJson from "./dist/conf.json";
import util from "./util.js";
import conf from '../../dist/conf.json' with { type: "json" };

const webdis = (function() {
    //var util = require('./util.js');

    const
        WEBDIS_HOST = conf.webdisUrl
    ;

    return {

        _authHeaders: function() {
            try {
                if (conf && conf.webdisUser && conf.webdisPass) {
                    return { 'Authorization': 'Basic ' + btoa(conf.webdisUser + ':' + conf.webdisPass) };
                }
            } catch (e) {
                // ignore
            }
            return {};
        },

        // active subscription tracking: channel -> { lastSeq, params, running }
        _subscriptions: {},

        scripts: {
            getChannel: '',
            publishState: '',
            newStream: '',
            getReconnect: ''
        },

        _fetchJson: async function(url, timeoutMs = 5000) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const resp = await fetch(url, { signal: controller.signal, headers: this._authHeaders() });
                clearTimeout(id);
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return await resp.json();
            } catch (e) {
                clearTimeout(id);
                throw e;
            }
        },

        init: async function(timeoutMs = 5000) {
            var requiredKeys = Object.keys(this.scripts);
            try {
                var url = this._buildHmgetUrl('scripts', requiredKeys);
                var json = await this._fetchJson(url, timeoutMs);
                var response = json.HMGET || [];
                if (response.length !== requiredKeys.length) {
                    return false;
                }
                for (var i = 0; i < response.length; i++) {
                    this.scripts[requiredKeys[i]] = response[i];
                }
                return true;
            } catch (e) {
                return false;
            }
        },

        publish: function(stream, password, code, state) {
            var safeState = String(state).replace(/\//g, '%2f').replace(/\./g, '%2e');
            var url = this._buildEvalshaUrl(this.scripts.publishState, [stream, password, code, safeState]);
            var self = this;
            (async function(){
                try {
                    var resp = await util.fetchText(url);
                    if (resp.status === 200) {
                        var responseBody = JSON.parse(resp.responseText).EVALSHA;
                        if (responseBody[0] !== 'SUCCESS') {
                            self._errorHandler();
                        }
                    } else {
                        self._errorHandler();
                    }
                } catch(e) {
                    self._errorHandler();
                }
            })();
        },

        hmget: async function(key, fields) {
            var url = this._buildHmgetUrl(key, fields);
            var response = await util.fetchTextRaw(url);
            return JSON.parse(response.responseText).HMGET;
        },

        subscribe: function(channel, opts) {
            // opts: { stream, password, code }
            var url = this._buildSubscribeUrl(channel);
            var self = this;

            // initialize or update subscription record
            if (!this._subscriptions[channel]) {
                this._subscriptions[channel] = { lastSeq: null, params: opts || null, running: true };
            } else if (opts) {
                this._subscriptions[channel].params = opts;
                this._subscriptions[channel].running = true;
            }
            const subEntry = this._subscriptions[channel];

            (async function(){
                try {
                    const resp = await fetch(url, { headers: self._authHeaders() });
                    const reader = resp.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    const MAX_BUFFER = 1024 * 1024; // 1MB safety cap
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });

                        // Extract complete JSON objects by tracking brace depth.
                        while (true) {
                            const start = buffer.indexOf('{');
                            if (start === -1) {
                                if (buffer.length > 1024) buffer = buffer.slice(-1024);
                                break;
                            }

                            let depth = 0;
                            let inString = false;
                            let escape = false;
                            let end = -1;
                            for (let j = start; j < buffer.length; j++) {
                                const ch = buffer[j];
                                if (inString) {
                                    if (escape) {
                                        escape = false;
                                    } else if (ch === '\\') {
                                        escape = true;
                                    } else if (ch === '"') {
                                        inString = false;
                                    }
                                } else {
                                    if (ch === '"') {
                                        inString = true;
                                    } else if (ch === '{') {
                                        depth++;
                                    } else if (ch === '}') {
                                        depth--;
                                        if (depth === 0) { end = j + 1; break; }
                                    }
                                }
                            }

                            if (end === -1) break; // need more data

                            const chunkStr = buffer.slice(start, end);
                            try {
                                const chunk = JSON.parse(chunkStr);
                                if (!chunk || typeof chunk !== 'object') {
                                    self._errorHandler();
                                } else {
                                    const payload = chunk.SUBSCRIBE && chunk.SUBSCRIBE[2];
                                    var newState = payload;

                                    // extract sequence if present
                                    try {
                                        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
                                        if (parsed && typeof parsed === 'object' && parsed.seq !== undefined) {
                                            subEntry.lastSeq = parsed.seq;
                                        }
                                    } catch (e) {
                                        // ignore non-JSON payloads
                                    }

                                    var evt = new CustomEvent('il2:streamupdate', {detail: newState});
                                    window.dispatchEvent(evt);
                                }
                            } catch (e) {
                                self._errorHandler();
                            }

                            buffer = buffer.slice(end);
                        }

                        if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
                    }
                } catch(e) {
                    self._errorHandler();

                    // attempt replay using server-side reconnect script if we have params
                    try {
                        const params = subEntry && subEntry.params;
                        if (params && params.stream) {
                            const resp = await self.getStreamReconnect(params.stream, params.password, params.code);
                            if (resp && resp[0] === 'SUCCESS') {
                                const replayState = resp[2];
                                var evt = new CustomEvent('il2:streamupdate', {detail: replayState});
                                window.dispatchEvent(evt);
                            }
                        }
                    } catch (e2) {
                        // ignore
                    }

                    // re-subscribe after a short backoff, if still desired
                    if (subEntry && subEntry.running) {
                        setTimeout(function(){ self.subscribe(channel, subEntry.params); }, 1000);
                    }
                }
            })();
        },

        unsubscribe: function(channel) {
            var url = this._buildUnsubscribeUrl(channel);
            (async function(){
                    try { await util.fetchText(url); } catch(e) {}
            })();
        },

        getStreamInfo: async function(stream, password) {
            var url = this._buildEvalshaUrl(this.scripts.getChannel, [stream, password]);
            var response = await util.fetchTextRaw(url);
            return JSON.parse(response.responseText).EVALSHA;
        },

        getStreamReconnect: async function(stream, password, code) {
            var url = this._buildEvalshaUrl(this.scripts.getReconnect, [stream, password, code]);
            var response = await util.fetchTextRaw(url);
            return JSON.parse(response.responseText).EVALSHA;
        },

        startStream: async function(name, password, code, state) {
            var url = this._buildEvalshaUrl(this.scripts.newStream, [name, password, code, state]);
            var response = await util.fetchTextRaw(url);
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
