/**
 * DofusMap/character-worker/protocol/DofusTouchClient.js
 * Cliente WebSocket de alta performance para comunicaÃ§Ã£o de protocolo nativo com Dofus Touch (Primus).
 */

const EventEmitter = require('events');
const path = require('path');
let WebSocket = null;
const wsPaths = ['ws'];
for (const p of wsPaths) {
    try {
        WebSocket = require(p);
        break;
    } catch (e) {}
}
if (!WebSocket) {
    throw new Error('[DofusTouchClient] MÃ³dulo "ws" nÃ£o encontrado. Instale com npm install ws ou execute no diretÃ³rio do DofusMap.');
}

let HttpsProxyAgent = null;
const proxyAgentPaths = ['https-proxy-agent'];
for (const p of proxyAgentPaths) {
    try {
        const mod = require(p);
        HttpsProxyAgent = mod.HttpsProxyAgent || mod;
        break;
    } catch (e) {}
}

const DEFAULT_CONFIG = {
    loginUrl: 'wss://dt-proxy-production-login.ankama-games.com/primus/',
    language: 'fr',
    client: 'android',
    appVersion: '3.14.3',
    buildVersion: '1.74.9',
    origin: 'https://www.dofus-touch.com',
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
};

class DofusTouchClient extends EventEmitter {
    static setOfficialBuildVersion(version) {
        if (!/^\d+\.\d+\.\d+$/.test(String(version))) throw new Error('invalid_official_build');
        DEFAULT_CONFIG.buildVersion = String(version);
    }

    constructor(options = {}) {
        super();
        this.options = { ...DEFAULT_CONFIG, ...options };
        this.ws = null;
        this.isConnected = false;
        this.isGameServer = false;
        this.proxy = null;
        this.lastReceivedMessage = null;
        this.pingInterval = null;
    }

    /**
     * Conecta ao servidor (Login ou Game), com suporte a Proxy opcional
     */
    async connect(url = null, isGame = false, proxy = null) {
        let rawUrl = url || this.options.loginUrl;
        this.isGameServer = isGame;
        this.proxy = proxy || null;

        if (this.ws) {
            this.disconnect('SWITCHING_SERVERS');
        }

        const AuthManager = require('./AuthManager.cjs');
        const proxyInfo = AuthManager.parseProxy(this.proxy);
        let wsAgent = null;
        if (proxyInfo && HttpsProxyAgent) {
            wsAgent = new HttpsProxyAgent(proxyInfo.url);
        }

        // Normaliza para wss://.../primus/
        let baseDomain = rawUrl.split('/primus')[0].replace(/\/$/, '');
        const httpBaseUrl = baseDomain.replace('wss://', 'https://').replace('ws://', 'http://');
        const wssBaseUrl = baseDomain.replace('https://', 'wss://').replace('http://', 'ws://');
        let targetUrl = `${wssBaseUrl}/primus/`;

        // Garante suporte a STICKER (Sticky Session do Primus Ankama)
        if (!rawUrl.includes('STICKER=')) {
            try {
                const cfgRes = await AuthManager.requestHttp(`${httpBaseUrl}/config.json`, {}, this.proxy);
                if (cfgRes.ok) {
                    const cfg = await cfgRes.json();
                    if (cfg && cfg.sessionId) {
                        targetUrl = `${targetUrl}?STICKER=${encodeURIComponent(cfg.sessionId)}`;
                    }
                }
            } catch (e) {
                // Fallback continua com targetUrl original
            }
        } else {
            targetUrl = rawUrl;
        }

        return new Promise((resolve, reject) => {
            try {
                const wsOptions = {
                    headers: {
                        'User-Agent': this.options.userAgent,
                        'Origin': this.options.origin
                    },
                    handshakeTimeout: 15000
                };
                if (wsAgent) {
                    wsOptions.agent = wsAgent;
                }

                this.ws = new WebSocket(targetUrl, wsOptions);

                this.ws.on('open', () => {
                    this.isConnected = true;
                    this._startPing();
                    this.emit('open', { isGame: this.isGameServer, url: targetUrl, proxied: !!wsAgent });
                    resolve();
                });

                this.ws.on('message', (raw) => {
                    this._handleRawMessage(raw);
                });

                this.ws.on('close', (code, reason) => {
                    this._stopPing();
                    this.isConnected = false;
                    this.emit('close', { code, reason: reason ? reason.toString() : '' });
                });

                this.ws.on('error', (err) => {
                    if (this.listenerCount('error') > 0) {
                        this.emit('error', err);
                    }
                    if (!this.isConnected) {
                        reject(err);
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Envia handshake inicial de conexÃ£o Primus
     */
    sendConnecting(serverData = 'login') {
        const payload = {
            language: this.options.language,
            server: serverData,
            client: this.options.client,
            appVersion: this.options.appVersion,
            buildVersion: this.options.buildVersion
        };
        this.sendCall('connecting', payload);
    }

    /**
     * Envia credenciais de login
     */
    sendLogin(username, token, salt, key) {
        const payload = {
            username: username ? String(username) : null,
            token: token || null,
            forcedAccount: null,
            salt: salt || null,
            key: key || null
        };
        this.sendCall('login', payload);
    }

    /**
     * Envia mensagem de jogo encapsulada no Primus
     */
    sendMessage(type, data = {}) {
        this.sendCall('sendMessage', {
            type,
            data
        });
    }

    /**
     * Envia chamada no formato Primus oficial do Dofus Touch (JSON Puro)
     */
    sendCall(call, data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error(`[DofusTouchClient] NÃ£o conectado ao enviar chamada: ${call}`);
        }
        const obj = { call, data };
        const text = JSON.stringify(obj);
        this.ws.send(text);
        this.emit('send', { call, data });
    }

    /**
     * Processa mensagem crua recebida do WebSocket
     */
    _handleRawMessage(raw) {
        try {
            const str = raw.toString();
            if (!str) return;

            // Heartbeat Primus: "primus::ping::<timestamp>"
            if (str.startsWith('"primus::ping::')) {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(str.replace('ping', 'pong'));
                }
                return;
            }

            if (str === '2' || str === '3') {
                return;
            }

            const parsed = JSON.parse(str);
            const msgType = parsed._messageType || (parsed.data && parsed.data.type) || parsed.type || parsed.call;

            if (msgType) {
                this.lastReceivedMessage = msgType;
                this.emit(msgType, parsed);
                this.emit('message', { type: msgType, payload: parsed });
            } else {
                this.emit('raw_json', parsed);
            }
        } catch (err) {
            this.emit('parse_error', { err: err.message, raw: raw.toString().substring(0, 100) });
        }
    }

    /**
     * UtilitÃ¡rios de cÃ¡lculo de cores indexadas e cosmÃ©ticos oficiais do Dofus Touch
     */
    static parseIndexedColor(e) {
        const t = (251658240 & e) >> 24;
        const i = (16711680 & e) >> 16;
        const n = (65280 & e) >> 8;
        const o = 255 & e;
        return { index: t, color: { r: i, g: n, b: o } };
    }

    static getIndexedColor(e, t, i, n) {
        let o = 0;
        o |= (15 & e) << 24;
        o |= (255 & t) << 16;
        o |= (255 & i) << 8;
        o |= 255 & n;
        return o;
    }

    static computeIndexedColors(baseColors) {
        const result = [];
        for (let r = 0; r < baseColors.length; r++) {
            const col = DofusTouchClient.parseIndexedColor(baseColors[r]).color;
            result.push(DofusTouchClient.getIndexedColor(r + 1, col.r, col.g, col.b));
        }
        return result;
    }

    static computeCosmeticId(breedId, sex = false, headOrder = 0) {
        // breedId (1..18), sex (false = male = 0, true = female = 1), headOrder (0..7)
        const gender = sex ? 1 : 0;
        return 1 + (breedId - 1) * 16 + gender * 8 + headOrder;
    }

    static async fetchBreedColors(breedId, sex = false, proxy = null) {
        try {
            const AuthManager = require('./AuthManager.cjs');
            const res = await AuthManager.requestHttp('https://dt-proxy-production-login.ankama-games.com/data/map?lang=fr&v=1.73.12', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ class: 'Breeds' })
            }, proxy);
            if (res.ok) {
                const data = await res.json();
                const b = data[String(breedId)];
                if (b) {
                    const rawCols = sex ? b.femaleColors : b.maleColors;
                    if (rawCols && rawCols.length >= 5) {
                        return DofusTouchClient.computeIndexedColors(rawCols);
                    }
                }
            }
        } catch (e) {}

        // Fallback default
        return [ 33542780, 50307866, 60141352, 72773666, 100657218 ];
    }

    _startPing() {
        this._stopPing();
        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.sendMessage('BasicPingMessage', { quiet: true });
                } catch (e) {
                    // Ignora
                }
            }
        }, 15000);
    }

    _stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    disconnect(reason = 'CLIENT_CLOSING') {
        this._stopPing();
        if (this.ws) {
            try {
                this.ws.close(1000, reason);
            } catch (e) {
                // Ignora
            }
            this.ws = null;
        }
        this.isConnected = false;
    }
}

module.exports = DofusTouchClient;
