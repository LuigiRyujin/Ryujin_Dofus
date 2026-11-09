import React, { useState } from 'react';
import { AppStoreProvider } from './store/AppContext';
import { ToastProvider } from './components/ui/Toast';
import { BackgroundScene } from './components/layout/BackgroundScene';
import { WindowChrome } from './components/layout/WindowChrome';
import { Sidebar, NavRoute } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';

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

  // Título e subtítulo dinâmicos da Topbar
  const getTopbarInfo = () => {
    switch (currentRoute) {
      case 'home':
        return {
          title: 'Início',
          subtitle: 'Resumo das operações e métricas do fluxo',
        };
      case 'emails-stock':
        return {
          title: 'Estoque de Emails',
          subtitle: 'Consulta e gestão de contas de email disponíveis e vinculadas',
        };
      case 'emails-import':
        return {
          title: 'Importar e Cadastrar',
          subtitle: 'Entrada manual e em lote de credenciais de email',
        };
      case 'emails-purchase':
        return {
          title: 'Compras de Emails',
          subtitle: 'Aquisição simulada de novos lotes de emails',
        };
      case 'emails-metrics':
        return {
          title: 'Indicadores de Emails',
          subtitle: 'Distribuição por status e volume de aquisição',
        };
      case 'accounts':
        return {
          title: 'Contas Ankama',
          subtitle: 'Gerenciamento de acessos, status e banimentos',
        };
      case 'characters':
        return {
          title: 'Personagens Dofus Touch',
          subtitle: 'Acompanhamento do progresso de evolução e servidores',
        };
      case 'creation':
        return {
          title: 'Criação e Automação',
          subtitle: 'Comandos de criação de contas, personagens e filas ativas',
        };
      case 'connection':
        return {
          title: 'Conexão e Serviços',
          subtitle: 'Diagnóstico de latência, API, banco de dados e automação',
        };
      case 'access':
        return {
          title: 'Credenciais de Acesso',
          subtitle: 'Configuração da chave de operador para a API central',
        };
    }
  };

  const { title, subtitle } = getTopbarInfo();

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-x-hidden selection:bg-biolum-400/20 selection:text-foam-50">
      {/* 1. Fundo Oceânico em Camadas com Parallax */}
      <BackgroundScene />

      {/* 2. Barra de Título Windows (32px) */}
      <WindowChrome />

      {/* 3. Estrutura Principal: Sidebar + Área de Conteúdo */}
      <div className="relative z-10 flex flex-1 w-full min-h-[calc(100vh-32px)]">
        {/* Sidebar fixa/vidro */}
        <Sidebar currentRoute={currentRoute} onNavigate={setCurrentRoute} />

        {/* Área Central / Conteúdo */}
        <main className="flex-1 flex flex-col min-w-0 p-[28px] max-w-[1600px] mx-auto w-full">
          {/* Topbar em vidro (64px) */}
          <Topbar
            title={title}
            subtitle={subtitle}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {/* Roteamento das 6 Telas Principais */}
          <div className="flex-1">
            {currentRoute === 'home' && <HomeScreen onNavigate={setCurrentRoute} />}
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
