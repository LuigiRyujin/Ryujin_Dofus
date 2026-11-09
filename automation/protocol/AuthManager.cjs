/**
 * DofusMap/character-worker/protocol/AuthManager.js
 * Gerenciador de AutenticaÃ§Ã£o WebAuth / HAAPI da Ankama para Dofus Touch.
 * Suporta PKCE (RFC 7636), criaÃ§Ã£o de contas Guest, validaÃ§Ã£o de tokens e login oficial.
 */

const crypto = require('crypto');
const http = require('http');
const https = require('https');
const path = require('path');

let HttpsProxyAgent = null;
const proxyAgentPaths = ['https-proxy-agent'];
for (const p of proxyAgentPaths) {
    try {
        const mod = require(p);
        HttpsProxyAgent = mod.HttpsProxyAgent || mod;
        break;
    } catch (e) {}
}

class AuthManager {
    constructor(options = {}) {
        this.authUrl = options.authUrl || 'https://auth.ankama.com/';
        this.clientId = options.clientId || 18;
        this.redirectUri = options.redirectUri || 'dofustouch://authorized';
        this.referer = options.referer || 'https://www.dofus-touch.com/';
        this.userAgent = options.userAgent || 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';
    }

    /**
     * Normaliza e decodifica qualquer formato de string de proxy:
     * - http://user:pass@host:port
     * - host:port:user:pass
     * - http://host:port ou host:port
     */
    static parseProxy(proxyStr) {
        if (!proxyStr || typeof proxyStr !== 'string') return null;
        let s = proxyStr.trim();
        if (!s) return null;

        const colonParts = s.split(':');
        if (colonParts.length === 4 && !s.includes('@') && !s.includes('//')) {
            const [host, port, user, pass] = colonParts;
            return {
                url: `http://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`,
                server: `http://${host}:${port}`,
                auth: { username: user, password: pass },
                host,
                port: Number(port)
            };
        }

        if (!s.startsWith('http://') && !s.startsWith('https://') && !s.startsWith('socks5://') && !s.startsWith('socks4://')) {
            s = 'http://' + s;
        }

        try {
            const parsed = new URL(s);
            let auth = null;
            if (parsed.username || parsed.password) {
                auth = {
                    username: decodeURIComponent(parsed.username),
                    password: decodeURIComponent(parsed.password)
                };
            }
            const cleanServer = `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol.startsWith('https') ? 443 : 80)}`;
            return {
                url: s,
                server: cleanServer,
                auth,
                host: parsed.hostname,
                port: Number(parsed.port) || 80
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Executa requisiÃ§Ãµes HTTP/HTTPS roteadas via proxy se informado, ou diretas
     */
    static async requestHttp(urlStr, options = {}, proxy = null) {
        const proxyInfo = AuthManager.parseProxy(proxy);
        if (!proxyInfo || !HttpsProxyAgent) {
            return await fetch(urlStr, options);
        }

        return new Promise((resolve, reject) => {
            try {
                const urlObj = new URL(urlStr);
                const isHttps = urlObj.protocol === 'https:';
                const lib = isHttps ? https : http;
                const agent = new HttpsProxyAgent(proxyInfo.url);

                const headers = options.headers || {};
                const method = options.method || 'GET';
                const body = options.body || null;

                const req = lib.request(urlObj, {
                    method,
                    headers,
                    agent,
                    timeout: options.timeout || 15000
                }, (res) => {
                    const chunks = [];
                    res.on('data', d => chunks.push(d));
                    res.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        const text = buffer.toString('utf8');
                        resolve({
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            text: async () => text,
                            json: async () => JSON.parse(text),
                            headers: res.headers
                        });
                    });
                });

                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error(`Timeout na requisiÃ§Ã£o para ${urlStr}`));
                });

                if (body) {
                    req.write(body);
                }
                req.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Codifica string para o padrÃ£o base64url sem padding
     */
    static base64Url(str) {
        return str
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Gera o Code Verifier para PKCE
     */
    generateCodeVerifier() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        const length = Math.floor(Math.random() * 40) + 50; // Entre 50 e 90 chars
        let randomStr = '';
        for (let i = 0; i < length; i++) {
            randomStr += chars[Math.floor(Math.random() * chars.length)];
        }
        return AuthManager.base64Url(Buffer.from(randomStr).toString('base64'));
    }

    /**
     * Gera o Code Challenge a partir do Verifier (SHA-256)
     */
    generateCodeChallenge(verifier) {
        const hash = crypto.createHash('sha256').update(verifier).digest('base64');
        return AuthManager.base64Url(hash);
    }

    /**
     * Cria um Token de Convidado instantÃ¢neo no endpoint oficial da Ankama
     */
    async createGuestToken(proxy = null) {
        const url = `${this.authUrl.replace(/\/$/, '')}/token/create-guest`;
        const res = await AuthManager.requestHttp(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'User-Agent': this.userAgent,
                'Referer': this.referer
            },
            body: new URLSearchParams({
                client_id: String(this.clientId)
            }).toString()
        }, proxy);

        if (!res.ok) {
            throw new Error(`Falha ao criar guest token Ankama: HTTP ${res.status}`);
        }

        const data = await res.json();
        return data.token;
    }

    /**
     * Troca o Authorization Code pelo Access Token e Refresh Token
     */
    async exchangeCodeForToken(code, codeVerifier, proxy = null) {
        const url = `${this.authUrl.replace(/\/$/, '')}/token`;
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: String(this.clientId),
            code: code,
            code_verifier: codeVerifier,
            redirect_uri: this.redirectUri
        });

        const res = await AuthManager.requestHttp(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'User-Agent': this.userAgent,
                'Referer': this.referer
            },
            body: params.toString()
        }, proxy);

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Falha ao trocar cÃ³digo por token: HTTP ${res.status} - ${errText}`);
        }

        return await res.json(); // { access_token, refresh_token, guest_credentials }
    }

    /**
     * Consulta informaÃ§Ãµes da conta no HAAPI usando a ApiKey (access_token)
     */
    async getAccountInfo(haapiKey, proxy = null) {
        const res = await AuthManager.requestHttp('https://haapi.ankama.com/json/Ankama/v5/Account/Account', {
            headers: {
                'APIKEY': haapiKey,
                'Accept': 'application/json'
            }
        }, proxy);
        if (!res.ok) {
            throw new Error(`Falha ao obter dados da conta no HAAPI: HTTP ${res.status}`);
        }
        return await res.json();
    }

    /**
     * Gera um Game Token oficial de sessÃ£o para Dofus Touch (game = 18)
     */
    async createGameToken(haapiKey, proxy = null) {
        const res = await AuthManager.requestHttp('https://haapi.ankama.com/json/Ankama/v5/Account/CreateToken?game=18', {
            headers: {
                'APIKEY': haapiKey,
                'Accept': 'application/json'
            }
        }, proxy);
        if (!res.ok) {
            throw new Error(`Falha ao gerar Game Token no HAAPI: HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.token;
    }

    /**
     * Autentica via credenciais da Ankama (login e senha)
     */
}
module.exports = AuthManager;
