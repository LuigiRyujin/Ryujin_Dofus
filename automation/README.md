# Automação local Ryujin

A automação é desativada por padrão. O Desktop supervisiona `worker.mjs` quando
`RYUJIN_AUTOMATION_ENABLED=1` e protege a chave persistente do journal com o
armazenamento seguro do Windows. O worker executa uma operação por vez, inicia
`browser_service.py` apenas em `127.0.0.1` e gera um token local efêmero.
Não há conexão direta ao banco nem compra de email neste componente.

## Instalação

Na raiz do repositório:

```powershell
npm ci --prefix automation
python -m pip install -r automation/requirements.txt
python -m playwright install chromium
```

Instale Python e o Chromium do Playwright antes de ativar a automação.
O ambiente do processo precisa de `RYUJIN_API_URL` (origem HTTPS da API) e
`RYUJIN_OPERATOR_TOKEN`. Para execução independente, também configure
`RYUJIN_SPOOL_DIRECTORY` (diretório privado persistente), `RYUJIN_SPOOL_KEY`
(chave aleatória de 32 bytes em base64, mantida entre execuções),
`RYUJIN_WORKER_ID` (identificador do computador) e
`RYUJIN_AUTOMATION_ENABLED=1`. `RYUJIN_PYTHON` permite selecionar o executável.
`RYUJIN_LOCAL_PORT` usa 3139 por padrão. Nunca registre tokens ou chaves no Git.

```powershell
node automation/worker.mjs
```

## Fluxos e recuperação

A conta usa navegador visível. O operador pode completar os campos de identidade
e desafios exigidos pelo formulário. Quando há credenciais OAuth de email, a
leitura procura mensagens Ankama recebidas após o início da execução. Caso
contrário, informe o código na tela de operações; a rota é
`POST /api/creation-operations/:id/code` com `{ "code": "123456" }`.
A janela aguarda até cinco minutos. Falhas após o envio são incertas, nunca uma
nova criação automática. O Shield não é alterado.

O personagem exige conta, raça e servidor. Antes de reservar uma tarefa o worker
consulta a versão oficial e executa um handshake anônimo de compatibilidade.
Usa OAuth com PKCE e state no navegador local para autenticar. Nunca substitui o
servidor escolhido. Gera nome e aparência, salva os parâmetros antes do envio e
confirma nome e identificador externo na lista de personagens do servidor.
Somente recusa explícita de nome permite outro candidato, até cinco.

Resultados confirmados são gravados criptografados em disco, com flush antes da
confirmação HTTP. Ao reiniciar, o worker reenvia esse journal à API antes de
reservar qualquer operação. Preserve sua chave e seus arquivos até a API acusar
recebimento. Não apague reservas para liberar emails com resultado incerto.

Para um personagem com resultado incerto e nome já salvo, o operador pode usar
`POST /api/creation-operations/:id/reconcile`. Essa operação apenas consulta o
personagem existente: se não houver correspondência, permanece incerta e não
cria outro. Contas com resultado incerto precisam de revisão humana; a versão
inicial não implementa uma conciliação automática de cadastro Ankama.

## Verificação e limites conhecidos

```powershell
npm test --prefix automation
python -m unittest discover -s automation/test -p 'test_*.py'
```

O handshake anônimo real foi confirmado em 2026-11-05 com a versão oficial
`1.74.11`. Isso verifica conectividade e compatibilidade inicial; não comprova
autenticação ou criação. O fluxo real completo com email, conta e personagem
não foi executado nesta implementação e precisa ser validado com credenciais
do operador antes do uso produtivo. Seletores e respostas oficiais podem mudar.

Os testes usam clientes simulados para servidor ausente, nome ocupado, limite
de cinco candidatos, checkpoints, identificador confirmado e retomada sem
criar outro personagem; verificam também journal criptografado, códigos antigos,
perda de reserva e validação de state OAuth.
