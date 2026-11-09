# Plano de implementação

Spec: ../specs/2026-11-05-ankama-characters-design.md

## Sequência

- [x] Conectar módulos de emails existentes ao servidor com migrations e autenticação.
- [x] Adicionar contas e personagens: constraints, criptografia, consultas, status e banimento coletivo.
- [x] Adicionar telas e IPC tipado no Desktop.
- [x] Adicionar operações persistentes idempotentes, reserva de emails e exclusão de concorrência por conta.
- [x] Adaptar worker local para cadastro e confirmação de conta e criação de personagem.
- [x] Integrar supervisão local e acompanhamento no Desktop.
- [x] Documentar configuração e contrato restrito para AnkaBot.
- [x] Executar testes/builds e registrar limites de validação real.

## Registro de execução

2026-11-05: branch codex/ankama-characters criada preservando alterações locais anteriores. Implementação dividida entre API de cadastro, Desktop e operações/automação; integração revisada pelo agente principal. Nenhum deploy ou compra automática autorizado por este plano.

## Validação registrada

- API: seis testes existentes passaram; build passou.
- PostgreSQL real: teste de integração passou na branch isolada Neon `codex-ankama-test-20261105`, cobrindo upgrade de migrations, constraints, concorrência, permissões e recuperação de operações. Schemas temporários removidos.
- Desktop: build/typecheck e 23 testes passaram; lint sem erros, quatro avisos preexistentes de Fast Refresh.
- Automação: seis testes Node e quatro testes Python passaram.
- Handshake anônimo real: `{ok:true,reason:null,version:"1.74.11"}` após corrigir imports locais `.cjs`.
- Pendente: teste real autenticado email → conta → personagem. Automação desativada por padrão até essa validação. Catálogo raça/servidor exige configuração com IDs válidos do runtime; não foi apresentado catálogo inventado como validado.

- [ ] Executar o teste real autenticado completo e preencher o catálogo do runtime antes de habilitar a automação.
