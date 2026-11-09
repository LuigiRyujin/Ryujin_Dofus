# Grupos AnkaBot — tarefa 2.1

O domínio base da tarefa 2.1 é interno. A tarefa 2.2 adiciona o endpoint de claim
e a integração com o ciclo de vida de sessões, descritos abaixo.
Na tarefa 2.3, recuperação também aceita trios parcialmente concluídos e o claim
inclui progresso individual; veja [o contrato de progresso](../character-progress/README.md).

```ts
const groups = new CharacterGroupService(new CharacterGroupRepository(pool));
const group = await groups.createGroup([character1, character2, character3]);
await groups.activateGroup(group.id, sessionId);
```

Operações: `createGroup`, `addMember`, `removeMember`, `activateGroup`,
`abandonGroup`, `resumeGroup`, `awaitRestart`, `completeGroup`, `getGroup`,
`getEvents`, `listGroups`. Os IDs são UUIDs e os filtros de listagem são
`status`, `sessionId`, `page` e `pageSize` (padrão 25, máximo 100).

## Dados e invariantes

Migration 6 adiciona `characters.completed_at`, converte F para E e usa o
`updated_at` antigo como aproximação da conclusão histórica. Status persistidos:
C, E, B e P. Nenhum vínculo de conta ou email é alterado.

`character_groups` possui UUID, estado, sessão/slot correntes e datas.
`group_members` referencia personagens, com reserva exclusiva por personagem.
`removed_at` distingue remoção durante formação de liberação por conclusão:
ao concluir, o integrante continua pertencendo ao grupo, mas sua reserva é
liberada. A conclusão impede sua reutilização pelo domínio. Reassociar durante
formação é permitido após remoção; eventos preservam cada associação anterior.

`group_events` guarda criação, mudanças de composição e transições com sessões
anterior/nova. Não apague registros históricos. As FKs usam exclusão restrita.

O trio exige classes e contas distintas no mesmo servidor. Formação aceita de
zero a três integrantes; active, awaiting_restart e completed exigem três.
Abandoned incompleto é preservado e não pode ser retomado. Não há edição da
composição depois de sair de forming.

Cada sessão admite os slots 1, 2 e 3. A ativação seleciona o menor livre e exige
sessão efetivamente ativa, com o mesmo limite estrito de 15 minutos das sessões.
Personagens concluídos não entram em novos grupos. Na recuperação, um ou dois
integrantes já concluídos são preservados, desde que haja trabalho pendente no trio.
Personagens banidos ou de contas banidas não são elegíveis. C, E e P são aceitos.
Não há reação automática a banimentos posteriores.

## Transições

- forming → active ou abandoned.
- active → abandoned, awaiting_restart ou completed.
- abandoned → active, exclusivamente por resumeGroup.
- awaiting_restart e completed não podem mudar de estado nesta tarefa.

Repetir o estado já aplicado não altera datas/eventos; para active a sessão
precisa ser a mesma. Não há nova atribuição nesse caso, mesmo se a sessão tiver
expirado depois da ativação. Fora de active, sessão e slot correntes ficam nulos;
os eventos preservam as atribuições anteriores. A tarefa 2.2 finaliza grupos
ativos junto com a sessão, abandonando os trios sem desmontar suas reservas.

Concluir preserva status e datas individuais existentes, preenche conclusões
ausentes e libera reservas atomicamente. A conclusão individual não conclui grupo.
Datas de conclusão existentes são imutáveis; não há reinicialização de progresso.

## Distribuição e recuperação — tarefa 2.2

`POST /api/services/ankabot/sessions/:id/claim-groups` exige Bearer ANKABOT_TOKEN
e X-Ankabot-Session-Token da própria sessão. Corpo estrito:
`{"serverId":123,"idempotencyKey":"uuid"}`. Não atualiza heartbeat.

A migration 7 cria `group_claims`, índices de seleção, identidade UUID da atribuição
(`assignment_id`) e proteções de capacidade global. Antes de aplicar alterações,
recusa dados antigos já acima do limite da licença: o operador deve reconciliá-los
explicitamente. Não há desalocação silenciosa na migration. A atribuição recebe
outro UUID ao retomar, inclusive na mesma sessão, invalidando snapshots anteriores.

O serviço `GroupClaimService` valida a credencial, concilia vencimentos em transações
independentes e aloca em uma única transação. Licença → sessão → grupos → contas →
personagens é a ordem de locks. Alocações da mesma licença são serializadas.
Operações internas de ativação/retomada também respeitam o limite compartilhado.
Reduzir maxCharacters abaixo do uso atual retorna 409 LICENSE_CAPACITY_IN_USE.

Até três grupos e nove personagens por sessão; o total de todas as sessões deve
caber em maxCharacters. Capacidade 40 admite treze trios, totalizando 39.

Primeiro recuperar abandonados elegíveis mais antigos por created_at/id, em pool
compartilhado entre licenças. Exigir trio completo, reservas próprias, classes e
contas distintas, mesmo servidor solicitado, contas não banidas e personagens
C/E/P, com pelo menos um integrante ainda não concluído. Ignorar inválidos sem alterá-los. Não recuperar forming,
awaiting_restart ou completed. Depois formar novos trios somente com C sem
conclusão e sem reserva. O seletor procura a primeira combinação viável na ordem
created_at/id, sem limitar-se aos primeiros três registros incompatíveis.

Bloqueios não bloqueantes permitem concorrência entre licenças. Somente os grupos
de recuperação necessários são bloqueados. Se ainda houver abandonados elegíveis
temporariamente indisponíveis, retornar RECOVERY_BUSY em vez de formar grupos novos
antes deles. Uma nova chave permite tentar novamente. Contas/personagens candidatos
são bloqueados ordenadamente em lote para evitar inversão de locks entre trios.
Essa implementação prioriza correção; o custo do lote e do seletor depende do estoque.

Resposta 200: sessionId, serverId, groups, newlyAssignedGroupIds, capacity e reason.
Cada grupo contém id, assignmentId, status, sessionSlot e members. Integrantes:
id, ankamaId, name, breedId, serverId, status, completedAt. Não inclui credenciais.
capacity informa uso/limites da sessão e licença. Motivos: SESSION_FULL,
LICENSE_CAPACITY, NO_ELIGIBLE_TRIO ou RECOVERY_BUSY. Estoque/capacidade insuficientes
podem retornar lista parcial ou vazia; nunca um trio parcial.

Repetição da mesma chave devolve o snapshot salvo, sem novas alocações, desde que
sessão e atribuições continuem válidas. Os status/capacidades desse snapshot são os
do claim original. Outro servidor com a mesma chave retorna 409 CLAIM_KEY_CONFLICT;
atribuição liberada/recriada retorna 409 CLAIM_STALE. Nova chave permite completar
slots livres. Se já houver grupo ativo de outro servidor, retornar 409
SESSION_SERVER_CONFLICT. Sessão vencida/encerrada retorna 409 SESSION_INACTIVE.

Expiração, encerramento explícito, heartbeat vencido e substituição de sessão
utilizam `finalizeSession` na transação que finaliza a sessão. Grupos ativos viram
abandoned, perdem sessão/slot/assignment_id e preservam trio/reservas/eventos.
Integrantes não concluídos e não banidos viram P. B e completedAt são preservados.
Recuperação não muda P para E. Job e repetição da finalização são idempotentes.

Antes do commit, o claim força constraints diferidas e revalida o prazo no relógio
do banco. Vencimento aborta alocação e snapshot; outra transação finaliza a sessão,
sem desfazer a expiração para retornar erro. Expiração posterior ao commit segue
o ciclo normal. Logs e respostas não contêm credenciais; resposta usa no-store.

O endpoint usa o pool existente de database.ts: consulta PostgreSQL limitada a 30s
e cliente a 35s, permitindo espera por locks legítimos da mesma licença. Conexão
e deadline de /ready permanecem em 5s. Não há distribuição disparada por heartbeat.

## Concorrência

O serviço bloqueia sessão destino, grupo, contas ordenadas e personagens ordenados.
Reservas únicas e slots únicos constituem proteções adicionais no banco.
Triggers diferidos validam composição e cardinalidade no COMMIT; triggers imediatos
protegem composição imutável e transições. Atualizações de status e primeira
conclusão de personagem não bloqueiam grupos em trigger, evitando inversão com a
ordem conta→personagem da API existente. Mudanças estruturais diretas também são
validadas; o backend não oferece endpoint para mover contas/classes/servidores.

## Testes

`node --env-file=.env.test.local --import tsx --test test/character-groups*.test.ts`

Configure TEST_DATABASE_URL somente para o banco isolado de teste. A integração
cria/remove schema próprio e cobre upgrade de dados F, reservas, composição,
capacidade concorrente, rollback diferido, transições, histórico, conclusão e
concorrência com PATCH de personagens. A suíte completa cobre também banco vazio.
