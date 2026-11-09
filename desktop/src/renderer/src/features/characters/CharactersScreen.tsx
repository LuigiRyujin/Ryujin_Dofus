import React, { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { useCharacters } from '../../hooks/useDataHooks';
import { DataTable, Column } from '../../components/data/DataTable';
import { Pagination } from '../../components/data/Pagination';
import { RowActionsMenu } from '../../components/data/RowActionsMenu';
import { StatusBadge } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import {
  SearchInput,
  SelectField,
  TextField,
} from '../../components/ui/Fields';
import { SidePanel } from '../../components/layout/SidePanel';
import { Modal } from '../../components/ui/Modal';
import { ModalTabs } from '../../components/ui/ModalTabs';
import { useToast } from '../../components/ui/Toast';
import { Character, CharacterStatus } from '../../types/domain';
import {
  Plus,
  RotateCcw,
  Users,
  Compass,
  TrendingUp,
  Sparkles,
  UserCheck,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { OperationalWorkspace } from '../../components/layout/OperationalWorkspace';

const RACES = [
  'Iop',
  'Cra',
  'Eniripsa',
  'Enutrof',
  'Sram',
  'Sadida',
  'Osamodas',
  'Feca',
  'Xelor',
  'Pandawa',
  'Sacrida',
  'Zobal',
];

const SERVERS = ['Draconiros', 'Mikhal', 'Brial', 'Ilyzaelle'];

export type CharacterTab = 'overview' | 'roster' | 'create' | 'progress';

export const CharactersScreen: React.FC = () => {
  const { state } = useAppStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<CharacterTab>('roster');
  const [search, setSearch] = useState('');
  const [selectedRace, setSelectedRace] = useState<string>('');
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<CharacterStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const { data, loading, refetch, createCharacter, setStatus } = useCharacters({
    q: search,
    race: selectedRace || undefined,
    server: selectedServer || undefined,
    status: selectedStatus,
    page,
    pageSize,
  });

  // Contadores globais
  const totalCharacters = state.characters.length;
  const activeCharacters = state.characters.filter((c) => c.status !== 'B').length;
  const bannedCharacters = state.characters.filter((c) => c.status === 'B').length;
  const completedCharacters = state.characters.filter((c) => c.status === 'F').length;

  // Painel lateral de detalhes
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);

  // Modal de cadastro manual com sub-abas
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<'identity' | 'account' | 'role'>('identity');
  const [newName, setNewName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(state.accounts[0]?.id || '');
  const [newRace, setNewRace] = useState(RACES[0] || 'Cra');
  const [newServer, setNewServer] = useState(SERVERS[0] || 'Draconiros');

  // Conta selecionada no modal para herança de email
  const activeAccountInModal = state.accounts.find((a) => a.id === selectedAccountId);
  const inheritedEmailInModal = state.emails.find((e) => e.id === activeAccountInModal?.emailId);

  // Helper para buscar a conta e o email do personagem
  const getAccountInfo = (accountId: string) => {
    const account = state.accounts.find((a) => a.id === accountId);
    const email = account ? state.emails.find((e) => e.id === account.emailId) : null;
    return {
      login: account?.login || 'Conta não encontrada',
      email: email?.address || 'Email não vinculado',
    };
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !selectedAccountId) {
      showToast('Preencha o nome e selecione uma conta Ankama.', 'error');
      return;
    }
    await createCharacter({
      name: newName,
      accountId: selectedAccountId,
      race: newRace,
      server: newServer,
    });
    showToast(`Personagem ${newName} criado com sucesso com status Criado (C).`);
    setIsCreateModalOpen(false);
    setNewName('');
    refetch();
  };

  const handleStatusChange = async (charId: string, nextStatus: CharacterStatus) => {
    await setStatus(charId, nextStatus);
    showToast(`Status do personagem alterado para "${nextStatus}".`);
    if (selectedChar?.id === charId) {
      setSelectedChar({ ...selectedChar, status: nextStatus });
    }
    refetch();
  };

  const clearAllFilters = () => {
    setSearch('');
    setSelectedRace('');
    setSelectedServer('');
    setSelectedStatus('all');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search || selectedRace || selectedServer || selectedStatus !== 'all'
  );

  const columns: Column<Character>[] = [
    {
      key: 'name',
      header: 'Personagem',
      cell: (char) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foam-50">{char.name}</span>
          <span className="text-[12px] text-[var(--text-secondary)]">{char.race}</span>
        </div>
      ),
    },
    {
      key: 'server',
      header: 'Servidor',
      cell: (char) => <span className="text-foam-300 text-[13px]">{char.server}</span>,
    },
    {
      key: 'account',
      header: 'Conta Ankama',
      cell: (char) => {
        const info = getAccountInfo(char.accountId);
        return (
          <div className="flex flex-col">
            <span className="font-medium text-foam-50 text-[13px]">{info.login}</span>
            <span className="font-mono text-foam-500 text-[11px] truncate max-w-[150px]">{info.email}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (char) => <StatusBadge status={char.status} type="character" />,
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (char) => (
        <RowActionsMenu
          items={[
            {
              label: 'Ver detalhes',
              onClick: () => setSelectedChar(char),
            },
            {
              label: 'Avançar status (Finalizado)',
              onClick: () => handleStatusChange(char.id, 'F'),
            },
            {
              label: char.status === 'B' ? 'Reativar personagem' : 'Marcar como banido',
              destructive: char.status !== 'B',
              onClick: () => handleStatusChange(char.id, char.status === 'B' ? 'C' : 'B'),
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
      icon: Compass,
    },
    {
      value: 'roster' as const,
      label: 'Personagens',
      icon: Users,
      badge: activeCharacters,
      badgeTone: 'success' as const,
    },
    {
      value: 'create' as const,
      label: 'Novo Personagem',
      icon: Sparkles,
    },
    {
      value: 'progress' as const,
      label: 'Progresso & Metas',
      icon: TrendingUp,
    },
  ];

  return (
    <>
      <OperationalWorkspace
        items={workspaceItems}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Gestão de Personagens Dofus Touch"
        headerTitle="Personagens & Roster Operacional"
        headerDescription="Evolução, distribuição por servidores e vínculos a contas Ankama"
        onRefresh={refetch}
        isRefreshing={loading}
        lastUpdatedAt={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        statusNode={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-[var(--radius-tag)] bg-[#4CC38A]/15 text-[#4CC38A] border border-[#4CC38A]/30 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#4CC38A] animate-pulse" />
              Sincronizado
            </span>
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-tag)] bg-white/10 text-[var(--text-secondary)]">
              {totalCharacters} personagens cadastrados
            </span>
          </div>
        }
        bottom={
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span>Ativos:</span>
              <strong className="text-ok font-mono">{activeCharacters}</strong>
            </div>
            <div className="flex justify-between">
              <span>Finalizados:</span>
              <strong className="text-[var(--accent-gold)] font-mono">{completedCharacters}</strong>
            </div>
            <div className="flex justify-between">
              <span>Banidos:</span>
              <strong className="text-bad font-mono">{bannedCharacters}</strong>
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
                  Total de Personagens
                </span>
                <span className="text-[22px] font-bold text-foam-50 tabular-nums">
                  {totalCharacters}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Criados em contas</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Ativos & Prontos
                </span>
                <span className="text-[22px] font-bold text-ok tabular-nums">
                  {activeCharacters}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Criados ou em progresso</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Finalizados
                </span>
                <span className="text-[22px] font-bold text-[var(--accent-gold)] tabular-nums">
                  {completedCharacters}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Status 'F' (Completos)</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Banidos
                </span>
                <span className="text-[22px] font-bold text-bad tabular-nums">
                  {bannedCharacters}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Status 'B'</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Distribuição por Servidores
                </h3>
                <div className="flex flex-col gap-2 mt-2 text-[13px]">
                  {SERVERS.map((server) => {
                    const count = state.characters.filter((c) => c.server === server).length;
                    const pct = totalCharacters ? Math.round((count / totalCharacters) * 100) : 0;
                    return (
                      <div key={server} className="flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span className="text-foam-50 font-medium">{server}</span>
                          <span className="text-[var(--text-secondary)]">{count} personagens ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent-gold)]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Ações Rápidas</h3>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    Cadastre personagens ou monitore metas de progressão.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="primary"
                    icon={<Sparkles size={15} />}
                    onClick={() => setActiveTab('create')}
                    className="flex-1"
                  >
                    Criar personagem
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Users size={15} />}
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
                  placeholder="Buscar por nome..."
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  icon={<Plus size={16} />}
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Criar personagem
                </Button>
              </div>
            </div>

            {/* Filtros em Chips */}
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-[var(--text-tertiary)] text-[12px] mr-1">Filtros:</span>
              <select
                value={selectedServer}
                onChange={(e) => {
                  setSelectedServer(e.target.value);
                  setPage(1);
                }}
                className="h-[32px] px-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10 text-[13px] text-foam-50 outline-none cursor-pointer"
              >
                <option value="">Todos os servidores</option>
                {SERVERS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={selectedRace}
                onChange={(e) => {
                  setSelectedRace(e.target.value);
                  setPage(1);
                }}
                className="h-[32px] px-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10 text-[13px] text-foam-50 outline-none cursor-pointer"
              >
                <option value="">Todas as raças</option>
                {RACES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  className="h-[32px] text-[12px]"
                  icon={<RotateCcw size={13} />}
                  onClick={clearAllFilters}
                >
                  Limpar filtros
                </Button>
              )}
            </div>

            {/* Tabela de Personagens */}
            <div className="flex flex-col">
              <DataTable
                columns={columns}
                data={data.items}
                keyExtractor={(c) => c.id}
                loading={loading}
                onRowClick={(c) => setSelectedChar(c)}
                selectedId={selectedChar?.id}
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

        {/* SUB-ABA 3: NOVO PERSONAGEM */}
        {activeTab === 'create' && (
          <div className="surface p-6 rounded-[var(--radius-ctl)] border border-[var(--border-app)] max-w-[640px] flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h3 className="text-[16px] font-semibold text-foam-50">Criar Novo Personagem</h3>
              <p className="text-[13px] text-[var(--text-secondary)]">
                Associe a uma conta Ankama cadastrada. O e-mail da conta será herdado automaticamente.
              </p>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <TextField
                label="Nome do personagem"
                placeholder="ex: Kurogane"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoFocus
              />

              <SelectField
                label="Conta Ankama de destino"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                options={state.accounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.login} (${acc.status === 'B' ? 'Banida' : 'Ativa'})`,
                }))}
              />

              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[13px] font-medium text-foam-300">
                  Email vinculado (herdado automaticamente)
                </label>
                <input
                  type="text"
                  readOnly
                  value={inheritedEmailInModal?.address || 'Nenhum email vinculado'}
                  className="h-[40px] px-3.5 bg-black/40 border border-white/10 rounded-[var(--radius-ctl)] text-[14px] font-mono text-foam-500 cursor-not-allowed select-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="Raça"
                  value={newRace}
                  onChange={(e) => setNewRace(e.target.value)}
                  options={RACES.map((r) => ({ value: r, label: r }))}
                />
                <SelectField
                  label="Servidor"
                  value={newServer}
                  onChange={(e) => setNewServer(e.target.value)}
                  options={SERVERS.map((s) => ({ value: s, label: s }))}
                />
              </div>

              <div className="flex justify-end pt-3 border-t border-white/5">
                <Button variant="primary" type="submit">
                  Criar personagem
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* SUB-ABA 4: PROGRESSO & METAS */}
        {activeTab === 'progress' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Criados (C)</span>
                <span className="text-[28px] font-bold text-foam-50 tabular-nums">
                  {state.characters.filter((c) => c.status === 'C').length}
                </span>
                <span className="text-[12px] text-[var(--text-secondary)]">Recém-criados / Prontos para início</span>
              </div>

              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Em Progresso (E)</span>
                <span className="text-[28px] font-bold text-ok tabular-nums">
                  {state.characters.filter((c) => c.status === 'E').length}
                </span>
                <span className="text-[12px] text-[var(--text-secondary)]">Em evolução e rotas de coleta</span>
              </div>

              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Finalizados (F)</span>
                <span className="text-[28px] font-bold text-[var(--accent-gold)] tabular-nums">
                  {state.characters.filter((c) => c.status === 'F').length}
                </span>
                <span className="text-[12px] text-[var(--text-secondary)]">Metas alcançadas</span>
              </div>
            </div>
          </div>
        )}
      </OperationalWorkspace>

      {/* Painel lateral de detalhes */}
      <SidePanel
        isOpen={Boolean(selectedChar)}
        onClose={() => setSelectedChar(null)}
        title="Detalhes do Personagem"
      >
        {selectedChar && (
          <div className="flex flex-col gap-6 text-[14px]">
            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase">Status</span>
              <div>
                <StatusBadge status={selectedChar.status} type="character" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase">Nome</span>
              <span className="font-semibold text-foam-50 text-[18px]">{selectedChar.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[var(--text-tertiary)] text-[12px] uppercase">Raça</span>
                <span className="text-foam-50 font-medium">{selectedChar.race}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[var(--text-tertiary)] text-[12px] uppercase">Servidor</span>
                <span className="text-foam-50 font-medium">{selectedChar.server}</span>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Modal de Cadastro Manual com SUB-ABAS (Organizado para não ficar cheio) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar Novo Personagem"
        description="Defina a identidade e associe à conta Ankama"
        maxWidth="560px"
        headerTabs={
          <ModalTabs
            activeTab={createModalTab}
            onChange={(t) => setCreateModalTab(t as typeof createModalTab)}
            tabs={[
              { id: 'identity', label: 'Identidade & Servidor', icon: Sparkles },
              { id: 'account', label: 'Conta & E-mail', icon: UserCheck },
              { id: 'role', label: 'Função Operacional', icon: Sliders },
            ]}
          />
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="button" onClick={handleCreateSubmit}>
              Criar personagem
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-[14px]">
          {createModalTab === 'identity' && (
            <div className="flex flex-col gap-4">
              <TextField
                label="Nome do personagem"
                placeholder="ex: Kurogane"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoFocus
              />
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="Raça"
                  value={newRace}
                  onChange={(e) => setNewRace(e.target.value)}
                  options={RACES.map((r) => ({ value: r, label: r }))}
                />
                <SelectField
                  label="Servidor"
                  value={newServer}
                  onChange={(e) => setNewServer(e.target.value)}
                  options={SERVERS.map((s) => ({ value: s, label: s }))}
                />
              </div>
            </div>
          )}

          {createModalTab === 'account' && (
            <div className="flex flex-col gap-4">
              <SelectField
                label="Conta Ankama de destino"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                options={state.accounts.map((acc) => ({
                  value: acc.id,
                  label: `${acc.login} (${acc.status === 'B' ? 'Banida' : 'Ativa'})`,
                }))}
              />
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[13px] font-medium text-foam-300">
                  Email vinculado (herdado automaticamente)
                </label>
                <input
                  type="text"
                  readOnly
                  value={inheritedEmailInModal?.address || 'Nenhum email vinculado'}
                  className="h-[40px] px-3.5 bg-black/40 border border-white/10 rounded-[var(--radius-ctl)] text-[14px] font-mono text-foam-500 cursor-not-allowed select-all"
                />
              </div>
            </div>
          )}

          {createModalTab === 'role' && (
            <div className="flex flex-col gap-3 text-[13px] text-[var(--text-secondary)]">
              <div className="p-3 rounded-[var(--radius-ctl)] bg-white/5 border border-white/10 flex items-center gap-2 text-ok">
                <CheckCircle2 size={16} />
                <span>Nível inicial padrão: Nível 1 (Iniciante de Astrub)</span>
              </div>
              <p>
                O personagem será registrado com status Criado (C) e integrado imediatamente aos filtros de grupos e rotas automáticas.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
