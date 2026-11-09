import React, { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { useAccounts } from '../../hooks/useDataHooks';
import { DataTable, Column } from '../../components/data/DataTable';
import { Pagination } from '../../components/data/Pagination';
import { RowActionsMenu } from '../../components/data/RowActionsMenu';
import { StatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import {
  SearchInput,
  SegmentedControl,
  TextField,
  PasswordField,
  SelectField,
} from '../../components/ui/Fields';
import { SidePanel } from '../../components/layout/SidePanel';
import { Modal } from '../../components/ui/Modal';
import { ModalTabs } from '../../components/ui/ModalTabs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { AccountStatus, AnkamaAccount } from '../../types/domain';
import {
  Ban,
  Eye,
  EyeOff,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  KeyRound,
  Mail,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { OperationalWorkspace } from '../../components/layout/OperationalWorkspace';

export type AccountTab = 'overview' | 'roster' | 'register' | 'bans';

export const AccountsScreen: React.FC = () => {
  const { state } = useAppStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AccountTab>('roster');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const { data, loading, refetch, createAccount, setBan } = useAccounts({
    q: search,
    status: statusFilter,
    page,
    pageSize,
  });

  // Contadores globais
  const totalAccounts = state.accounts.length;
  const activeAccounts = state.accounts.filter((a) => a.status === 'C').length;
  const bannedAccounts = state.accounts.filter((a) => a.status === 'B').length;

  // Painel lateral de detalhes
  const [selectedAccount, setSelectedAccount] = useState<AnkamaAccount | null>(null);
  const [revealedPassword, setRevealedPassword] = useState(false);

  // Modal de cadastro com sub-abas
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<'credentials' | 'email' | 'policy'>('credentials');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedEmailId, setSelectedEmailId] = useState('');

  // Diálogo de confirmação de Banimento (Seção 7.3)
  const [accountToBan, setAccountToBan] = useState<AnkamaAccount | null>(null);

  // Emails disponíveis ('D') apenas para vincular a nova conta
  const availableEmails = state.emails.filter((e) => e.status === 'D');

  const handleCloseSidePanel = () => {
    setSelectedAccount(null);
    setRevealedPassword(false);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogin || !selectedEmailId) {
      showToast('Preencha o login e selecione um email disponível.', 'error');
      return;
    }
    await createAccount({
      login: newLogin,
      emailId: selectedEmailId,
      password: newPassword || 'AkPass#9988',
    });
    showToast('Conta Ankama criada e vinculada com sucesso!');
    setIsCreateModalOpen(false);
    setNewLogin('');
    setNewPassword('');
    setSelectedEmailId('');
    refetch();
  };

  const handleConfirmBan = async () => {
    if (!accountToBan) return;
    await setBan(accountToBan.id, true);
    showToast(`Conta ${accountToBan.login} e todos os seus personagens foram banidos.`, 'error');
    setAccountToBan(null);
    if (selectedAccount?.id === accountToBan.id) {
      setSelectedAccount({ ...selectedAccount, status: 'B' });
    }
    refetch();
  };

  const handleUnban = async (acc: AnkamaAccount) => {
    await setBan(acc.id, false);
    showToast(`Banimento da conta ${acc.login} removido. Personagens continuam banidos.`);
    if (selectedAccount?.id === acc.id) {
      setSelectedAccount({ ...selectedAccount, status: 'C' });
    }
    refetch();
  };

  // Helper para buscar o endereço de email vinculado
  const getLinkedEmailAddress = (emailId: string) => {
    const email = state.emails.find((e) => e.id === emailId);
    return email ? email.address : 'Email não encontrado';
  };

  // Helper para buscar personagens vinculados à conta
  const getLinkedCharacters = (accountId: string) => {
    return state.characters.filter((c) => c.accountId === accountId);
  };

  const columns: Column<AnkamaAccount>[] = [
    {
      key: 'login',
      header: 'Login',
      cell: (acc) => <span className="font-semibold text-foam-50">{acc.login}</span>,
    },
    {
      key: 'email',
      header: 'Email vinculado',
      cell: (acc) => (
        <span className="font-mono text-foam-300 text-[13px]">
          {getLinkedEmailAddress(acc.emailId)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (acc) => <StatusBadge status={acc.status} type="account" />,
    },
    {
      key: 'createdAt',
      header: 'Data de criação',
      cell: (acc) => (
        <span className="text-foam-500 tabular-nums text-[13px]">
          {new Date(acc.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (acc) => (
        <RowActionsMenu
          items={[
            {
              label: 'Ver detalhes',
              onClick: () => {
                setSelectedAccount(acc);
                setRevealedPassword(false);
              },
            },
            acc.status === 'C'
              ? {
                  label: 'Banir conta',
                  destructive: true,
                  icon: <Ban size={14} className="text-bad" />,
                  onClick: () => setAccountToBan(acc),
                }
              : {
                  label: 'Retirar banimento',
                  icon: <ShieldCheck size={14} className="text-ok" />,
                  onClick: () => handleUnban(acc),
                },
          ]}
        />
      ),
    },
  ];

  const workspaceItems = [
    {
      value: 'overview' as const,
      label: 'Visão Geral',
      icon: Users,
    },
    {
      value: 'roster' as const,
      label: 'Contas Ankama',
      icon: UserCheck,
      badge: activeAccounts,
      badgeTone: 'success' as const,
    },
    {
      value: 'register' as const,
      label: 'Cadastrar Conta',
      icon: UserPlus,
    },
    {
      value: 'bans' as const,
      label: 'Banimentos & Riscos',
      icon: ShieldAlert,
      badge: bannedAccounts > 0 ? bannedAccounts : undefined,
      badgeTone: 'danger' as const,
    },
  ];

  return (
    <>
      <OperationalWorkspace
        items={workspaceItems}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Gestão de Contas Ankama"
        headerTitle="Contas Ankama & Acessos"
        headerDescription="Gerenciamento de credenciais, vinculação de e-mails, monitoramento de banimentos e status"
        onRefresh={refetch}
        isRefreshing={loading}
        lastUpdatedAt={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        statusNode={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-[var(--radius-tag)] bg-[#4CC38A]/15 text-[#4CC38A] border border-[#4CC38A]/30 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#4CC38A] animate-pulse" />
              Sincronização Ativa
            </span>
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-tag)] bg-white/10 text-[var(--text-secondary)]">
              {totalAccounts} contas registradas
            </span>
          </div>
        }
        bottom={
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span>Ativas:</span>
              <strong className="text-ok font-mono">{activeAccounts}</strong>
            </div>
            <div className="flex justify-between">
              <span>Banidas:</span>
              <strong className="text-bad font-mono">{bannedAccounts}</strong>
            </div>
            <div className="flex justify-between">
              <span>E-mails livres ('D'):</span>
              <strong className="text-[var(--accent-gold)] font-mono">{availableEmails.length}</strong>
            </div>
          </div>
        }
      >
        {/* SUB-ABA 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Total de Contas
                </span>
                <span className="text-[22px] font-bold text-foam-50 tabular-nums">
                  {totalAccounts}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Cadastradas no sistema</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Contas Ativas
                </span>
                <span className="text-[22px] font-bold text-ok tabular-nums">
                  {activeAccounts}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Status 'C' (Criada/Ativa)</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Contas Banidas
                </span>
                <span className="text-[22px] font-bold text-bad tabular-nums">
                  {bannedAccounts}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Sob restrição ou ban ('B')</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  E-mails Disponíveis
                </span>
                <span className="text-[22px] font-bold text-[var(--accent-gold)] tabular-nums">
                  {availableEmails.length}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Prontos para vincular ('D')</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Integridade das Contas Ankama
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Contas ativas mantêm seus personagens aptos para filas de automação e farm.
                </p>
                <div className="flex flex-col gap-2 mt-2 text-[13px]">
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-[var(--text-secondary)]">Taxa de Saúde</span>
                    <span className="font-semibold text-ok">
                      {totalAccounts ? Math.round((activeAccounts / totalAccounts) * 100) : 0}% Saudável
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-[var(--text-secondary)]">Média de Personagens/Conta</span>
                    <span className="font-semibold text-foam-50">
                      {totalAccounts ? (state.characters.length / totalAccounts).toFixed(1) : 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[var(--text-secondary)]">Proteção Anti-Ban</span>
                    <span className="font-semibold text-ok flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Ativa via Delays
                    </span>
                  </div>
                </div>
              </div>

              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Ações Rápidas</h3>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    Inicie o cadastro manual ou gerencie o roster de contas.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="primary"
                    icon={<UserPlus size={15} />}
                    onClick={() => setActiveTab('register')}
                    className="flex-1"
                  >
                    Cadastrar nova conta
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<UserCheck size={15} />}
                    onClick={() => setActiveTab('roster')}
                    className="flex-1"
                  >
                    Ver lista completa
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-ABA 2: ROSTER / LISTA */}
        {activeTab === 'roster' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <SearchInput
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  onClear={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  placeholder="Buscar por login..."
                />
                <SegmentedControl
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'Todas' },
                    { value: 'C', label: 'Criada' },
                    { value: 'B', label: 'Banida' },
                  ]}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  icon={<Plus size={16} />}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Cadastrar conta
                </Button>
              </div>
            </div>

            <div className="flex flex-col">
              <DataTable
                columns={columns}
                data={data.items}
                keyExtractor={(acc) => acc.id}
                loading={loading}
                onRowClick={(acc) => {
                  setSelectedAccount(acc);
                  setRevealedPassword(false);
                }}
                selectedId={selectedAccount?.id}
              />
              <Pagination
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}

        {/* SUB-ABA 3: CADASTRAR CONTA */}
        {activeTab === 'register' && (
          <div className="surface p-6 rounded-[var(--radius-ctl)] border border-[var(--border-app)] max-w-[620px] flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h3 className="text-[16px] font-semibold text-foam-50">Cadastrar Nova Conta Ankama</h3>
              <p className="text-[13px] text-[var(--text-secondary)]">
                Vincule um e-mail com status 'D' (Disponível) do estoque a um novo login de jogo.
              </p>
            </div>

            <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
              <TextField
                label="Login da conta"
                placeholder="ex: ryujin_ranger_048"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value)}
                required
                autoFocus
              />
              <PasswordField
                label="Senha da conta"
                placeholder="Senha de acesso"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Se não fornecida, uma senha segura padrão será atribuída"
              />
              <SelectField
                label="Email disponível no estoque (Status 'D')"
                value={selectedEmailId}
                onChange={(e) => setSelectedEmailId(e.target.value)}
                options={availableEmails.map((email) => ({
                  value: email.id,
                  label: `${email.address} (${email.origin})`,
                }))}
                helperText="Ao cadastrar, o email passará para status 'Utilizado' (U) e ficará vinculado exclusivamente a esta conta."
              />
              <div className="flex justify-end pt-3 border-t border-white/5">
                <Button variant="primary" type="submit">
                  Criar e vincular conta
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* SUB-ABA 4: BANIMENTOS & RISCOS */}
        {activeTab === 'bans' && (
          <div className="flex flex-col gap-5">
            <div className="p-4 rounded-[var(--radius-ctl)] bg-bad/10 border border-bad/20 text-bad flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={18} />
                <span>
                  {bannedAccounts > 0
                    ? `${bannedAccounts} conta(s) estão atualmente com restrição de banimento.`
                    : 'Nenhuma conta está banida atualmente. O ecossistema está seguro.'}
                </span>
              </div>
            </div>

            <div className="flex flex-col border border-[var(--border-app)] rounded-[var(--radius-ctl)] overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-black/30 border-b border-[var(--border-app)] text-[var(--text-tertiary)] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Login</th>
                    <th className="p-3">Email Vinculado</th>
                    <th className="p-3">Personagens Afetados</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {state.accounts.filter((a) => a.status === 'B').length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-[var(--text-secondary)]">
                        Nenhuma conta banida registrada.
                      </td>
                    </tr>
                  ) : (
                    state.accounts
                      .filter((a) => a.status === 'B')
                      .map((acc) => {
                        const linkedChars = getLinkedCharacters(acc.id);
                        return (
                          <tr key={acc.id} className="hover:bg-white/5">
                            <td className="p-3 font-semibold text-foam-50">{acc.login}</td>
                            <td className="p-3 font-mono text-[var(--text-secondary)]">
                              {getLinkedEmailAddress(acc.emailId)}
                            </td>
                            <td className="p-3 text-[var(--text-secondary)]">
                              {linkedChars.length} personagem(ns) banidos
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                variant="secondary"
                                className="h-[28px] text-[12px]"
                                icon={<ShieldCheck size={13} className="text-ok" />}
                                onClick={() => handleUnban(acc)}
                              >
                                Retirar banimento
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </OperationalWorkspace>

      {/* Painel lateral de detalhes da conta selecionada */}
      <SidePanel
        isOpen={Boolean(selectedAccount)}
        onClose={handleCloseSidePanel}
        title="Detalhes da Conta"
      >
        {selectedAccount && (
          <div className="flex flex-col gap-6 text-[14px]">
            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Status da Conta</span>
              <div>
                <StatusBadge status={selectedAccount.status} type="account" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Login Ankama</span>
              <span className="font-semibold text-foam-50 text-[16px]">{selectedAccount.login}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Senha</span>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10">
                <span className="font-mono text-foam-50 tracking-wider">
                  {revealedPassword ? selectedAccount.password || 'AkPass#9988' : '••••••••••'}
                </span>
                <Button
                  variant="ghost"
                  className="h-[28px] px-2 text-[12px]"
                  icon={revealedPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  onClick={() => setRevealedPassword(!revealedPassword)}
                >
                  {revealedPassword ? 'Ocultar' : 'Revelar'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Email Vinculado</span>
              <span className="font-mono text-[var(--text-secondary)]">
                {getLinkedEmailAddress(selectedAccount.emailId)}
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <span className="text-[12px] uppercase font-semibold text-[var(--text-tertiary)]">
                Personagens Vinculados
              </span>
              <div className="flex flex-col gap-2">
                {getLinkedCharacters(selectedAccount.id).length === 0 ? (
                  <span className="text-[13px] text-[var(--text-secondary)] italic">
                    Nenhum personagem cadastrado nesta conta.
                  </span>
                ) : (
                  getLinkedCharacters(selectedAccount.id).map((char) => (
                    <div
                      key={char.id}
                      className="p-2.5 rounded-[var(--radius-ctl)] bg-black/30 border border-white/5 flex items-center justify-between text-[13px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foam-50">{char.name}</span>
                        <span className="text-[var(--text-secondary)] text-[12px]">{char.race} · {char.server}</span>
                      </div>
                      <StatusBadge status={char.status} type="character" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Modal de Cadastro com SUB-ABAS (Organizado para não ficar cheio) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Cadastrar Conta Ankama"
        description="Configure o login e associe um e-mail do estoque"
        maxWidth="560px"
        headerTabs={
          <ModalTabs
            activeTab={createModalTab}
            onChange={(t) => setCreateModalTab(t as typeof createModalTab)}
            tabs={[
              { id: 'credentials', label: 'Credenciais', icon: KeyRound },
              { id: 'email', label: 'E-mail Vinculado', icon: Mail, badge: availableEmails.length },
              { id: 'policy', label: 'Política e Segurança', icon: Sliders },
            ]}
          />
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="button" onClick={handleCreateAccount}>
              Criar conta Ankama
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-[14px]">
          {createModalTab === 'credentials' && (
            <div className="flex flex-col gap-4">
              <TextField
                label="Login da conta"
                placeholder="ex: ryujin_ranger_048"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value)}
                required
                autoFocus
              />
              <PasswordField
                label="Senha da conta"
                placeholder="Senha de acesso"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Se em branco, uma senha forte segura será atribuída"
              />
            </div>
          )}

          {createModalTab === 'email' && (
            <div className="flex flex-col gap-3">
              <SelectField
                label="Email disponível no estoque (Status 'D')"
                value={selectedEmailId}
                onChange={(e) => setSelectedEmailId(e.target.value)}
                options={availableEmails.map((email) => ({
                  value: email.id,
                  label: `${email.address} (${email.origin})`,
                }))}
                helperText="Ao cadastrar, o email passará para status 'Utilizado' (U) e ficará vinculado exclusivamente a esta conta."
              />
            </div>
          )}

          {createModalTab === 'policy' && (
            <div className="flex flex-col gap-3 text-[13px] text-[var(--text-secondary)]">
              <div className="p-3 rounded-[var(--radius-ctl)] bg-white/5 border border-white/10 flex items-center gap-2 text-ok">
                <CheckCircle2 size={16} />
                <span>Conta configurada para sincronização segura com Dofus Touch</span>
              </div>
              <p>
                A conta será criada com perfil individual. Em caso de banimento no jogo, o sistema isolará automaticamente todos os personagens vinculados a ela.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Diálogo de Confirmação de Banimento com TEXTO EXATO (Seção 7.3) */}
      <ConfirmDialog
        isOpen={Boolean(accountToBan)}
        onClose={() => setAccountToBan(null)}
        onConfirm={handleConfirmBan}
        title="Banir conta?"
        description="Todos os personagens desta conta serão marcados como banidos. Retirar o banimento da conta não restaurará os status anteriores."
        confirmLabel="Banir conta"
        cancelLabel="Cancelar"
        destructive={true}
      />
    </>
  );
};
