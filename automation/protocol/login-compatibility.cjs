'use strict';

const DofusTouchClient = require('./DofusTouchClient.cjs');

/**
 * Read-only protocol compatibility gate: only sends the normal anonymous login
 * handshake. Never sends credentials or claims a character-creation task.
 * When the server rejects the client version, operators must update the client
 * through a supported version rather than exhausting jobs in the queue.
 */
async function probeLoginCompatibility({createClient = () => new DofusTouchClient(), timeoutMs = 15000} = {}) {
    const client = createClient();
    let close = () => {};
    try {
        await client.connect(null, false, null);
        return await new Promise(resolve => {
            let finished = false;
            const finish = (ok, reason) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                close();
                resolve({ok, reason});
            };
            const hello = () => finish(true, null);
            const failed = msg => finish(false, String(msg?.reason || msg?.data?.reason || 'SERVER_REJECTED_CONNECTION').slice(0, 128));
            const closed = () => finish(false, 'LOGIN_CONNECTION_CLOSED');
            const networkError = () => finish(false, 'LOGIN_TRANSPORT_UNAVAILABLE');
            close = () => {
                client.off('HelloConnectMessage', hello);
                client.off('ConnectionFailedMessage', failed);
                client.off('close', closed);
                client.off('error', networkError);
            };
            const timer = setTimeout(() => finish(false, 'LOGIN_HANDSHAKE_TIMEOUT'), timeoutMs);
            client.on('HelloConnectMessage', hello);
            client.on('ConnectionFailedMessage', failed);
            client.on('close', closed);
            client.on('error', networkError);
            try {
                client.sendConnecting('login');
            } catch {
                finish(false, 'LOGIN_HANDSHAKE_SEND_FAILED');
            }
        });
    } catch {
        return {ok: false, reason: 'LOGIN_TRANSPORT_UNAVAILABLE'};
    } finally {
        close();
        client.disconnect('COMPATIBILITY_CHECK');
    }
}

module.exports = {probeLoginCompatibility};
