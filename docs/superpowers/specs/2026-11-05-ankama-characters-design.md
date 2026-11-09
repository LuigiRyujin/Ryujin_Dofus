# Contas Ankama e personagens

## Decisões aprovadas

Fluxo email → conta Ankama → personagens de Dofus Touch. Um email pertence a uma única conta, inclusive quando banida. Uma conta pode possuir vários personagens. Vínculos são permanentes nesta versão.

Conta: C criada, B banida. Personagem: C criado e nunca carregado pelo AnkaBot, E carregado, F fluxo concluído, B banido. Transições individuais são livres. O AnkaBot informa progresso por PATCH autenticado; login técnico para criar personagem não altera C para E.

Banir conta marca todos os personagens B atomicamente. Retirar banimento não restaura personagens. Senhas são criptografadas e reveladas somente em ação explícita autorizada. O email do personagem é derivado da conta e protegido por constraint.

## Entregas

1. API PostgreSQL/Fastify e telas Electron/React para cadastro manual, consulta, filtros e status.
2. Operações persistentes e automação local Python/Playwright para cadastro e confirmação usando email selecionado. Sem compra automática ou alteração de Shield.
3. Comando separado de criação de personagem: selecionar conta, raça e servidor; nome, sexo e aparência aleatórios válidos. Preservar parâmetros e reconciliar resultado incerto antes de repetir.

## Arquitetura e recuperação

API mantém verdade central, reservas e operações idempotentes. Automação local não conecta ao banco. Executar uma operação por vez. Estados técnicos queued/running/completed/failed/uncertain independem dos status de negócio. Resultados externos confirmados devem sobreviver à indisponibilidade da API. Expiração após envio externo exige reconciliação.

Adaptar referência D:/Projetos/Dofus sem alterar seus arquivos, importar banco Oracle ou manter caminhos absolutos. Integração AnkaBot nesta entrega consiste em contrato e documentação; não editar scripts.

## Critérios de aceite

Validar constraints e concorrência em PostgreSQL real de teste; simular fornecedores nos testes automatizados. Validar API e Desktop com seus scripts de teste/build. Demonstrar separadamente teste real de email → conta → personagem → atualização de status, quando credenciais e cliente compatível estiverem disponíveis. Simulações não provam compatibilidade com o jogo.
