# RyujinDofus — Plano de Migração para Aplicativo Desktop Electron

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o RyujinDofus como um aplicativo desktop Electron nativo para Windows 10/11 com `electron-vite`, controles nativos de janela (`titleBarOverlay`), dois temas completos (Escuro/Profundezas e Claro/Maré) com a paleta exata das logos enviadas e acento dourado, fundo animado de 7 camadas com paralax suave lerp (com pausa em perda de foco), persistência de preferências no processo principal (`userData/preferences.json`), empacotamento com `electron-builder` (instalador NSIS x64) e todas as 6 telas da especificação em funcionamento.

**Architecture:** A aplicação adota a arquitetura de três processos do Electron:
1. **Main Process (`src/main/`):** Gerencia a `BrowserWindow` sem moldura nativa com `titleBarOverlay` nativo de 32 px, trata a persistência de preferências (tema e bounds de janela) em `userData/preferences.json`, aplica as regras estritas de segurança (sandbox, contextIsolation, bloqueio de navegação externa e window.open) e atualiza dinamicamente as cores dos controles nativos do Windows (`win.setTitleBarOverlay`).
2. **Preload (`src/preload/`):** Expõe via `contextBridge` a API tipada `window.ryujin` baseada em contratos declarados em `src/shared/ipc.ts`.
3. **Renderer (`src/renderer/src/`):** Interface completa em React 19 + TypeScript + Tailwind CSS v4, portando componentes, dados e mock services do protótipo e integrando os temas Escuro e Claro com atributos `[data-theme="dark|light"]`, acento dourado (`#E6C58A` escuro / `#B8853A` claro), alternância das logos originais e fundo submerso de 7 camadas.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph MainProcess ["Processo Principal (Electron / Node.js)"]
        BW[BrowserWindow - 1440x900 / titleBarOverlay 32px]
        PrefStore[Preferences Store - userData/preferences.json]
        IPCMain[IPC Main Handlers: theme, prefs, appInfo, copyText]
        Sec[Security Handlers: CSP, sandbox, navigation blockers]
    end

    subgraph PreloadProcess ["Preload Bridge"]
        CB[contextBridge -> window.ryujin]
        IPCShared[src/shared/ipc.ts Contracts]
    end

    subgraph RendererProcess ["Renderer (React 19 + Tailwind v4)"]
        ThemeEngine[Theme Engine: [data-theme=dark|light]]
        Background[BackgroundScene: 7 Camadas + Lerp Parallax + Pause on Blur]
        WinChrome[WindowChrome: Titlebar 32px Drag Region + Native Overlay Offset]
        SidebarComp[Sidebar: 40px Dynamic Logo + Exact Navigation]
        TopbarComp[Topbar: Breadcrumb + Global Ctrl+K Search + Theme Switcher]
        Screens[6 Telas: Início / Emails / Contas / Personagens / Criação / Conexão e Acesso]
        MockStore[AppStoreProvider + Mock Services + Domain Models]
    end

    MainProcess <--> PreloadProcess
    PreloadProcess <--> RendererProcess
    BW -.-> WinChrome
    PrefStore <--> IPCMain
```

**Tech Stack:** `electron` (^45.2), `electron-vite` (^6.0), `react` (^19.3), `typescript` (^6.0), `tailwindcss` v4 (`@tailwindcss/vite`), `lucide-react`, `electron-builder`.

**Spec:** [RYUJINDOFUS_SPEC.md](file:///d:/Projetos/Ryujin_Dofus/RYUJINDOFUS_SPEC.md)

---

## Global Constraints

- **Aplicativo Desktop Real:** O resultado deve abrir em janela nativa Electron para Windows com `npm run dev` e gerar instalador `.exe` com `npm run build:win`. Não é uma página em aba de navegador.
- **Controles Nativos do Windows:** A janela usa `titleBarStyle: 'hidden'` com `titleBarOverlay: { color, symbolColor, height: 32 }`. Proibido desenhar botões falsos de minimizar, maximizar ou fechar em HTML.
- **Arrasto de Janela:** A barra de título possui `-webkit-app-region: drag` e controles interativos (busca, botões) possuem `-webkit-app-region: no-drag`.
- **Dois Temas e Logos Exatas:**
  - **Escuro:** Fundo `#0B1D33` → `#050B14` → `#02050A`, superfície `rgba(8,19,33,.92)`, vidro com tinta azul `rgba(70,150,200,.09)`, texto `#E8F3FB`, botão primário `#E4F2FB` com texto escuro, acento dourado fino `#E6C58A`. Logo: `ryujin-dark.png` (azul-gelo com contorno dourado).
  - **Claro:** Fundo `#F4F8FC` → `#DDE8F4` → `#D3E1F0`, superfície `rgba(255,255,255,.94)`, vidro branco 55%→35% com sombra `rgba(18,41,90,.14)`, texto `#0B1B3D`, botão primário `#12295A` com texto branco, acento dourado fino `#B8853A`. Logo: `ryujin-light.png` (azul-marinho com contorno dourado).
  - Proibido qualquer tom de ciano: o acento é unicamente o dourado fino em ambos os temas.
- **Fundo de 7 Camadas:**
  1. Gradiente de profundidade do tema
  2. 3 orbes difusos (blur 110px) nos tons das logos
  3. Raios de luz oscilando (±2° em 24s, opacidade 4–7%)
  4. Cáusticas em duas camadas deslizantes (60s e 90s em sentidos opostos, 3–6%)
  5. Marca d'água gigante do dragão do tema ativo (900 px, flutuação ±8 px em 12s)
  6. 3 ondas SVG derivando a 40s, 60s, 80s
  7. Neve marinha subindo lentamente (90s)
  - Parallax lerp no cursor mousemove, scroll parallax 0.3x, pausa completa em perda de foco/visibilidade e desligamento com `prefers-reduced-motion`.
- **Segurança Electron:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, bloqueio de navegação externa e `window.open`.
- **Persistência Sem LocalStorage:** Preferências de tema e tamanho/posição da janela gravadas em JSON no `userData` do processo principal.
- **Idioma:** Toda a interface do usuário em **português do Brasil**.

---

## User Review Required

> [!IMPORTANT]
> **Migração de Código:** O código de UI, dados e serviços já construído e validado em `ryujindofus/` será portado e refinado diretamente para `desktop/src/renderer/src/`, eliminando a interface antiga em verde do Electron anterior.
> 
> **Tratamento das Logos:** As duas imagens fornecidas pelo usuário (`media_1793920686175_c5cc4302.png` e `media_1793920686194_7508c70b.png`) já possuem transparência alfa nos cantos. Garantiremos flood fill apenas das bordas (tolerância máxima 3) caso reste algum pixel espúrio e salvaremos em `ryujin-light.png` e `ryujin-dark.png`. O ícone do app `resources/icon.ico` será gerado com as resoluções 256, 128, 64, 48, 32 e 16 sobre fundo azul-marinho `#0B1B3D` com a logo clara.

---

## Proposed Changes

### Task 1: Tratamento das Logos e Geração do Ícone Multi-Resolução

Processar as duas imagens fornecidas para os temas Claro e Escuro e gerar o pacote de ícones `.ico` e `.png` em `desktop/resources/`.

#### [NEW] `desktop/src/renderer/src/assets/brand/ryujin-light.png`
Logo azul-marinho com contorno dourado com fundo transparente conectado às bordas para o tema claro.

#### [NEW] `desktop/src/renderer/src/assets/brand/ryujin-dark.png`
Logo azul-gelo com contorno dourado com fundo transparente para o tema escuro.

#### [NEW] `desktop/resources/icon.ico` & `desktop/resources/icon.png`
Ícone do aplicativo em formato ICO contendo resoluções (256, 128, 64, 48, 32, 16) sobre um quadrado arredondado azul-marinho `#0B1B3D` com contorno dourado fino e a logo clara.

---

### Task 2: Infraestrutura Electron e Processo Principal com Controles Nativos

Configurar `electron-builder`, canais de IPC tipados, armazenamento de preferências em `userData/preferences.json` e controles de janela nativos via `titleBarOverlay`.

#### [MODIFY] `desktop/package.json`
- Adicionar `electron-builder` às devDependencies.
- Configurar scripts: `"dev": "electron-vite dev"`, `"build": "electron-vite build"`, `"typecheck": "tsc --noEmit"`, `"build:win": "npm run build && electron-builder --win --x64"`.
- Configurar seção `build`:
  - `appId: "com.ryujin.dofus"`
  - `productName: "RyujinDofus"`
  - `directories: { output: "dist" }`
  - `win: { icon: "resources/icon.ico", target: ["nsis"] }`
  - `nsis: { oneClick: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true }`.

#### [NEW] `desktop/src/shared/ipc.ts`
Contratos tipados para IPC (`ThemePreference`, `UserPreferences`, `RyujinBridge`).

#### [NEW] `desktop/src/main/preferences.ts`
Módulo para carregar e salvar `preferences.json` em `userData`.

#### [MODIFY] `desktop/src/main/index.ts`
BrowserWindow 1440x900 sem moldura nativa com `titleBarOverlay`, persistência de bounds, IPC de tema e segurança estrita.

#### [MODIFY] `desktop/src/preload/index.ts`
Expor `window.ryujin` com contratos IPC tipados.

---

### Task 3: Tokens de Design em CSS e Sistema de Temas (Escuro e Claro com Dourado)

Substituir os tokens em `desktop/src/renderer/src/styles/index.css` configurando Tailwind CSS v4 com `@theme` e variáveis CSS escopadas em `[data-theme="dark"]` e `[data-theme="light"]`.

#### [MODIFY] `desktop/src/renderer/src/styles/index.css`
- Variáveis CSS de cor para temas Escuro e Claro
- Acento dourado `#E6C58A` (escuro) e `#B8853A` (claro) no lugar do ciano
- `@utility glass` adaptável por tema
- `@utility surface` com cantos dourados
- Classes `.drag-region` e `.no-drag`.

#### [NEW] `desktop/src/renderer/src/hooks/useTheme.ts`
Hook para sincronização de tema com o processo principal via IPC e atributo `data-theme`.

---

### Task 4: Fundo Animado do Mar com 7 Camadas e Parallax Lerp

Implementar `BackgroundScene.tsx` com as 7 camadas oceânicas independentes, paralax suavizado via lerp em `requestAnimationFrame`, scroll parallax a 0.3x, e pausa quando a janela perder foco ou estiver oculta.

#### [NEW] `desktop/src/renderer/src/components/layout/BackgroundScene.tsx`
7 camadas animadas com orbes difusos, raios oscilantes, cáusticas deslizantes, dragão gigante flutuante, ondas SVG e neve marinha, com otimização de performance (lerp e pausa no blur).

---

### Task 5: Componentes de Layout e Barra de Título Nativa

#### [NEW] `desktop/src/renderer/src/components/layout/WindowChrome.tsx`
Barra de 32 px com área de arraste `-webkit-app-region: drag`, ícone e nome, e reserva nativa à direita para os controles do `titleBarOverlay`.

#### [NEW] `desktop/src/renderer/src/components/layout/Sidebar.tsx`
Sidebar de vidro com logo do tema ativo de 40 px, navegação completa da spec, pílula ativa em alto contraste e rodapé com versão do app.

#### [NEW] `desktop/src/renderer/src/components/layout/Topbar.tsx`
Topbar com busca global `Ctrl K` e botão de alternância de tema.

#### [NEW] `desktop/src/renderer/src/components/layout/SidePanel.tsx`
Painel lateral deslizante de 400 px.

---

### Task 6: Migração e Adaptação dos Componentes de UI, Dados e Serviços

Portar todo o ecossistema de componentes, domínio, dados fictícios e mock services para `desktop/src/renderer/src/`, atualizando para a paleta dourada.

- Portar `src/types/domain.ts`
- Portar `src/data/` (emails, accounts, characters, operations, connection)
- Portar `src/services/` (types, mock implementations)
- Portar `src/store/AppContext.tsx` com regras relacionais
- Portar componentes de UI (`Button`, `Fields`, `Badges`, `Modal`, `ConfirmDialog`, `Toast`, `DataTable`, `Pagination`, `RowActionsMenu`, `Charts`).

---

### Task 7: Migração e Adaptação das 6 Telas

Portar e adaptar as 6 telas para o Electron:
- `HomeScreen.tsx`
- `EmailsScreen.tsx`
- `AccountsScreen.tsx`
- `CharactersScreen.tsx`
- `CreationScreen.tsx`
- `ConnectionScreen.tsx` (incluindo exibição de versão e plataforma do Electron)
- `AccessScreen.tsx` (incluindo a seção Aparência para escolha de tema Escuro / Claro / Sistema)
- Montagem em `App.tsx` e `main.tsx`.

---

### Task 8: Verificação Completa e Geração do Instalador Windows

- Validar compilação TypeScript com `npm run typecheck`.
- Testar execução do app com `npm run dev` na janela Electron nativa.
- Executar `npm run build:win` e gerar o instalador `.exe` em `dist/`.

---

## Verification Plan

### Automated Verification
```bash
cd desktop
npm run typecheck
npm run build
npm run build:win
```

### Manual Verification Checklist
1. **Janela Electron:** Confirmar que `npm run dev` abre janela nativa no Windows com proporções 1440x900.
2. **Controles Nativos Windows:** Confirmar botões nativos do `titleBarOverlay` no canto superior direito e capacidade de arrastar a janela pela barra de 32 px.
3. **Persistência do Tema:** Alternar tema na Topbar e em Acesso → Aparência, fechar o app e reabrir, verificando se o tema escolhido é mantido.
4. **Logos por Tema:** Verificar que o tema claro usa `ryujin-light.png` e o tema escuro usa `ryujin-dark.png`.
5. **Acento Dourado:** Confirmar ausência de ciano e presença do dourado nos focos, marcas de canto e gráficos.
6. **Fundo com 7 Camadas:** Confirmar paralax lerp suave e pausa das animações quando a janela perde o foco.
7. **Instalador NSIS:** Confirmar a geração do executável em `desktop/dist/`.

