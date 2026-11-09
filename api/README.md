# API configuration

## Sincronização e progresso — tarefa 2.3

Migration **8**, heartbeat v1 opcional e endpoints GET/POST
`/api/services/ankabot/sessions/:sessionId/characters/:characterId/progress`.
Exigem Bearer ANKABOT_TOKEN e X-Ankabot-Session-Token. Atribuição, revisão e
updateId protegem propriedade, ordenação e repetição. A terceira conclusão
individual finaliza o grupo atomicamente. Recuperação preserva trios parcialmente
concluídos; F legado é recusado enquanto houver reserva do personagem.
Consulte [contratos JSON v1, exemplos e erros](src/character-progress/README.md).
Chamadas antigas de heartbeat sem corpo continuam válidas. Nenhuma interface,
script externo ou alteração em produção faz parte desta tarefa.

## Distribuição AnkaBot — tarefa 2.2

Migration **7** e endpoint
`POST /api/services/ankabot/sessions/:id/claim-groups`, com Bearer ANKABOT_TOKEN e
X-Ankabot-Session-Token. Corpo: `{"serverId":123,"idempotencyKey":"uuid"}`.
Recupera primeiro trios abandonados, depois forma novos, respeitando os limites
da sessão e da licença inteira. Usa resposta idempotente e protege contra replay
de atribuições liberadas. Expiração e encerramento agora abandonam grupos e
marcam integrantes elegíveis como P, preservando história e progresso.
Detalhes de resposta, concorrência e rollout em
[distribuição e recuperação](src/character-groups/README.md#distribuição-e-recuperação--tarefa-22).
A migration recusa alocações antigas acima do limite, exigindo reconciliação
explícita. Nenhuma alteração desta tarefa foi aplicada em produção.

## Grupos AnkaBot — tarefa 2.1

A migration **6** adiciona grupos, integrantes, eventos e conclusão separada de
personagens. Consulte [o domínio interno de grupos](src/character-groups/README.md).
Não há novos endpoints públicos de grupos nesta tarefa.

O contrato público de personagens inclui `completedAt: string | null` em UTC.
Status persistidos são C (criado), E (em progresso), B (banido) e P
(pendente/abandonado). PATCH status F permanece como comando legado: grava E e
preenche completedAt somente se ausente. POST manual com F também recebe essa
compatibilidade. GET com filtro status=F consulta personagens com completedAt
preenchido; as respostas não retornam status F. Trocas C/E/B/P não apagam conclusão.

**Orientação ao Antigravity:** adicionar P aos tipos/filtros e ler completedAt
separadamente do status. Exibir conclusão e status como informações independentes.
Não depender de status F nas respostas. A API mantém o comando legado F, mas a
interface não foi alterada nesta tarefa. Nenhum vínculo com Account CS1 foi criado:
esse termo corresponde às contas Ankama existentes.

## Sessões AnkaBot — tarefa 1.3

Migration **5** cria `ankabot_sessions`, com UUID estável, FK para licença,
hostname normalizado, PID Windows, hash da credencial, estado, heartbeat e datas
de criação/encerramento. Um índice único parcial impede duplicidade ativa por
licença, hostname e PID. O histórico é preservado: licença referenciada não pode
ser excluída (409, `ANKABOT_LICENSE_HAS_SESSIONS`). Não há grupos ou scripts externos.

| Método | Endpoint | Autenticação |
| --- | --- | --- |
| POST | `/api/services/ankabot/sessions` | Bearer `ANKABOT_TOKEN` + API key no corpo |
| PUT | `/api/services/ankabot/sessions/:id/heartbeat` | Bearer `ANKABOT_TOKEN` + cabeçalho da sessão |
| PUT | `/api/services/ankabot/sessions/:id/close` | Mesma combinação ou Bearer `OPERATOR_TOKEN` |
| GET | `/api/services/ankabot/sessions` | Bearer `OPERATOR_TOKEN` |
| GET | `/api/services/ankabot/sessions/:id` | Bearer `OPERATOR_TOKEN` |

Registro: `{"apiKey":"chave-externa-ficticia","hostname":"PC-01","pid":1234}`.
Hostname aceita 1–255 caracteres, é convertido para minúsculas e recebe trim;
espaços internos e controles são recusados. PID aceita inteiro de 1 a 4294967295.
A licença é validada localmente pelo fingerprint, sem chamada ao fornecedor.
Licença desconhecida retorna 401. Duplicidade ativa retorna 409, sem substituir
a sessão atual. Uma execução encerrada ou expirada permite novo registro e UUID.

Sucesso retorna 201 e `Cache-Control: no-store`, contendo os dados públicos e
`sessionToken`, credencial aleatória de 32 bytes, apresentada uma única vez.
Guarde-a em armazenamento privado persistente; apenas SHA-256 é salvo no banco.
Não envie o token em URLs. Se a resposta inicial for perdida, o operador pode
encerrar a sessão ou aguardar sua expiração; o token não pode ser recuperado.

Nos PUTs da instância envie `X-Ankabot-Session-Token: <sessionToken>`, além do
Bearer AnkaBot. Heartbeat e encerramento retornam 200 com dados públicos:
`id`, `licenseId`, `hostname`, `pid`, `status`, `lastHeartbeatAt`, `createdAt`,
`endedAt`. Credenciais e hashes não aparecem nas consultas ou logs. O operador
pode encerrar, mas não enviar heartbeat nem registrar como uma instância.

Credencial da sessão incorreta/ausente retorna 403; UUID inexistente 404;
entrada inválida 400. Heartbeat de sessão expirada/encerrada retorna 409 e não
a reativa. Encerramento repetido mantém estado e data originais. Encerrar uma
sessão expirada mantém `expired`. Alterar API key da licença não revoga sessões.

Consultas administrativas aceitam `licenseId`, `status` (`active`, `expired`,
`closed`), `page` e `pageSize` (padrão 25, máximo 100), com resposta
`{items,total,page,pageSize}`. As consultas calculam o estado efetivo mesmo antes
de o job materializar a expiração.

Expiração: **mais de 15 minutos** sem heartbeat, usando `statement_timestamp()`
do PostgreSQL e TIMESTAMPTZ, serializado em UTC. Exatamente 15 minutos é válido.
`endedAt` da expiração representa `lastHeartbeatAt + 15 minutos`; no encerramento
explícito representa o instante de encerramento. Histórico nunca é apagado.

O job executa na inicialização, após migrations, e agenda a próxima execução após
terminar. `ANKABOT_SESSION_EXPIRATION_INTERVAL_MS` tem padrão 60000 e aceita de
1000 a 3600000. O prazo de inatividade não muda com essa variável. Falhas são
registradas sem detalhes sensíveis e uma nova execução é agendada. O encerramento
da aplicação cancela o timer e aguarda a tarefa em andamento antes de fechar o
pool. Cada instância da API pode rodar o job: o UPDATE condicional é idempotente.

Registro e heartbeat verificam vencimento imediatamente. Locks transacionais e
atualizações condicionais serializam registro, heartbeat, encerramento e job.
O timer funciona somente enquanto a API estiver ativa; se o host suspender o
processo, o estado efetivo continua sendo calculado quando a API voltar.

Validação: `npm test`, `npm run build` e
`node --env-file=.env.test.local --import tsx --test test/*.test.ts`.
A integração real cobre limite temporal exato no mesmo statement do banco,
concorrência, permissões, histórico e regressão. Configure `TEST_DATABASE_URL`
somente para banco de teste; cada suíte usa schema próprio e remove ao finalizar.

## Licenças AnkaBot — tarefa 1.1

Migration **4** cria `ankabot_licenses`. As migrations anteriores são preservadas;
a aplicação ocorre na inicialização da API, pelo runner existente. Esta alteração
foi validada em schema isolado de teste, sem aplicação em produção.

Todos os endpoints exigem `Authorization: Bearer <OPERATOR_TOKEN>`. O token
restrito `ANKABOT_TOKEN` recebe 403 neste módulo.

| Método | Endpoint | Resultado |
| --- | --- | --- |
| POST | `/api/ankabot-licenses` | 201, licença cadastrada |
| GET | `/api/ankabot-licenses?page=1&pageSize=25` | 200, página de licenças |
| GET | `/api/ankabot-licenses/:id` | 200, licença |
| PATCH | `/api/ankabot-licenses/:id` | 200, licença atualizada |
| DELETE | `/api/ankabot-licenses/:id` | 204, sem corpo |

Cadastro: `{"apiKey":"exemplo-ficticio","maxCharacters":40}`. A capacidade é
opcional no cadastro, com padrão 40. PATCH aceita `apiKey`, `maxCharacters` ou ambos;
campos omitidos são preservados. Corpo vazio no PATCH e campos desconhecidos são
recusados. A API key aceita 1–4096 caracteres ASCII visíveis, sem espaços ou
controles; a comparação é exata e diferencia maiúsculas/minúsculas. Capacidade:
inteiro entre 1 e 2147483647. Paginação: página positiva e 1–100 itens por página.

Respostas públicas contêm somente `id`, `apiKeyMasked`, `maxCharacters`,
`createdAt` e `updatedAt`. Listagem: `{items,total,page,pageSize}`. Máscara fixa
`********` com os quatro últimos caracteres apenas para chaves de oito ou mais
caracteres. Não há endpoint para revelar a chave. Não coloque credenciais em URLs.

Entrada inválida retorna 400; autenticação inválida 401; acesso restrito 403;
registro inexistente 404; duplicidade 409 (`ANKABOT_LICENSE_DUPLICATE`). As chaves
são criptografadas com AES-256-GCM existente. O índice único usa HMAC-SHA-256 com
chave derivada de `CREDENTIALS_KEY` via HKDF e contexto exclusivo do módulo.
O fingerprint não é exposto. Mantenha essa chave estável: uma futura rotação exige
recriptografar as credenciais e recalcular os fingerprints na mesma migração.

`AnkabotLicenseRepository.findById` e `findByFingerprint` preparam a resolução
interna de capacidade. Não há contagem fictícia de uso nem vínculo com personagens.
Nenhuma chamada ao AnkaBot é feita; cadastro não confirma validade comercial.

Testes: `npm test`, `npm run build` e, para executar também integração real,
`node --env-file=.env.test.local --import tsx --test test/*.test.ts`.
O arquivo local deve conter `TEST_DATABASE_URL` de um banco de teste. Os testes
criam schemas aleatórios e os removem ao terminar, sem usar tabelas de produção.

Set DATABASE_URL and PORT as documented in the root README. To enable application routes, configure OPERATOR_TOKEN (32+ characters) and CREDENTIALS_KEY (32 random bytes encoded as Base64). Store the key securely: changing it makes existing encrypted credentials unreadable. ANKABOT_TOKEN is a distinct 32+ character token limited to GET /api/characters, GET /api/characters/:id and PATCH /api/characters/:id/status. APIMAIL_TOKEN enables provider purchases and balance queries.

All application routes use /api. Health endpoints remain /health and /ready. Migrations run under an advisory transaction lock at startup when application credentials are configured. Configuration without application credentials exposes health endpoints only.

CHARACTER_OPTIONS_JSON contains {"breeds":[{"id":1,"name":"Runtime breed name"}],"servers":[{"id":123,"name":"Runtime server name"}]}. These IDs are illustrative, not a verified catalog. Populate this setting from the compatible Dofus Touch runtime. Empty arrays deliberately offer no automatic character choices.

Run npm test and npm run build. For real PostgreSQL constraints and race tests, set TEST_DATABASE_URL to an isolated test database and run node --env-file=.env.test.local --import tsx --test test/accounts.integration.test.ts. The test creates and drops its own schema; it requires an unpooled endpoint for session search_path isolation (Neon pooled hostname is converted automatically).
