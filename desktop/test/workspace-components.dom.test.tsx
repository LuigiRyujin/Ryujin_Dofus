// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationalWorkspace } from '../src/renderer/src/components/layout/OperationalWorkspace';
import { ModalTabs } from '../src/renderer/src/components/ui/ModalTabs';
import { Modal } from '../src/renderer/src/components/ui/Modal';
import { Sidebar } from '../src/renderer/src/components/layout/Sidebar';
import { Inbox, Mail, UserPlus } from 'lucide-react';

describe('OperationalWorkspace component', () => {
  const items = [
    { value: 'overview', label: 'Visão Geral', icon: Inbox },
    { value: 'stock', label: 'Estoque', icon: Mail, badge: 12, badgeTone: 'success' as const },
    { value: 'import', label: 'Importar', icon: UserPlus, badge: 2, badgeTone: 'warning' as const },
  ];

  it('renders all rail items with badges and active state', () => {
    const handleChange = vi.fn();
    render(
      <OperationalWorkspace
        items={items}
        value="stock"
        onChange={handleChange}
        ariaLabel="Área de Teste"
        headerTitle="Título do Workspace"
        headerDescription="Descrição do Workspace"
      >
        <div data-testid="content">Conteúdo da Aba Estoque</div>
      </OperationalWorkspace>
    );

    expect(screen.getByText('Título do Workspace')).toBeDefined();
    expect(screen.getByText('Descrição do Workspace')).toBeDefined();
    expect(screen.getByTestId('content')).toBeDefined();

    const stockTab = screen.getByRole('tab', { name: /Estoque/i });
    expect(stockTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();

    // Clicar em outra aba
    const overviewTab = screen.getByRole('tab', { name: /Visão Geral/i });
    fireEvent.click(overviewTab);
    expect(handleChange).toHaveBeenCalledWith('overview');
  });

  it('triggers onRefresh when clicking the refresh button', () => {
    const handleRefresh = vi.fn();
    render(
      <OperationalWorkspace
        items={items}
        value="overview"
        onChange={vi.fn()}
        ariaLabel="Área de Teste"
        onRefresh={handleRefresh}
        lastUpdatedAt="14:30"
      >
        <div>Conteúdo</div>
      </OperationalWorkspace>
    );

    const refreshBtn = screen.getByRole('button', { name: /Atualizado 14:30/i });
    expect(refreshBtn).toBeDefined();
    fireEvent.click(refreshBtn);
    expect(handleRefresh).toHaveBeenCalled();
  });
});

describe('ModalTabs component', () => {
  const tabs = [
    { id: 'general', label: 'Geral', icon: Inbox },
    { id: 'credentials', label: 'Credenciais', icon: Mail, badge: 3 },
  ];

  it('renders tabs and handles tab switching', () => {
    const handleChange = vi.fn();
    render(
      <ModalTabs
        tabs={tabs}
        activeTab="general"
        onChange={handleChange}
      />
    );

    const generalTab = screen.getByRole('tab', { name: /Geral/i });
    expect(generalTab.getAttribute('aria-selected')).toBe('true');

    const credsTab = screen.getByRole('tab', { name: /Credenciais/i });
    expect(credsTab.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(credsTab);
    expect(handleChange).toHaveBeenCalledWith('credentials');
  });
});

describe('Modal component with sub-tabs', () => {
  it('renders title, description and headerTabs slot', () => {
    const handleClose = vi.fn();
    render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="Modal de Teste"
        description="Subtítulo do modal"
        headerTabs={<div data-testid="header-tabs">Sub-Abas Aqui</div>}
      >
        <p>Conteúdo interno do modal</p>
      </Modal>
    );

    expect(screen.getByText('Modal de Teste')).toBeDefined();
    expect(screen.getByText('Subtítulo do modal')).toBeDefined();
    expect(screen.getByTestId('header-tabs')).toBeDefined();
    expect(screen.getByText('Conteúdo interno do modal')).toBeDefined();

    // Fecha ao clicar no botão fechar
    const closeBtn = screen.getByRole('button', { name: /Fechar/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});

describe('Sidebar navigation', () => {
  it('renders main domain items and marks active', () => {
    const handleNavigate = vi.fn();
    render(
      <Sidebar
        currentRoute="emails"
        onNavigate={handleNavigate}
        theme="dark"
      />
    );

    expect(screen.getByText('Início')).toBeDefined();
    expect(screen.getByText('E-mails')).toBeDefined();
    expect(screen.getByText('Contas Ankama')).toBeDefined();
    expect(screen.getByText('Personagens')).toBeDefined();
    expect(screen.getByText('Criação')).toBeDefined();

    const emailsBtn = screen.getByRole('button', { name: /E-mails/i });
    expect(emailsBtn.getAttribute('aria-current')).toBe('page');

    const accountsBtn = screen.getByRole('button', { name: /Contas Ankama/i });
    fireEvent.click(accountsBtn);
    expect(handleNavigate).toHaveBeenCalledWith('accounts');
  });

  it('marks E-mails active when deep sub-route like emails-stock is current', () => {
    render(
      <Sidebar
        currentRoute="emails-stock"
        onNavigate={vi.fn()}
        theme="dark"
      />
    );

    const emailsBtn = screen.getByRole('button', { name: /E-mails/i });
    expect(emailsBtn.getAttribute('aria-current')).toBe('page');
  });
});
