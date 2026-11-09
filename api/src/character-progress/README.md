# Sincronização e progresso AnkaBot — tarefa 2.3

Migration **8** adiciona character_progress (snapshot individual),
character_progress_updates (atualizações aceitas/replay) e session_sync_state
(último relatório aceito). As referências históricas usam FK com exclusão restrita.
characters.completed_at continua sendo a fonte da conclusão; attributes permanece
intocado. Nada foi aplicado em produção. Não há scripts ou interface neste módulo.

## Autenticação

Todos os endpoints de instância exigem:

```http
Authorization: Bearer <ANKABOT_TOKEN>
X-Ankabot-Session-Token: <sessionToken>
```

Hostname e PID não autenticam progresso. O operador não pode usar o token
administrativo como se fosse uma instância. Credenciais nunca são retornadas nos
contratos de progresso ou diagnóstico nem registradas em logs.

## Heartbeat

`PUT /api/services/ankabot/sessions/:sessionId/heartbeat`

Sem corpo ou com `{}` mantém o contrato anterior, inclusive sem campo sync na
resposta, e não significa que todos os personagens foram descarregados.

```json
{
  "schemaVersion": 1,
  "sequence": 12,
  "loadedCharacters": [
    {"characterId": "uuid", "assignmentId": "uuid"}
  ]
}
```

sequence deve crescer na sessão: inteiro de 1 a 2147483647. A lista aceita até
64 entradas, sem repetir personagem. UUIDs são normalizados para minúsculas.
Array vazio explícito reporta zero carregados. Versão desconhecida, campos extras
ou corpo inválido retornam 400 sem renovar atividade.

A resposta mantém os campos da sessão e acrescenta sync:

```json
{
  "schemaVersion": 1,
  "sequence": 12,
  "reportStatus": "accepted",
  "expected": ["uuid"],
  "valid": ["uuid"],
  "missing": [],
  "unexpected": [],
  "staleAssignments": [],
  "receivedAt": "2026-11-05T12:00:00Z"
}
```

O exemplo acima representa somente o conteúdo do campo sync. expected inclui
todos os integrantes dos grupos ativos, inclusive os já concluídos. Ausência é
diagnóstico, nunca banimento, morte, abandono ou perda de progresso. Entradas
indevidas são listadas em unexpected. staleAssignments contém characterId,
reportedAssignmentId e expectedAssignmentId para um personagem próprio reportado
com uma atribuição antiga. Nenhuma divergência altera a propriedade dos grupos.

Relatório novo promove C/P para E apenas nos personagens válidos e não concluídos.
B e conclusões são preservados. Sequência repetida ou menor renova a atividade,
mas retorna reportStatus=stale, receivedSequence e o último diagnóstico aceito;
não promove personagens nem sobrescreve o relatório persistido. Após reinício da
integração, use a sequência aceita retornada para continuar a contagem.

`GET /api/services/ankabot/sessions/:id` com OPERATOR_TOKEN inclui sync para
diagnóstico, ou null se nunca houve relatório. Não se mantém histórico ilimitado
de heartbeats, apenas a última sequência aceita, lista e diagnóstico.

## Progresso

`GET /api/services/ankabot/sessions/:sessionId/characters/:characterId/progress`

Exige personagem em grupo ativo da sessão. Retorna schemaVersion, groupId,
assignmentId e progress. Progresso inicial: revision=0, quest=null, data={},
updatedAt=null. O claim também inclui progress em cada integrante. Um replay de
claim antigo mantém o snapshot original; use este GET para ler a revisão atual.

`POST /api/services/ankabot/sessions/:sessionId/characters/:characterId/progress`

```json
{
  "schemaVersion": 1,
  "assignmentId": "uuid",
  "updateId": "uuid",
  "baseRevision": 0,
  "quest": {"id": "quest-123", "stepId": "step-4"},
  "data": {"objectivesCompleted": ["objective-1"]},
  "completed": false
}
```

Quest e etapa são identificadores opacos de 1–128 caracteres. quest pode ser null
e stepId pode ser null. data é objeto JSON limitado a 16 KiB UTF-8, substituído
integralmente: não há merge implícito. Não inclua credenciais nesses dados.
baseRevision é inteiro de 0 a 2147483646. Cada atualização aceita incrementa a
revisão. Datas vêm do PostgreSQL; horário do cliente não determina precedência.

Resposta 200 contém schemaVersion, progress, group e replayed. progress inclui
characterId, revision, quest, data, updatedAt, lastSessionId, lastAssignmentId e
completedAt. As referências last* representam a última gravação, não propriedade
corrente. group informa id, status e capacityReleased.

O POST valida sessão, atividade, grupo, membro, assignmentId e revisão dentro da
mesma transação. Revisão conflitante não grava: leia o GET, reconcilie e envie novo
updateId com a revisão atual. Não reapresente automaticamente dados antigos como
se fossem novos após um conflito.

updateId é único por sessão. Mesmo ID e payload canônico retornam o resultado
histórico com replayed=true, sem novas gravações. O fingerprint ignora ordem das
chaves JSON, mas preserva ordem de arrays. Outro conteúdo ou personagem com o mesmo
ID retorna 409. O replay exige sessão autenticada e ativa, mas é reconhecido antes
de exigir atribuição atual: isso permite confirmar a terceira conclusão após ela
liberar o grupo. O replay não confirma propriedade atual nem devolve necessariamente
a revisão mais recente. GET só está disponível enquanto houver atribuição ativa.

## Conclusão e recuperação

completed=true conclui todo o fluxo do personagem, não apenas uma quest. Não apaga
ou conclui os demais integrantes. Quando os três possuem completedAt, a mesma
transação conclui o grupo, libera reservas/slot/capacidade e registra um evento.
Apenas uma atualização concorrente realiza essa finalização. Não há reset da
conclusão. Novas atualizações de personagem concluído são recusadas; replays aceitos
anteriormente permanecem reconhecíveis em sessão ativa.

Abandono/expiração preserva quest, dados, revisão e conclusões. Recuperação aceita
trio com um ou dois concluídos, mantém todos os integrantes e ocupa capacidade para
três. Só os pendentes continuam o trabalho. Grupos com três concluídos, banidos ou
outras inconsistências não são recuperados. A nova atribuição recebe outro UUID,
impedindo gravações atrasadas da anterior.

F legado em PATCH /api/characters/:id/status retorna 409 USE_SESSION_PROGRESS
enquanto existir reserva, inclusive em formação ou abandono. Sem reserva, F continua
funcionando. O cadastro manual cria um UUID novo, sem associação prévia possível;
um cadastro com F já concluído não pode ser reservado posteriormente pelo domínio.
Os demais comandos administrativos de status foram preservados.

## Erros, concorrência e testes

- 400: versão, formato, tamanho ou campos inválidos.
- 401: Bearer ausente/inválido.
- 403: credencial de sessão inválida ou personagem não atribuído à sessão.
- 409 SESSION_INACTIVE: sessão vencida/encerrada.
- 409 ASSIGNMENT_STALE: atribuição antiga na sessão atual.
- 409 PROGRESS_REVISION_CONFLICT: revisão já avançou.
- 409 PROGRESS_UPDATE_CONFLICT: updateId reutilizado com outro conteúdo.
- 409 CHARACTER_COMPLETED / CHARACTER_UNAVAILABLE: conclusão ou indisponibilidade.

Locks seguem licença → sessão → grupo → contas ordenadas → personagens ordenados.
Antes de confirmar, as constraints são verificadas e o prazo da sessão é revalidado.
Vencimento desfaz progresso, promoções, diagnóstico e ledger; a finalização da
sessão ocorre em transação independente, preservando a expiração.

Execute npm test, npm run build e a suíte PostgreSQL real com
`node --env-file=.env.test.local --import tsx --test test/*.test.ts`.
Os testes usam schemas isolados e cobrem upgrade v7→v8, contratos legados,
divergências, revisão/seq concorrentes, replay, recuperação parcial, conclusão
simultânea, liberação de capacidade e rollback sob vencimento durante gravação.
