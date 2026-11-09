# RyujinDofus — Especificação de Design e Implementação

> Documento para agentes de código (Codex, Gemini e similares).
> Texto de interface: **português do Brasil**. Identificadores de código, nomes de arquivos e tipos: **inglês**.

---

## 0. Como usar este documento

**Objetivo:** construir uma demonstração navegável, no navegador, de um aplicativo desktop para **Windows** que gerencia emails, contas Ankama e personagens de Dofus Touch. Sem Electron e sem backend nesta fase.

**Ordem de trabalho obrigatória**

1. Setup do projeto e tokens (seções 12 e 4).
2. Fundo em camadas e material de vidro (seções 5 e 6).
3. Layout base: barra de título, sidebar, topbar (seção 8).
4. Componentes reutilizáveis (seção 9).
5. Dados fictícios e camada de serviço (seções 10 e 11).
6. Telas, na ordem: Início, Emails, Contas Ankama, Personagens, Criação, Conexão e Acesso (seção 7).
7. Revisão contra os critérios de aceite (seção 14).

**Precedência quando houver conflito:** este documento > protótipo HTML de referência > suposições do agente.

**Regras gerais**

- Não invente funcionalidades, telas ou textos fora desta especificação.
- Não adicione bibliotecas além das listadas na seção 12.
- Todo dado exibido é fictício e deve ser identificado como simulado quando envolver compra, criação ou credenciais.
- Nenhum valor de cor, raio ou espaçamento solto nos componentes: use sempre os tokens da seção 4.
- Prefira composição de componentes pequenos a arquivos grandes.

---

## 1. Produto e conceito visual

**RyujinDofus** é um app de produtividade para operar um fluxo: *email → conta Ankama → personagem*. O usuário trabalha com tabelas, filtros, painéis de detalhe e operações automatizadas.

**Ryujin** (竜神) é o dragão-deus do mar da mitologia japonesa. O conceito visual é **"Profundezas"**: o app é uma janela de vidro submersa, escura, silenciosa e precisa. O usuário vê a informação como quem olha para a luz que chega do alto, através de camadas de água.

Sensações-alvo: tranquilidade, precisão, profundidade, controle. Nunca: festivo, gamer, neon, poluído, "landing page".

**Princípios**

1. **Dados primeiro.** Superfícies de dados são opacas e legíveis. O vidro fica na moldura (sidebar, topbar, modais, painéis).
2. **Contraste como hierarquia.** A cor mais clara (Espuma) é reservada à ação principal, ao item ativo e aos números principais.
3. **Uma luz só.** O ciano bioluminescente é o único acento, usado com extrema moderação.
4. **Estado nunca só por cor.** Sempre texto + ícone ou ponto.
5. **Prioridade por ação.** O que exige decisão do usuário aparece antes do que é apenas informativo.

---

## 2. Plataforma: Windows

O alvo é Windows 10/11. **Não usar convenções de macOS.**

| Tema | Regra |
|---|---|
| Fonte | `"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`. Para títulos grandes, `"Segoe UI Variable Display"` com mesmo fallback. Não usar `-apple-system` nem SF Pro. |
| Atalhos | **Ctrl + K** abre a busca global (aceitar também Meta+K). Exibir o atalho como `Ctrl K`, nunca `⌘K`. |
| Barra de título | Barra própria de 32 px no topo, com controles de janela à **direita** no padrão Windows (minimizar, maximizar, fechar) com 46 px de largura cada. Fechar ganha fundo `#C42B1C` no hover. Nesta fase é só visual. |
| Rolagem | Barras finas de 10 px, polegar translúcido com cantos de 6 px. |
| Escala (DPI) | O layout precisa funcionar em 1920×1080 com escala de 125% e 150% (largura útil de 1536 e 1280 px) e em 1366×768. |
| Alto contraste | Suportar `@media (forced-colors: active)`: bordas visíveis, sem depender de transparência. |
| Desempenho | `backdrop-filter` só em: sidebar, topbar, barra de título, modais, painel lateral, toast e faixa de métricas. Fornecer fallback opaco com `@supports not (backdrop-filter: blur(1px))`. |
| Futuro Electron | Prever `titleBarOverlay`/`frame: false`. Evite lógica que dependa do navegador (como `localStorage` para dados de negócio). |

---

## 3. Identidade e logotipo

**Arquivos**

- `src/assets/brand/ryujin-mark.png`: símbolo do dragão, branco com **canal alfa** (já preparado para máscara). Origem: dragão branco em fundo preto, em S, cabeça voltada para a direita, chifres, quatro espinhos de asa à esquerda e cauda que termina em dois arcos em crescente.
- Ideal: converter o símbolo em **SVG vetorial** (vetorização do PNG original, por exemplo com Potrace/Inkscape) e salvar como `ryujin-mark.svg`. Até lá, usar o PNG.

**Uso técnico:** o símbolo deve ser aplicado como **máscara CSS**, para herdar a cor do tema:

```css
.mark {
  background: currentColor;
  aspect-ratio: 257 / 440;
  -webkit-mask: url("/src/assets/brand/ryujin-mark.png") center / contain no-repeat;
          mask: url("/src/assets/brand/ryujin-mark.png") center / contain no-repeat;
}
```

**Onde aparece**

| Local | Tamanho | Cor |
|---|---|---|
| Sidebar, topo, ao lado do texto `RYUJIN` | 38 px de altura | Espuma `#F2F7FB` |
| Barra de título | 16 px | Espuma |
| Fundo da área principal, à direita, parcialmente cortado | 900 px de altura | `#BFE3F2` a **7% de opacidade**, com parallax lento |
| Estado vazio das tabelas | 72 px | Espuma a 25% |

Texto da marca: `RYUJIN` em caixa alta, peso 500, espaçamento entre letras `0.14em`.
Nunca distorcer, girar ou aplicar gradiente colorido ao símbolo.

---

## 4. Tokens de design

As três camadas de cor vêm da profundidade do oceano. Proporção de uso: **Abismo 60%, Corrente 30%, Espuma 10%**.

### 4.1 Cores

| Token | Hex | Função |
|---|---|---|
| `abyss-950` | `#02050A` | Fundo mais profundo (base da página, parte inferior) |
| `abyss-900` | `#050B14` | Fundo principal |
| `abyss-850` | `#0A1626` | Superfície de dados (tabelas, cards) base |
| `abyss-800` | `#0E1D31` | Superfície elevada |
| `abyss-700` | `#16293F` | Bordas fortes |
| `current-700` | `#17385A` | Orbe de luz 2 |
| `current-600` | `#24598A` | Orbe de luz 1 |
| `current-500` | `#2B6A9A` | Realces de gráfico secundários |
| `current-300` | `#7FB2D1` | Texto auxiliar de destaque (raro) |
| `foam-50` | `#F2F7FB` | Texto principal, botão primário, item ativo |
| `foam-300` | `#A9BBCB` | Texto secundário (contraste mínimo 7:1 sobre `abyss-850`) |
| `foam-500` | `#8CA0B3` | Texto terciário (mínimo 4.5:1) |
| `biolum-400` | `#58C4D6` | **Único acento**: foco de teclado, marcas de canto dos cards, hover de barra de gráfico |
| `biolum-glow` | `#0F7A87` | Orbe de luz 3 (inferior), somente atmosfera |

**Estados** (sempre com texto + ícone ou ponto):

| Estado | Hex |
|---|---|
| Sucesso / Disponível / Criada / Finalizado / Concluída | `#4CC38A` |
| Alerta / Resultado incerto | `#E0A84A` |
| Erro / Bloqueado / Banido / Falhou | `#F0706E` |
| Em andamento / Em progresso / Executando | `#6FB1F0` |
| Neutro / Aguardando / Utilizado / Criado | `#8CA0B3` |

**Bordas de superfícies de dados:** `#1B2E44` (cards), `#1E3248` (cabeçalho de tabela), `#162840` (linhas).
**Botão primário:** fundo `foam-50`, texto `#0B0D12`. **Nunca** usar o ciano como fundo de botão.

### 4.2 CSS base (Tailwind v4)

```css
@import "tailwindcss";

@theme {
  --color-abyss-950: #02050a;
  --color-abyss-900: #050b14;
  --color-abyss-850: #0a1626;
  --color-abyss-800: #0e1d31;
  --color-abyss-700: #16293f;
  --color-current-700: #17385a;
  --color-current-600: #24598a;
  --color-foam-50: #f2f7fb;
  --color-foam-300: #a9bbcb;
  --color-foam-500: #8ca0b3;
  --color-biolum-400: #58c4d6;
  --color-ok: #4cc38a;
  --color-warn: #e0a84a;
  --color-bad: #f0706e;
  --color-info: #6fb1f0;

  --font-sans: "Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
  --font-display: "Segoe UI Variable Display", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;

  --radius-ctl: 8px;     /* botões, inputs, itens de menu */
  --radius-tag: 6px;     /* selos e pílulas de estado */
  --radius-card: 12px;   /* cards e tabelas */
  --radius-glass: 14px;  /* sidebar, topbar, modais, painel lateral */

  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
}

html { color-scheme: dark; }
body {
  font-family: var(--font-sans);
  color: var(--color-foam-50);
  font-variant-numeric: tabular-nums;
  background: linear-gradient(180deg, #0b1d33 0%, #050b14 50%, #02050a 100%) fixed;
}
```

### 4.3 Tipografia

| Uso | Tamanho / peso |
|---|---|
| Título da página | 32 px / 600, tracking `-0.02em` |
| Subtítulo da página | 15 px / 400, `foam-300` |
| Título de card | 16 px / 600 |
| Corpo, itens de menu, tabela | 14 px / 400–500 |
| Cabeçalho de tabela, rótulos de grupo | 12 px / 600, `foam-300` (rótulo de grupo em caixa alta, tracking `0.05em`) |
| Número de métrica | 32 px / 600, tabular |

Números tabulares (`font-variant-numeric: tabular-nums`) em métricas, tabelas, datas e contadores. Linhas de texto com no máximo 80 caracteres.

### 4.4 Raios e espaçamento

- **Raios equilibrados, nunca "bolha":** 8 (controles), 6 (selos), 12 (cards), 14 (vidro). Pílulas totalmente redondas (`999px`) só para pontos de status.
- Espaçamento em múltiplos de 4. Margem da página: 28 px. Gap entre blocos: 24 px. Padding de card: 22 px.
- **Assinatura visual:** cada card de dados recebe dois cantos marcados em diagonal (superior esquerdo e inferior direito), traço de 1.5 px em `biolum-400`, 16×16 px, seguindo o raio do card. Os outros dois cantos ficam limpos.

### 4.5 Movimento

- Duração entre **150 e 220 ms**, curva `--ease-out`.
- Entradas de modal: `translateY(12px) scale(.97)` para o normal, 220 ms. Overlay: fade 200 ms.
- Único movimento contínuo permitido: ponto verde de conexão pulsando (2.6 s) e neve marinha (seção 5).
- **Respeitar `prefers-reduced-motion`:** desligar todas as animações e transições e o parallax.
- Sem efeito de entrada em cada seção, sem animação em todo hover.

---

## 5. Fundo em camadas (profundezas)

O vidro só tem sentido se houver algo atrás dele para desfocar. O fundo é fixo, atrás de tudo (`position: fixed; inset: 0; z-index: 0`) e `aria-hidden`.

Camadas, de baixo para cima:

1. **Gradiente de profundidade:** `#0B1D33` (topo) → `#050B14` (50%) → `#02050A` (base).
2. **Orbes de luz difusa** (`filter: blur(110px)`):
   - Orbe 1: `#24598A`, 680 px, canto superior esquerdo (`left:-180px; top:-200px`), opacidade 65%.
   - Orbe 2: `#17385A`, 560 px, à direita (`right:-120px; top:25%`), opacidade 80%.
   - Orbe 3: `#0F7A87`, 420 px, inferior (`left:12%; bottom:-180px`), opacidade 40%.
3. **Raios de luz** vindos do alto: listras diagonais (`repeating-linear-gradient(108deg, transparent 0 70px, rgba(150,215,240,.045) 110px, transparent 170px)`) com máscara que esmaece de cima para baixo (`linear-gradient(180deg,#000,transparent 75%)`). Região: `inset: -5% -10% 20% 35%`.
4. **Símbolo do dragão** gigante a 7% de opacidade (seção 3), à direita, cortado pela borda.
5. **Neve marinha:** 5 partículas minúsculas (1–2 px, `rgba(210,235,250,.35–.55)`) via `radial-gradient` repetido (`background-size: 520px`), subindo devagar (`animation: 90s linear infinite`).
6. **Ruído (grain)** a 3% de opacidade (SVG `feTurbulence` embutido).

**Parallax (mousemove):** orbes e símbolo se deslocam em direção oposta ao cursor, com amplitude máxima de ±18 px (símbolo ±8 px) e `transition: transform .6s`. Só em dispositivos com ponteiro fino e sem `prefers-reduced-motion`.

---

## 6. Material "vidro submerso"

Utilitário `glass` usado em: barra de título, sidebar, topbar, modais, painel lateral, toasts.

```css
@utility glass {
  position: relative;
  border-radius: var(--radius-glass);
  background:
    linear-gradient(180deg, rgb(255 255 255 / .11), rgb(255 255 255 / .04)),
    rgb(70 150 200 / .09);
  backdrop-filter: blur(36px) saturate(180%);
  box-shadow:
    0 1px 2px rgb(0 0 0 / .5),
    0 30px 70px rgb(0 0 0 / .55),
    inset 0 1px 0 rgb(255 255 255 / .2),
    inset 0 -1px 0 rgb(0 0 0 / .35);
}
/* Borda de luz em gradiente (1px) */
.glass::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: linear-gradient(135deg, rgb(255 255 255 / .55), rgb(255 255 255 / .05) 60%, rgb(255 255 255 / .2));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
/* Brilho especular no canto superior esquerdo */
.glass::after {
  content: ""; position: absolute; left: 10px; top: 10px; width: 46%; height: 34%; pointer-events: none;
  border-radius: 10px 70% 40% 70%;
  background: radial-gradient(120% 120% at 0 0, rgb(255 255 255 / .16), transparent 60%);
  opacity: .7;
}
@supports not (backdrop-filter: blur(1px)) { .glass { background: #0e1d31; } }
```

**Superfície de dados** (`surface`): fundo `rgba(8,19,33,.92)`, sem blur, borda `#1B2E44`, raio 12 px, sombra `0 8px 24px rgb(0 0 0 / .35)`, marcas de canto (seção 4.4). Usada em tabelas, cards, formulários.

**Modal:** overlay `rgba(4,6,10,.6)` com blur de 12 px. Painel `glass`, raio 14 px, largura 460 px (diálogo de confirmação 440 px, importação 560 px).

---

## 7. Telas

Layout geral: 1440×900, adaptável até 1024 px (a sidebar vira só ícones abaixo de 1100 px; abaixo de 700 px a sidebar some).

### 7.1 Início

Ordem de cima para baixo (organizada por prioridade):

1. **Título** "Boa tarde, Ryujin" + subtítulo com data e contagem (ex.: "Quinta-feira, 5 de novembro · 9 operações hoje, 2 precisam de atenção.").
2. **Faixa de métricas:** **um único bloco de vidro leve** com 4 células separadas por divisores finos (não 4 cards). Cada célula: rótulo 13 px, número 32 px, variação semanal em verde com `▲`.
   - Emails disponíveis **128** (▲ 4) · Contas Ankama **47** (▲ 2) · Personagens em progresso **63** (▲ 9) · Fluxos finalizados **29** (▲ 3).
3. **Grade 8/4 colunas, gap 24 px:**
   - **Esquerda (8):** card "Operações nos últimos 7 dias" (7 barras finas com topo suavizado: seg 18, ter 24, qua 21, **qui 27** em Espuma, sex 30, sáb 16, dom 22; as demais em `#24425F`; total exibido 158) e tabela "Operações recentes" (5 linhas: Tipo, Conta/email, Estado, Hora). **Clicar na linha abre o modal de detalhe da operação.**
   - **Direita (4):** card **"Requer atenção"** em primeiro lugar (itens com borda esquerda colorida: resultado incerto em âmbar, falha em vermelho; clicar abre o modal da operação), depois "Personagens por status" (barra segmentada Criado 14, Em progresso 63, Finalizado 29, Banido 6, total **112**, com legenda numérica) e "Atalhos" (Cadastrar email, Nova conta, Criar personagem).

Os números devem ser coerentes entre si e com os dados fictícios (seção 10).

### 7.2 Emails

Subseções (abas ou navegação): **Estoque**, **Importar e cadastrar**, **Compras**, **Indicadores**.

**Estoque**
- Toolbar: busca, filtro segmentado (Todos · Disponível · Utilizado · Bloqueado), botões "Importar" (secundário) e "Cadastrar email" (primário).
- Tabela: Email, Origem, Data da compra, Status, Ações.
- Status: **D** Disponível (verde), **U** Utilizado (neutro), **B** Bloqueado (vermelho). Selo com ponto + texto.
- Paginação (ex.: "1–8 de 128", 8 por página), menu de ações "⋯" por linha (Ver detalhes, Bloquear/Desbloquear, Copiar email).
- Clique na linha abre **painel lateral** (400 px, vidro, à direita, sem cobrir a tabela inteira) com detalhes, credencial oculta (`••••••••••`) e botão **"Revelar"** (ícone de olho, alterna para "Ocultar"; volta a ocultar ao fechar o painel).

**Importar e cadastrar**
- Cadastro manual: formulário (email, senha, origem, data da compra).
- Importação: zona de arrastar arquivo (borda tracejada fina) → modal de importação (560 px) com **prévia** (5 linhas, uma com erro em vermelho) e resumo "48 válidos · 2 duplicados · 1 inválido". Botões "Cancelar" e "Importar 48 emails".

**Compras** (tudo **claramente simulado**, com faixa permanente "Compra simulada: nenhum valor real será cobrado")
- Saldo (ex.: R$ 250,00), disponibilidade, quantidade (stepper), resumo antes de confirmar (quantidade, preço unitário, total, saldo após). Botão "Confirmar compra (simulada)" abre diálogo de confirmação. Ao confirmar: novos emails `D` entram no estoque, saldo diminui, toast de sucesso.

**Indicadores:** métricas compactas (disponíveis, utilizados, bloqueados), gráfico simples de compras por semana.

### 7.3 Contas Ankama

- Tabela: Login, Email vinculado, Status, Data de criação, Ações.
- Status: **C** Criada (verde), **B** Banida (vermelho).
- Busca por login ou email, filtro por status, paginação.
- **Cadastro manual** (modal): login, senha, select de **email disponível** (só `D`). Ao cadastrar, o email passa para `U` e a conta aparece na tabela.
- **Painel lateral:** credenciais ocultas com "Revelar", email vinculado, lista de personagens vinculados (nome, raça, servidor, status).
- **Banir conta:** diálogo de confirmação de 440 px, ícone de alerta em quadrado de 40 px com fundo vermelho a 12%, título "Banir conta?", texto **exatamente**:
  > "Todos os personagens desta conta serão marcados como banidos. Retirar o banimento da conta não restaurará os status anteriores."

  Botões "Cancelar" e "Banir conta" (destrutivo, vermelho). Ao confirmar: conta `B`, **todos** os personagens vinculados `B`.
- **Retirar banimento:** conta volta a `C`; os personagens **permanecem** `B` (não restaurar).

### 7.4 Personagens

- Tabela: Nome, Conta Ankama, Email vinculado, Raça, Servidor, Status, Ações.
- Status: **C** Criado (nunca carregado pelo AnkaBot, neutro), **E** Em Progresso (já carregado pelo AnkaBot, azul), **F** Finalizado (fluxo concluído, verde), **B** Banido (vermelho).
- Busca e filtros em chips (conta, raça, servidor, status) com "Limpar filtros".
- Painel lateral com detalhes e select **"Alterar status"** (edição administrativa: **qualquer transição** é permitida, com toast de confirmação).
- Cadastro manual: select de conta; o **email é herdado automaticamente** da conta (campo somente leitura).

### 7.5 Criação

Duas ações **distintas**, em duas colunas:

**Criar conta Ankama:** select de email disponível (estoque) → botão "Iniciar criação" → linha do tempo vertical de etapas (concluída, em execução com pulso suave, pendente) → quando a etapa pedir, campo "Código de confirmação" com botão "Enviar código".

**Criar personagem:** select de conta Ankama, select de raça, select de servidor. Aviso discreto: "Nome, sexo e aparência serão gerados aleatoriamente." Botão "Iniciar criação do personagem" (comando **separado** do da conta).

**Lista de operações** (abaixo): Tipo, Conta/email, Estado, Etapa atual, Última atualização, Ação contextual.

**Estados técnicos** (pílulas com borda e ícone, **visualmente diferentes** dos selos de status de personagem, que são retângulos com ponto): Aguardando, Executando, Concluída, Falhou, Resultado incerto.

Ação contextual por estado:

| Estado | Ação | Comportamento simulado |
|---|---|---|
| Executando (aguardando código) | Informar código | Abre modal com campo; ao enviar, avança a etapa |
| Falhou (recuperável) | Retomar | Volta a "Executando" a partir da última etapa |
| Resultado incerto | Conciliar | Verifica o estado real e resolve para Concluída ou Falhou |
| Concluída / Aguardando | Ver detalhes | Abre modal |

**Resultado incerto** mostra o texto "Verifique ou concilie antes de repetir." e **não oferece** "Repetir". Ao concluir uma criação de personagem, ele aparece em Personagens com status `C`.

### 7.6 Conexão e Acesso

**Conexão:** quatro cartões separados, cada um com ponto de estado, texto e valor fictício: Conexão com a API (latência ex.: 42 ms), Disponibilidade do banco, Estado da automação local, Última verificação (data e hora). Botão "Verificar agora" que simula uma checagem (skeleton por ~800 ms e atualiza a data).

**Acesso:** formulário com campo de credencial **mascarado**, botão "Salvar" e feedback "Configuração salva (simulado)". Todos os valores fictícios.

---

## 8. Layout e organização da interface

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◇ RyujinDofus                                                     –   ▢   ✕  │ 32px barra de título (vidro)
├────────────┬─────────────────────────────────────────────────────────────────┤
│  ◇ RYUJIN  │ ┌─ topbar (vidro 64px) ───────────────────────────────────────┐ │
│            │ │ Início · Resumo das operações     [🔍 Buscar  Ctrl K] [＋ Nova conta]│ │
│ VISÃO GERAL│ └─────────────────────────────────────────────────────────────┘ │
│  ▣ Início  │  Boa tarde, Ryujin                                              │
│ EMAILS     │  Quinta-feira, 5 de novembro · 9 operações hoje, 2 precisam…    │
│  Estoque   │ ┌ faixa de métricas (um bloco, 4 células) ──────────────────────┐│
│  Importar… │ │ Emails 128 │ Contas 47 │ Em progresso 63 │ Finalizados 29     ││
│  Compras   │ └────────────────────────────────────────────────────────────────┘│
│  Indicad…  │ ┌ Operações 7 dias (8/12) ────────┐ ┌ Requer atenção (4/12) ───┐ │
│ CONTAS E…  │ └─────────────────────────────────┘ │  ▌ resultado incerto      │ │
│  Contas    │ ┌ Operações recentes ─────────────┐ │  ▌ falhou                 │ │
│  Personag… │ │ tabela (clique abre modal)      │ └───────────────────────────┘ │
│  Criação   │ └─────────────────────────────────┘ ┌ Personagens por status ───┐ │
│ APLICATIVO │                                     └───────────────────────────┘ │
│  Conexão   │                                     ┌ Atalhos ──────────────────┐ │
│  Acesso    │                                     └───────────────────────────┘ │
│ ● API cone…│                                                                   │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

**Sidebar (264 px, vidro, sticky, 12 px de distância das bordas):** logo e texto no topo; grupos com rótulo de 12 px em caixa alta; itens de 36 px com ícone de 18 px (traço 1.5 px, lucide) + rótulo; item ativo em pílula **Espuma** (`#F2F7FB`) com texto e ícone escuros e sombra; rodapé com divisor, ponto verde pulsante e "API conectada". Abaixo de 1100 px: 72 px, só ícones (com `aria-label` e `title`).

**Grupos e itens (nesta ordem exata)**

- Visão geral: Início
- Emails: Estoque, Importar e cadastrar, Compras, Indicadores
- Contas e personagens: Contas Ankama, Personagens, Criação
- Aplicativo: Conexão, Acesso

**Topbar (vidro, 64 px):** título + descrição curta à esquerda; à direita, busca global (280 px) com atalho `Ctrl K` e as ações contextuais da tela (a ação principal usa o botão primário Espuma).

**Painel lateral de detalhes (400 px, vidro, flutuante à direita):** abre sobre a área de conteúdo sem esconder a listagem inteira; fecha com Esc, botão "Fechar" ou clique fora; devolve o foco ao elemento de origem.

---

## 9. Componentes

Todos em `src/components/`, com props tipadas, sem dados embutidos e sem estilos soltos.

| Componente | Especificação |
|---|---|
| `Button` | Variantes `primary` (Espuma), `secondary` (vidro 8% + borda 16%), `destructive` (vermelho `#F0706E` com texto escuro), `ghost`. Altura 38 px, raio 8, hover `translateY(-1px)`. Estados: foco, desabilitado, carregando. |
| `TextField`, `SelectField`, `PasswordField` | Label sempre visível acima; altura 40 px; raio 8; fundo `white/6%`; borda `#2E4864`; foco com anel `biolum-400`. `PasswordField` com botão revelar/ocultar. |
| `SearchInput` | Com ícone de lupa, limpar e atalho. |
| `SegmentedControl` | Filtro segmentado de status. |
| `FilterChip` | Chips com opção de limpar. |
| `StatusBadge` | **Status de entidade** (D/U/B, C/B, C/E/F/B): retângulo de 6 px, ponto + texto. |
| `OperationPill` | **Estado técnico**: pílula com borda, ícone e texto. Visualmente distinta do `StatusBadge`. |
| `DataTable<T>` | Genérica; colunas declarativas; cabeçalho 12 px; linhas com divisor sutil; hover; linha selecionada com fundo `biolum-400` a 8%; slot de ações; navegação por teclado (Enter abre). |
| `Pagination` | "1–8 de 128", anterior/próxima e seletor de página. |
| `RowActionsMenu` | Menu "⋯" em vidro, com setas do teclado, Esc fecha. |
| `SidePanel` | Painel lateral de vidro com cabeçalho, corpo e rodapé. |
| `Modal` | Anatomia: **barra de título** (título + botão fechar), **corpo**, **rodapé** de ações (fundo escurecido, divisor fino). Foco preso, Esc fecha, devolve o foco. |
| `ConfirmDialog` | Modal compacto para ações destrutivas. |
| `Toast`, `ToastProvider` | Vidro, 10 px de raio, canto inferior central, some em 2.4 s, `role="status"`. |
| `Skeleton`, `EmptyState`, `ErrorState` | Skeleton com brilho suave; estado vazio com símbolo do dragão a 25%, texto e ação; erro com causa e como corrigir, tentar novamente. |
| `MetricStrip` | A faixa de 4 células. |
| `BarChart` | Barras finas (topo 5 px, base 2 px), destaque do dia atual. |
| `SegmentedBar` | Barra segmentada horizontal (raio 4) com legenda numérica. |
| `Timeline` | Etapas verticais. |
| `AttentionList` | Itens que exigem ação. |
| `WindowChrome`, `Sidebar`, `Topbar`, `BackgroundScene` | Moldura do app. |

**Ícones:** `lucide-react`, traço 1.5 px (`strokeWidth={1.5}`), 18 px na navegação. Todo ícone isolado precisa de `aria-label`.

---

## 10. Modelo de dados e dados fictícios

`src/types/domain.ts`

```ts
export type EmailStatus = "D" | "U" | "B";          // Disponível, Utilizado, Bloqueado
export type AccountStatus = "C" | "B";              // Criada, Banida
export type CharacterStatus = "C" | "E" | "F" | "B"; // Criado, Em Progresso, Finalizado, Banido
export type OperationState = "waiting" | "running" | "done" | "failed" | "uncertain";
export type OperationType = "create_account" | "create_character" | "import_emails" | "purchase_emails";

export interface EmailRecord {
  id: string;
  address: string;
  origin: string;
  purchasedAt: string;          // ISO 8601
  status: EmailStatus;
  password?: string;            // fictícia; nunca exibir sem "Revelar"
}

export interface AnkamaAccount {
  id: string;
  login: string;
  emailId: string;              // FK -> EmailRecord.id (email com status "U")
  status: AccountStatus;
  createdAt: string;
  password?: string;
}

export interface Character {
  id: string;
  name: string;
  accountId: string;            // FK -> AnkamaAccount.id
  race: string;
  server: string;
  status: CharacterStatus;
  // O email é derivado de account.emailId, nunca armazenado aqui.
}

export interface Operation {
  id: string;
  type: OperationType;
  subject: string;              // login ou email
  state: OperationState;
  step: string;
  updatedAt: string;
  needsCode?: boolean;
  recoverable?: boolean;
}

export interface ConnectionSnapshot {
  api: { ok: boolean; latencyMs: number };
  database: { ok: boolean };
  automation: { state: "idle" | "running" | "offline" };
  checkedAt: string;
}
```

---

## 11. Estado e arquitetura de dados

- Estado local com `useReducer` + Context (`AppStoreProvider`). Sem Redux, Zustand ou React Query nesta fase.
- Camada de serviço assíncrona com `mock*Service` em `src/services/mock/` que lê/escreve o store e simula latência (150–400 ms).
- Hooks `useEmails`, `useAccounts`, `useCharacters`, `useOperations`.
- Tipos de resposta paginada: `Page<T> = { items: T[]; total: number; page: number; pageSize: number }`.

---

## 12. Setup técnico

**Stack:** React 18+, TypeScript (strict), Vite, Tailwind CSS v4 (`@tailwindcss/vite`), `lucide-react`.

```bash
npm create vite@latest ryujindofus -- --template react-ts
cd ryujindofus
npm i lucide-react
npm i -D tailwindcss @tailwindcss/vite
```

**Estrutura**

```
src/
  assets/brand/ryujin-mark.png (e .svg quando existir)
  styles/index.css              # @import "tailwindcss", @theme, utilitários, fundo
  types/domain.ts
  data/                         # emails.ts accounts.ts characters.ts operations.ts connection.ts
  services/{types.ts,mock/}
  store/                        # reducer, context, selectors (métricas derivadas)
  hooks/                        # useEmails, useDebounce, useMediaQuery, useReducedMotion, useFocusTrap
  components/
    ui/                         # Button, fields, Badge, Pill, Modal, SidePanel, Toast, Skeleton...
    data/                       # DataTable, Pagination, charts
    layout/                     # WindowChrome, Sidebar, Topbar, BackgroundScene
  features/
    home/ emails/ accounts/ characters/ creation/ connection/
  App.tsx  main.tsx
```

---

## 13. Acessibilidade

- Contraste mínimo **4.5:1** em todo texto.
- Foco de teclado sempre visível: anel de 2 px `biolum-400` com offset 2 px.
- Modais e painéis: `role="dialog"`, foco preso, Esc fecha.
- Selos de status: texto + ponto. Estados técnicos: texto + ícone.
- Credenciais ocultas por padrão.

---

## 14. Critérios de aceite

- [ ] Roda com `npm run dev` e `npm run build`, sem erros de TypeScript.
- [ ] As 6 telas existem e a navegação da sidebar funciona.
- [ ] Busca, filtros e paginação funcionam em Emails, Contas e Personagens.
- [ ] Cadastro manual de email, conta e personagem atualiza as tabelas e preserva as relações.
- [ ] Banir conta mostra o diálogo com o texto exato e propaga `B` aos personagens.
- [ ] Credenciais ocultas por padrão e reveladas só por ação explícita.
- [ ] A compra é identificada como simulada antes e depois da confirmação.
- [ ] Operação com resultado incerto orienta a conciliar e não oferece repetir.
- [ ] Os estados técnicos são visualmente distintos dos status de personagem.
- [ ] Métricas do Início batem com os dados (112 = 14 + 63 + 29 + 6).
- [ ] Atalho **Ctrl K** foca a busca; nenhuma referência a ⌘ ou a macOS.
- [ ] Fonte Segoe UI Variable com fallback; sem fonte da Apple.
- [ ] Sem cores, raios ou espaçamentos fora dos tokens.
- [ ] Legível em 1440×900, 1280×720 e 1024 px de largura.
- [ ] Movimento entre 150 e 220 ms e desligado com `prefers-reduced-motion`.
- [ ] Todo texto de interface em português do Brasil.

