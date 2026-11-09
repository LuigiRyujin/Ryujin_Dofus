# Tarefa 2.4 — Plano de execução

Spec: ../specs/2026-11-05-ankabot-ban-events-design.md (aprovada pelo usuário).

Execução nativa nesta sessão; revisão independente ao final. Preservar interface,
alterações locais e produção. Sem scripts, ACK externo, recriação ou limpeza física.

- [ ] Migration 9: eventos, relações históricas, preparações, quarentena e transições.
- [ ] Barreira de topologia compartilhada nos escritores existentes; exclusiva no banimento.
- [ ] Domínio transacional com idempotência e permissões por atribuição.
- [ ] Endpoints de evento e consulta administrativa/da sessão de origem.
- [ ] PATCH B legado do operador delegado ao domínio; token compartilhado deve usar novo evento.
- [ ] Elegibilidade de grupos/claim/sync/progresso respeitando lifecycle_status.
- [ ] Testes unitários e integração PostgreSQL de todos os estados e concorrência.
- [ ] Documentação, revisão, build e regressão completa.

Cada item terá verificação antes de ser considerado concluído. Migration será
testada em schemas isolados usando TEST_DATABASE_URL; não aplicada em produção.
