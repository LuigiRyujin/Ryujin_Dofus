'use strict';

/** Every listener is installed before connecting; all are removed on resolution or timeout. */
function authenticateLoginServer({client, accountId, gameToken, timeoutMs = 60000, onEvent = () => {}}) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const handlers = [];
    let timer;
    const listen = (event, handler) => {
      client.on(event, handler);
      handlers.push([event, handler]);
    };
    const finish = (err, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const [event, handler] of handlers) client.off(event, handler);
      if (err) reject(err);
      else resolve(result);
    };
    listen('HelloConnectMessage', message => {
      try {
        onEvent('hello');
        client.sendLogin(accountId, gameToken, message.salt, message.key);
      } catch {
        finish(new Error('login_handshake_send_failed'));
      }
    });
    listen('NicknameRegistrationMessage', () => {
      try {
        const generatedNick = 'Touch' + Math.floor(Math.random() * 89999 + 10000);
        onEvent('nickname');
        client.sendMessage('NicknameChoiceRequestMessage', {nickname: generatedNick});
      } catch {
        finish(new Error('login_nickname_registration_failed'));
      }
    });
    listen('IdentificationSuccessMessage', () => onEvent('identified'));
    listen('IdentificationFailedMessage', message => finish(new Error('Falha de identificação Ankama: Código '+String(message?.reason ?? 'Desconhecido'))));
    listen('ConnectionFailedMessage', message => finish(new Error('Login Server recusou conexão: '+String(message?.reason ?? 'desconhecido'))));
    listen('ServersListMessage', message => finish(null, {servers: message?.servers || []}));
    listen('close', () => finish(new Error('Login Server encerrou conexão')));
    listen('error', () => finish(new Error('Login Server transport error')));
    timer = setTimeout(() => finish(new Error('Timeout aguardando Login Server')), timeoutMs);
    try {
      client.sendConnecting('login');
    } catch {
      finish(new Error('login_handshake_send_failed'));
    }
  });
}

module.exports = {authenticateLoginServer};
