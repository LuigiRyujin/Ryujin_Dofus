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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { AccountStatus, AnkamaAccount } from '../../types/domain';
import { Ban, Copy, Eye, EyeOff, Plus, ShieldCheck, UserCheck } from 'lucide-react';

export const AccountsScreen: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { showToast } = useToast();

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

  // Painel lateral de detalhes
  const [selectedAccount, setSelectedAccount] = useState<AnkamaAccount | null>(null);
  const [revealedPassword, setRevealedPassword] = useState(false);

  // Modal de cadastro manual
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho da Tela */}
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

        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            if (availableEmails.length === 0) {
              showToast('Não há emails disponíveis no estoque para cadastrar uma nova conta.', 'error');
              return;
            }
            setSelectedEmailId(availableEmails[0].id);
            setIsCreateModalOpen(true);
          }}
        >
          Nova conta Ankama
        </Button>
      </div>

      {/* Tabela de Contas */}
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

      {/* Painel Lateral de Detalhes da Conta (400px vidro) */}
      <SidePanel
        isOpen={Boolean(selectedAccount)}
        onClose={handleCloseSidePanel}
        title="Detalhes da Conta Ankama"
        subtitle={selectedAccount?.login}
        footer={
          selectedAccount &&
          (selectedAccount.status === 'C' ? (
            <Button
              variant="destructive"
              icon={<Ban size={15} />}
              onClick={() => setAccountToBan(selectedAccount)}
            >
              Banir conta
            </Button>
          ) : (
            <Button
              variant="secondary"
              icon={<UserCheck size={15} />}
              onClick={() => handleUnban(selectedAccount)}
            >
              Retirar banimento
            </Button>
          ))
        }
      >
        {selectedAccount && (
          <div className="flex flex-col gap-5 text-[14px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-foam-300">Status da conta</span>
              <StatusBadge status={selectedAccount.status} type="account" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Login Ankama</span>
              <span className="font-semibold text-foam-50">{selectedAccount.login}</span>
            </div>

            {/* Credencial oculta com botão Revelar */}
            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Senha da Conta</span>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10">
                <span className="font-mono text-foam-50 tracking-wider">
                  {revealedPassword
                    ? selectedAccount.password || 'Ak#Sec991!9'
                    : '••••••••••'}
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
              <span className="text-foam-500 text-[12px] uppercase">Email Vinculado</span>
              <span className="font-mono text-foam-300 text-[13px]">
                {getLinkedEmailAddress(selectedAccount.emailId)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Data de Criação</span>
              <span className="text-foam-300 tabular-nums">
                {new Date(selectedAccount.createdAt).toLocaleString('pt-BR')}
              </span>
            </div>

            {/* Lista de Personagens vinculados */}
            <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-foam-300 font-semibold text-[13px]">
                  Personagens vinculados
                </span>
                <span className="text-foam-500 text-[12px] tabular-nums">
                  {getLinkedCharacters(selectedAccount.id).length} personagens
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                {getLinkedCharacters(selectedAccount.id).length === 0 ? (
                  <span className="text-foam-500 text-[12px] italic">
                    Nenhum personagem vinculado a esta conta ainda.
                  </span>
                ) : (
                  getLinkedCharacters(selectedAccount.id).map((char) => (
                    <div
                      key={char.id}
                      className="p-2.5 rounded-[var(--radius-ctl)] bg-white/[0.03] border border-white/10 flex items-center justify-between text-[13px]"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foam-50">{char.name}</span>
                        <span className="text-foam-500 text-[11px]">
                          {char.race} · {char.server}
                        </span>
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

      {/* Modal de Cadastro Manual de Conta Ankama */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Cadastrar Conta Ankama"
        maxWidth="460px"
      >
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
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Criar conta Ankama
            </Button>
          </div>
        </form>
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
    </div>
  );
};

