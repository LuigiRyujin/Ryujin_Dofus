# Tarefa 2.4 — Banimentos e preparação para reinicialização

## Objetivo e decisões confirmadas

Receber banimentos de personagens ou contas Ankama (Account CS1 é o nome legado
dessas contas), invalidar integralmente os grupos operacionais e preservar os
dados necessários à preparação externa futura.

- Operador pode relatar qualquer alvo. Sessão AnkaBot deve estar ativa e comprovar
  que o personagem, ou um personagem da conta alvo, pertence à sua atribuição atual.
- Banimento de conta afeta todos os seus personagens e grupos, mesmo em outras
  sessões/licenças. Banimento individual não marca automaticamente a conta B.
- Grupos concluídos permanecem concluídos, sem nova reinicialização; banimento e
  histórico do personagem/conta são registrados.
- Invalidar também grupos abandonados e em formação, mesmo incompletos. Não criar
  integrantes nem desmontar a composição.
- A capacidade operacional é liberada na mesma transação; sobreviventes mantêm
  status e progresso e nunca voltam automaticamente a C ou à fila comum.

Não implementar cliente Dofus, scripts, depósito/recuperação de itens, confirmação
de preparação externa, recriação ou limpeza física. Não alterar o comportamento
normal de expiração para grupos que não foram invalidados.

## Abordagem

Estender o domínio atual de grupos e a autenticação existente. Manter banimentos
como eventos imutáveis, com estado operacional separado do status do personagem.
Isso evita usar P como sinônimo de reinicialização ou depender apenas de B para
impedir reaproveitamento dos sobreviventes. Não criar plataforma genérica de jobs.

Alternativas rejeitadas: reutilizar abandono/P liberaria grupos para recuperação;
exclusão física perderia progresso e quebraria referências. O desenho mantém
reservas e estado awaiting_restart, acrescentando quarentena explícita.

## Dados — migration 9

Adicionar ban_events com UUID/eventId globalmente único, schema_version=1, alvo
tipado (character ou ankama_account), FKs opcionais exclusivas conforme tipo,
reason_code, descrição opcional, origem (operator/session/legacy_status), sessão
remetente, assignmentId observado, fingerprint canônico, recebimento no banco e
resposta histórica. Não persistir credenciais nem logs de payload.

Adicionar ban_event_characters e ban_event_groups para relacionar todos os
afetados com o evento, preservando status/grupo/sessão anteriores e resultados.
FKs históricas são restritivas, sem cascata destrutiva.

Adicionar group_restart_preparations, única por grupo: pending_external_preparation,
primeiro evento, grupo e sessão de origem quando havia atribuição ativa, data e
snapshot imutável da composição/progresso anterior à primeira invalidação.
Eventos posteriores ligam-se à mesma preparação sem sobrescrever o snapshot.
Consultar membros atuais permite distinguir os sobreviventes de novos banidos.

Adicionar characters.lifecycle_status (active/quarantined/archived), quarantined_at
e archived_at. Datas de progresso/completed_at/atributos não são reiniciadas.
Nesta tarefa somente active→quarantined é aplicado. Nenhum endpoint ou job efetiva
archived; a estratégia futura exige confirmação externa rastreável antes de
arquivar, preservando FKs e evidências. Limpeza física futura terá de respeitar
essas referências e não é habilitada por este desenho.

Não inventar eventos históricos de banimento para dados antigos. Marcar personagens
já B como quarantined; não invalidar grupos antigos automaticamente na migration.
Um evento explícito poderá reconciliar esses casos. Índices e filtros de elegibilidade
devem excluir lifecycle_status diferente de active em formação, claim, recuperação,
ativação/retomada, heartbeat e novas atualizações de progresso.

## Contratos v1

POST /api/services/ankabot/ban-events

Corpo administrativo:

```json
{
  "schemaVersion": 1,
  "eventId": "uuid",
  "target": {"type": "character", "id": "uuid"},
  "reasonCode": "ACCOUNT_BANNED",
  "description": "Banimento confirmado pelo operador"
}
```

target.type também aceita ankama_account. reasonCode é código ASCII de 1–64
caracteres [A-Z0-9_]; descrição opcional de até 1000 caracteres, sem controles.
UUIDs normalizados; objeto estrito e descrição nunca usada em logs.

Instância envia o mesmo corpo, mais sessionId e assignmentId, com Bearer ANKABOT_TOKEN
e X-Ankabot-Session-Token. Operador usa somente Bearer OPERATOR_TOKEN. Para conta,
basta comprovar um personagem da conta no grupo correspondente ao assignmentId;
o efeito continua cobrindo a conta inteira.

Primeiro evento retorna 201 e no-store, com eventId, receivedAt, alvos/personagens
afetados, grupos invalidados, IDs de preparação e capacidade liberada. Replay
autorizado do mesmo evento/payload retorna 200, replayed=true e o snapshot histórico,
sem nova alteração. Mesmo eventId com conteúdo diferente retorna 409. Sessão não
pode obter resposta de evento de outra origem/remetente. Replay exige autenticação
e atividade da sessão, mas não a atribuição já removida pelo próprio evento.
Evento novo de sessão exige propriedade e atribuição atuais. Sessão expirada é
finalizada pelo fluxo normal em transação independente e recebe 409.

GET /api/services/ankabot/ban-events e /ban-events/:id: somente operador, paginados
e filtráveis por alvo. GET /api/services/ankabot/restart-preparations e /:id: operador,
com filtros de grupo/sessão e paginação padrão 25, máximo 100.
GET /api/services/ankabot/sessions/:id/restart-preparations: somente a própria sessão
autenticada/ativa, retornando preparações cuja sessão de origem é essa sessão.
Preparações de grupos sem sessão ativa são administrativas nesta fase.

A preparação expõe currentStep=pending_external_preparation, composição original,
progresso preservado, sobreviventes atuais e requiredActions (contrato descritivo):
stop_group, deposit_items, confirm_preparation, archive_old_characters,
create_replacements, form_new_group, restore_items. Novos personagens futuros
recomeçam do início; nenhum dado dos antigos é zerado. Não há endpoints de ACK,
avanço dessas etapas, arquivamento efetivo ou execução das ações nesta tarefa.

400 para entrada inválida; 401 para Bearer inválido; 403 para remetente sem permissão;
404 para alvo inexistente no acesso administrativo; 409 para sessão/atribuição
desatualizada ou idempotência conflitante. Não revelar dados de outra sessão.

## Transação e estados

Evento válido marca personagens diretamente afetados B, e a conta B somente no
alvo ankama_account. Encontrar grupos com membros atuais e reservas não liberadas,
nos estados forming/active/abandoned/awaiting_restart. Os concluídos permanecem
terminais e somente seu vínculo histórico com o evento é registrado.

Para cada grupo não concluído: colocar awaiting_restart, limpar session_id,
session_slot e assignment_id, manter membros/reservas e colocar todos os integrantes
em quarantined. Sobreviventes conservam C/E/P e qualquer completedAt; o bloqueio é
de ciclo de vida e do grupo. Criar/reutilizar a preparação e registrar group_events,
inclusive quando outro integrante é banido depois da primeira invalidação.

Personagem banido sem grupo fica B/quarantined, sem preparação de grupo inventada.
Uma conta sem personagens pode ser marcada B com evento sem grupos afetados.
Banimentos repetidos com IDs novos acrescentam auditoria, não duplicam preparação
nem liberam capacidade duas vezes.

Modificar constraints/triggers para permitir forming/abandoned→awaiting_restart
por invalidação e permitir aguardando reinicialização com 0–3 membros. Active e
completed continuam exigindo exatamente três. Não permitir awaiting_restart→active,
abandoned ou completed nesta tarefa. Não reabrir grupos concluídos.

Preservar rotina de expiração: ela continua tratando só active. Um grupo invalidado
não pode voltar a abandoned ao expirar a sessão antiga. Progresso novo é recusado;
replays históricos aceitos previamente não escrevem nem afirmam propriedade atual.

## Concorrência e compatibilidade

Banimento de conta pode atravessar licenças. Usar uma barreira transacional de
topologia: mutações suportadas de contas/personagens/grupos/sessões adquirem lock
advisory compartilhado antes de locks de linhas; processamento de banimentos usa
o lock exclusivo. Assim o grafo afetado fica estável enquanto se descobre o alcance.
As demais operações mantêm concorrência entre si. Não adquirir/elevar a barreira
depois de bloquear contas ou sessões.

No evento exclusivo, bloquear licenças/sessões/grupos/contas/personagens em ordem
determinística; autenticar e revalidar a sessão após esperas. Idempotência, evento,
quarentena, grupo, preparação e resposta confirmam juntos. Timeout/erro desfaz tudo.
O registro histórico é consultado antes de exigir atribuição em replay legítimo.

PATCH status B legado do operador delega ao mesmo domínio e mantém o corpo de
resposta antigo. Repetição B já reconciliado não gera novo evento. Pedidos antigos
do token compartilhado AnkaBot para B recebem 409 USE_BAN_EVENTS; ele deverá usar
o novo contrato com identidade de sessão. Outros status administrativos não
removem quarentena, arquivamento ou awaiting_restart. Cadastro inicial B sem grupo
marca quarentena e não permite formação posterior.

## Testes e entrega

PostgreSQL isolado: migration sobre banco vazio e v8 com dados, membro banido,
conta com múltiplos grupos/licenças, forming incompleto, active, abandoned,
awaiting_restart e completed; sobreviventes da quest 80 nunca elegíveis para trio
novo; progresso/atributos/datas preservados; FKs; replay/conflito; novos eventos
para o mesmo alvo; eventos simultâneos; banimento concorrente com claim, progresso,
conclusão e expiração; permissão de sessão/atribuição; consultas administrativas e
de origem; PATCH B legado; edição de status sem remover quarentena; nenhuma
exclusão física/ACK/arquivamento automático; credenciais ausentes de respostas/logs.

Rodar npm test, npm run build e suíte completa com TEST_DATABASE_URL. Encerrar na
tarefa 2.4, documentar decisões e limitações e não aplicar migrations em produção.
