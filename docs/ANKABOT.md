# Atualização de status pelo AnkaBot

Configure no servidor um `ANKABOT_TOKEN` próprio, diferente do token do operador. Nunca inclua tokens em scripts versionados. Use HTTPS em produção e envie o token no cabeçalho `Authorization: Bearer <token>`.

## Localizar personagem

`GET /api/characters?search=Nome&serverId=123&page=1&pageSize=25`

A resposta contém `items`, `total`, `page`, `pageSize`. Cada personagem possui `id` UUID, `ankamaId`, `emailId`, `name`, `breedId`, `serverId` e `status`. Confirme conta e servidor antes de guardar o UUID. A consulta também aceita `ankamaId` e `emailId`.

## Informar status

`PATCH /api/characters/<UUID>/status`

```json
{"status":"E"}
```

Use `Content-Type: application/json`. C = criado e nunca carregado; E = carregado pelo AnkaBot; F = fluxo finalizado; B = banido. A API permite qualquer transição. Repetir o status atual é permitido; isso facilita reenviar uma atualização após timeout.

O AnkaBot deve informar E depois de carregar o personagem e F somente depois de concluir seu fluxo. Criar o personagem e conectar para confirmar sua criação não contam como carregamento pelo AnkaBot.

Sucesso HTTP 200 devolve o personagem atualizado. HTTP 400 indica entrada inválida; 401/403 indica credencial inválida ou ação não permitida; 404 indica UUID inexistente. Após erro de rede, reenvie a mesma atualização. Não altere automaticamente para F por timeout ou encerramento do bot.

O token do AnkaBot não permite revelar credenciais, comprar emails, cadastrar contas ou iniciar automação. Banir uma conta pelo operador marca todos os personagens B; reverter a conta não restaura seus status. Alterações individuais posteriores continuam livres.
