# RyujinDofus

## Contas Ankama e personagens

O Desktop possui cadastros separados para emails, contas Ankama e personagens.
Cada email pode pertencer a uma conta; uma conta pode possuir vários personagens.
Banir a conta também bane seus personagens. Reverter a conta não restaura os
status anteriores dos personagens.

A API usa o prefixo `/api`. Configure `OPERATOR_TOKEN`, `CREDENTIALS_KEY` (32 bytes
em base64) e, para integração restrita, `ANKABOT_TOKEN` distinto. Consulte
[o contrato AnkaBot](docs/ANKABOT.md), [a configuração da API](api/README.md) e
[o plano](docs/superpowers/plans/2026-11-05-ankama-characters.md).

As operações de criação são persistidas na API e executadas por um worker local,
desativado por padrão. Configuração e limitações estão em
[automação local](automation/README.md). Testes automatizados não demonstram
compatibilidade com a versão atual do jogo; a validação real é separada.

API em TypeScript, Fastify e PostgreSQL, com Node.js 24 LTS.

## Executar localmente

Na pasta `api`, execute `npm ci`, copie `.env.example` para `.env` e preencha
`DATABASE_URL` com a URL de conexão pooled do Neon. Execute `npm run dev`.
A API escuta em `http://localhost:3000`. A conexão PostgreSQL exige TLS com
verificação do certificado. Arquivos `.env` são ignorados pelo Git.

Para validar, execute `npm test` e `npm run build`. Para rodar o código compilado,
execute `npm start`.

## Rotas

| Rota | Resultado |
| --- | --- |
| `GET /health` | HTTP 200 e `{"status":"ok"}` enquanto o servidor responde |
| `GET /ready` | Executa `SELECT 1`, retorna HTTP 200 e `{"status":"ok"}` ou HTTP 503 e `{"status":"unavailable"}` |

A verificação de prontidão tem prazo total de cinco segundos. A conexão tem limite
de cinco segundos; consultas PostgreSQL têm limite de 30 segundos, com timeout do
cliente de 35 segundos, permitindo espera transacional por capacidade de licença.
O pool mantém no máximo cinco conexões.
`SIGTERM` e `SIGINT` encerram o servidor e o pool de conexões.

## Publicação no Render

- Serviço `ryujindofus-api`, plano Free, região Virginia, branch `main`.
- Diretório raiz `api`.
- Build `npm ci && npm run build` e início `npm start`.
- Health check `/health`.
- Variáveis `NODE_VERSION=24.18.0`, `NODE_ENV=production`, `NPM_CONFIG_INCLUDE=dev`
  (para instalar o TypeScript durante o build) e `DATABASE_URL` secreta.
- O Render fornece `PORT` e HTTPS. A API escuta em `0.0.0.0`.
- Neon `RyujinDofus`, branch `production`, banco `neondb`, região São Paulo.

O Render Free pode suspender o serviço por inatividade. A primeira requisição
após a suspensão pode demorar. Consulte `/ready` para verificar também o Neon.
