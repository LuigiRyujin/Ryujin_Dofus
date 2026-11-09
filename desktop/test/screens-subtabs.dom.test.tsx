// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppStoreProvider } from '../src/renderer/src/store/AppContext';
import { ToastProvider } from '../src/renderer/src/components/ui/Toast';
import { EmailsScreen } from '../src/renderer/src/features/emails/EmailsScreen';
import { AccountsScreen } from '../src/renderer/src/features/accounts/AccountsScreen';
import { CharactersScreen } from '../src/renderer/src/features/characters/CharactersScreen';
import { CreationScreen } from '../src/renderer/src/features/creation/CreationScreen';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AppStoreProvider>
      <ToastProvider>{ui}</ToastProvider>
    </AppStoreProvider>
  );
}

describe('EmailsScreen subtabs integration', () => {
  it('renders default subtab and allows switching between subtabs', () => {
    renderWithProviders(<EmailsScreen initialTab="overview" />);

    // Verifica que a Visão Geral está aberta e exibe os KPIs
    expect(screen.getByText('Saldo em Carteira')).toBeDefined();
    expect(screen.getByText('Estoque Disponível')).toBeDefined();

    // Clica na sub-aba Estoque
    const stockTab = screen.getByRole('tab', { name: /Estoque/i });
    fireEvent.click(stockTab);
    expect(screen.getByPlaceholderText(/Buscar por endereço ou origem/i)).toBeDefined();

    // Clica na sub-aba Importar & Cadastrar
    const importTab = screen.getByRole('tab', { name: /Importar & Cadastrar/i });
    fireEvent.click(importTab);
    expect(screen.getByText('Cadastro Manual Unitário')).toBeDefined();

    // Clica na sub-aba Compras
    const purchaseTab = screen.getByRole('tab', { name: /Compras/i });
    fireEvent.click(purchaseTab);
    expect(screen.getByText(/Comprar Lote de E-mails/i)).toBeDefined();

    // Clica na sub-aba Indicadores
    const metricsTab = screen.getByRole('tab', { name: /Indicadores/i });
    fireEvent.click(metricsTab);
    expect(screen.getByText('Disponibilidade')).toBeDefined();
    expect(screen.getByText('Taxa de Utilização')).toBeDefined();
  });
});

describe('AccountsScreen subtabs integration', () => {
  it('switches between Overview, Roster, Register and Bans subtabs', () => {
    renderWithProviders(<AccountsScreen />);

    // Por padrão abre em Roster
    expect(screen.getByPlaceholderText(/Buscar por login/i)).toBeDefined();

    // Muda para Visão Geral
    const overviewTab = screen.getByRole('tab', { name: /Visão Geral/i });
    fireEvent.click(overviewTab);
    expect(screen.getByText('Total de Contas')).toBeDefined();
    expect(screen.getByText('Contas Ativas')).toBeDefined();

    // Muda para Cadastrar Conta
    const registerTab = screen.getByRole('tab', { name: /Cadastrar Conta/i });
    fireEvent.click(registerTab);
    expect(screen.getByText('Cadastrar Nova Conta Ankama')).toBeDefined();

    // Muda para Banimentos & Riscos
    const bansTab = screen.getByRole('tab', { name: /Banimentos & Riscos/i });
    fireEvent.click(bansTab);
    expect(screen.getByText(/restrição de banimento/i)).toBeDefined();
  });
});

describe('CharactersScreen subtabs integration', () => {
  it('switches between Overview, Characters, New Character and Progress subtabs', () => {
    renderWithProviders(<CharactersScreen />);

    // Por padrão abre em Roster
    expect(screen.getByPlaceholderText(/Buscar por nome/i)).toBeDefined();

    // Muda para Visão Geral
    const overviewTab = screen.getByRole('tab', { name: /Visão Geral/i });
    fireEvent.click(overviewTab);
    expect(screen.getByText('Total de Personagens')).toBeDefined();
    expect(screen.getByText('Distribuição por Servidores')).toBeDefined();

    // Muda para Novo Personagem
    const createTab = screen.getByRole('tab', { name: /Novo Personagem/i });
    fireEvent.click(createTab);
    expect(screen.getByText('Criar Novo Personagem')).toBeDefined();

    // Muda para Progresso & Metas
    const progressTab = screen.getByRole('tab', { name: /Progresso & Metas/i });
    fireEvent.click(progressTab);
    expect(screen.getByText('Criados (C)')).toBeDefined();
    expect(screen.getByText('Em Progresso (E)')).toBeDefined();
  });
});

describe('CreationScreen subtabs integration', () => {
  it('switches between Control Center, Queue and History subtabs', () => {
    renderWithProviders(<CreationScreen />);

    // Por padrão abre em Overview (Centro de Criação)
    expect(screen.getByText('1. Criar Conta Ankama')).toBeDefined();
    expect(screen.getByText('2. Criar Personagem')).toBeDefined();

    // Muda para Fila de Operações
    const queueTab = screen.getByRole('tab', { name: /Fila de Operações/i });
    fireEvent.click(queueTab);
    expect(screen.getByText(/Operações ativas, pendentes/i)).toBeDefined();

    // Muda para Histórico
    const historyTab = screen.getByRole('tab', { name: /Histórico & Logs/i });
    fireEvent.click(historyTab);
    expect(screen.getByText(/Registro de operações concluídas/i)).toBeDefined();
  });
});
