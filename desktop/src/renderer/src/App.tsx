import { useState } from 'react';
import { AppStoreProvider } from './store/AppContext';
import { ToastProvider } from './components/ui/Toast';
import { BackgroundScene } from './components/layout/BackgroundScene';
import { WindowChrome } from './components/layout/WindowChrome';
import { Sidebar, NavRoute } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { useTheme } from './hooks/useTheme';

import { HomeScreen } from './features/home/HomeScreen';
import { EmailsScreen } from './features/emails/EmailsScreen';
import { AccountsScreen } from './features/accounts/AccountsScreen';
import { CharactersScreen } from './features/characters/CharactersScreen';
import { CreationScreen } from './features/creation/CreationScreen';
import { ConnectionScreen } from './features/connection/ConnectionScreen';
import { AccessScreen } from './features/access/AccessScreen';

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<NavRoute>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const { resolvedTheme, toggleTheme } = useTheme();

  // Título e subtítulo dinâmicos da Topbar
  const getTopbarInfo = () => {
    switch (currentRoute) {
      case 'home':
        return {
          title: 'Início',
          subtitle: 'Resumo das operações e métricas do fluxo'
        };
      case 'emails':
      case 'emails-stock':
      case 'emails-import':
      case 'emails-purchase':
      case 'emails-metrics':
        return {
          title: 'Gestão de E-mails',
          subtitle: 'Estoque, importação, compras e indicadores de e-mails'
        };
      case 'accounts':
        return {
          title: 'Contas Ankama',
          subtitle: 'Gerenciamento de acessos, status e banimentos'
        };
      case 'characters':
        return {
          title: 'Personagens Dofus Touch',
          subtitle: 'Acompanhamento do progresso de evolução e servidores'
        };
      case 'creation':
        return {
          title: 'Criação e Automação',
          subtitle: 'Comandos de criação de contas, personagens e filas ativas'
        };
      case 'connection':
        return {
          title: 'Conexão e Infraestrutura',
          subtitle: 'Diagnóstico de latência, API, banco de dados e ambiente desktop'
        };
      case 'access':
        return {
          title: 'Configurações e Acesso',
          subtitle: 'Aparência de tema (profundezas/maré) e credenciais do operador'
        };
    }
  };

  const { title, subtitle } = getTopbarInfo();

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden selection:bg-[var(--accent-gold)]/25 selection:text-[var(--text-primary)]">
      {/* 1. Fundo Oceânico em Camadas com Parallax */}
      <BackgroundScene theme={resolvedTheme} />

      {/* 2. Barra de Título Windows Sem Moldura (32px, controles nativos) */}
      <WindowChrome theme={resolvedTheme} />

      {/* 3. Estrutura Principal: Sidebar + Área de Conteúdo */}
      <div className="relative z-10 flex flex-1 w-full min-h-[calc(100vh-32px)]">
        {/* Sidebar fixa/vidro */}
        <Sidebar
          currentRoute={currentRoute}
          onNavigate={setCurrentRoute}
          theme={resolvedTheme}
        />

        {/* Área Central / Conteúdo com Rolagem */}
        <main className="flex-1 flex flex-col min-w-0 p-[24px] max-w-[1600px] mx-auto w-full overflow-y-auto max-h-[calc(100vh-32px)]">
          {/* Topbar em vidro */}
          <Topbar
            title={title}
            subtitle={subtitle}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            theme={resolvedTheme}
            onToggleTheme={toggleTheme}
          />

          {/* Roteamento das Telas Principais */}
          <div className="flex-1 pb-8">
            {currentRoute === 'home' && <HomeScreen onNavigate={setCurrentRoute} />}
            {currentRoute === 'emails' && <EmailsScreen initialTab="overview" />}
            {currentRoute === 'emails-stock' && <EmailsScreen initialTab="stock" />}
            {currentRoute === 'emails-import' && <EmailsScreen initialTab="import" />}
            {currentRoute === 'emails-purchase' && <EmailsScreen initialTab="purchase" />}
            {currentRoute === 'emails-metrics' && <EmailsScreen initialTab="metrics" />}
            {currentRoute === 'accounts' && <AccountsScreen />}
            {currentRoute === 'characters' && <CharactersScreen />}
            {currentRoute === 'creation' && <CreationScreen />}
            {currentRoute === 'connection' && <ConnectionScreen />}
            {currentRoute === 'access' && <AccessScreen />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AppStoreProvider>
  );
}
