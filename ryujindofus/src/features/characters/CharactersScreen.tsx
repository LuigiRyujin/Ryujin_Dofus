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
  FilterChip,
} from '../../components/ui/Fields';
import { SidePanel } from '../../components/layout/SidePanel';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Character, CharacterStatus } from '../../types/domain';
import { Plus, RotateCcw } from 'lucide-react';

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

export const CharactersScreen: React.FC = () => {
  const { state } = useAppStore();
  const { showToast } = useToast();

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

  // Painel lateral de detalhes
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);

  // Modal de cadastro manual
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(state.accounts[0]?.id || '');
  const [newRace, setNewRace] = useState(RACES[0]);
  const [newServer, setNewServer] = useState(SERVERS[0]);

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
      header: 'Nome',
      cell: (char) => <span className="font-semibold text-foam-50">{char.name}</span>,
    },
    {
      key: 'account',
      header: 'Conta Ankama',
      cell: (char) => (
        <span className="text-foam-300 font-medium text-[13px]">
          {getAccountInfo(char.accountId).login}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email vinculado',
      cell: (char) => (
        <span className="font-mono text-foam-500 text-[13px]">
          {getAccountInfo(char.accountId).email}
        </span>
      ),
    },
    {
      key: 'race',
      header: 'Raça',
      cell: (char) => <span className="text-foam-300 text-[13px]">{char.race}</span>,
    },
    {
      key: 'server',
      header: 'Servidor',
      cell: (char) => <span className="text-foam-300 text-[13px]">{char.server}</span>,
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
              label: 'Alterar para Criado (C)',
              disabled: char.status === 'C',
              onClick: () => handleStatusChange(char.id, 'C'),
            },
            {
              label: 'Alterar para Em Progresso (E)',
              disabled: char.status === 'E',
              onClick: () => handleStatusChange(char.id, 'E'),
            },
            {
              label: 'Alterar para Finalizado (F)',
              disabled: char.status === 'F',
              onClick: () => handleStatusChange(char.id, 'F'),
            },
            {
              label: 'Alterar para Banido (B)',
              destructive: true,
              disabled: char.status === 'B',
              onClick: () => handleStatusChange(char.id, 'B'),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
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
              placeholder="Buscar por nome do personagem..."
            />

            {/* Selects rápidos */}
            <select
              value={selectedRace}
              onChange={(e) => {
                setSelectedRace(e.target.value);
                setPage(1);
              }}
              className="h-[38px] px-3 bg-[#0A1626] border border-[#2E4864] rounded-[var(--radius-ctl)] text-[13px] text-foam-50 focus:outline-none focus:border-biolum-400"
            >
              <option value="">Todas as raças</option>
              {RACES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              value={selectedServer}
              onChange={(e) => {
                setSelectedServer(e.target.value);
                setPage(1);
              }}
              className="h-[38px] px-3 bg-[#0A1626] border border-[#2E4864] rounded-[var(--radius-ctl)] text-[13px] text-foam-50 focus:outline-none focus:border-biolum-400"
            >
              <option value="">Todos os servidores</option>
              {SERVERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as CharacterStatus | 'all');
                setPage(1);
              }}
              className="h-[38px] px-3 bg-[#0A1626] border border-[#2E4864] rounded-[var(--radius-ctl)] text-[13px] text-foam-50 focus:outline-none focus:border-biolum-400"
            >
              <option value="all">Todos os status</option>
              <option value="C">Criado (C)</option>
              <option value="E">Em Progresso (E)</option>
              <option value="F">Finalizado (F)</option>
              <option value="B">Banido (B)</option>
            </select>
          </div>

          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              if (state.accounts.length === 0) {
                showToast('Cadastre uma conta Ankama antes de criar um personagem.', 'error');
                return;
              }
              setIsCreateModalOpen(true);
            }}
          >
            Criar personagem
          </Button>
        </div>

        {/* Chips de filtros ativos (Seção 7.4) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 select-none">
            {search && (
              <FilterChip label="Busca" value={search} onRemove={() => setSearch('')} />
            )}
            {selectedRace && (
              <FilterChip
                label="Raça"
                value={selectedRace}
                onRemove={() => setSelectedRace('')}
              />
            )}
            {selectedServer && (
              <FilterChip
                label="Servidor"
                value={selectedServer}
                onRemove={() => setSelectedServer('')}
              />
            )}
            {selectedStatus !== 'all' && (
              <FilterChip
                label="Status"
                value={
                  selectedStatus === 'C'
                    ? 'Criado'
                    : selectedStatus === 'E'
                    ? 'Em progresso'
                    : selectedStatus === 'F'
                    ? 'Finalizado'
                    : 'Banido'
                }
                onRemove={() => setSelectedStatus('all')}
              />
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-[12px] text-biolum-400 hover:underline px-2 py-1 ml-1"
            >
              <RotateCcw size={12} />
              <span>Limpar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Personagens */}
      <div className="flex flex-col">
        <DataTable
          columns={columns}
          data={data.items}
          keyExtractor={(char) => char.id}
          loading={loading}
          onRowClick={(char) => setSelectedChar(char)}
          selectedId={selectedChar?.id}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
        />
      </div>

      {/* Painel Lateral com Detalhes e Edição Administrativa (Seção 7.4) */}
      <SidePanel
        isOpen={Boolean(selectedChar)}
        onClose={() => setSelectedChar(null)}
        title="Detalhes do Personagem"
        subtitle={selectedChar?.name}
      >
        {selectedChar && (
          <div className="flex flex-col gap-5 text-[14px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-foam-300">Status atual</span>
              <StatusBadge status={selectedChar.status} type="character" />
            </div>

            {/* Select "Alterar status" administrativo (qualquer transição permitida) */}
            <div className="flex flex-col gap-2 p-3.5 rounded-[var(--radius-ctl)] bg-white/[0.04] border border-white/10">
              <span className="text-foam-300 font-semibold text-[13px]">
                Edição Administrativa de Status
              </span>
              <SelectField
                label="Alterar status do personagem"
                value={selectedChar.status}
                onChange={(e) =>
                  handleStatusChange(selectedChar.id, e.target.value as CharacterStatus)
                }
                options={[
                  { value: 'C', label: 'C — Criado (nunca carregado pelo AnkaBot)' },
                  { value: 'E', label: 'E — Em Progresso (já carregado pelo AnkaBot)' },
                  { value: 'F', label: 'F — Finalizado (fluxo concluído)' },
                  { value: 'B', label: 'B — Banido' },
                ]}
                helperText="Qualquer transição individual é permitida administrativamente nesta fase."
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Nome do Personagem</span>
              <span className="font-semibold text-foam-50 text-[16px]">{selectedChar.name}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Conta Ankama Vinculada</span>
              <span className="text-foam-50 font-medium">
                {getAccountInfo(selectedChar.accountId).login}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Email Vinculado (Herdado da conta)</span>
              <span className="font-mono text-foam-300 text-[13px]">
                {getAccountInfo(selectedChar.accountId).email}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-foam-500 text-[12px] uppercase">Raça</span>
                <span className="text-foam-50">{selectedChar.race}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-foam-500 text-[12px] uppercase">Servidor</span>
                <span className="text-foam-50">{selectedChar.server}</span>
              </div>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Modal de Cadastro Manual de Personagem */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Criar Novo Personagem"
        maxWidth="460px"
      >
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

          {/* Email herdado automaticamente da conta (somente leitura - Seção 7.4) */}
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

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Criar personagem
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

