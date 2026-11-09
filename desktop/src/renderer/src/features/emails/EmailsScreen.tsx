import React, { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { useEmails } from '../../hooks/useDataHooks';
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
} from '../../components/ui/Fields';
import { SidePanel } from '../../components/layout/SidePanel';
import { Modal } from '../../components/ui/Modal';
import { ModalTabs } from '../../components/ui/ModalTabs';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { EmailRecord, EmailStatus } from '../../types/domain';
import {
  BarChart3,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Inbox,
  Mail,
  Plus,
  ShoppingBag,
  Sliders,
  Upload,
} from 'lucide-react';
import { OperationalWorkspace } from '../../components/layout/OperationalWorkspace';

export type EmailTab = 'overview' | 'stock' | 'import' | 'purchase' | 'metrics';

interface EmailsScreenProps {
  initialTab?: EmailTab;
}

export const EmailsScreen: React.FC<EmailsScreenProps> = ({ initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState<EmailTab>(initialTab);
  const { showToast } = useToast();

  // Estados da aba Estoque
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 8; // 8 por página (Seção 7.2)

  const { data, loading, refetch, createEmail, setEmailStatus, purchaseEmails, balance } = useEmails({
    q: search,
    status: statusFilter,
    page,
    pageSize,
  });

  const { state, dispatch } = useAppStore();

  // Contadores para badges e KPIs
  const totalEmails = state.emails.length;
  const availableEmails = state.emails.filter((e) => e.status === 'D').length;
  const usedEmails = state.emails.filter((e) => e.status === 'U').length;
  const blockedEmails = state.emails.filter((e) => e.status === 'B').length;

  // Painel lateral de detalhes do email
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [revealedPassword, setRevealedPassword] = useState(false);

  // Modal de cadastro manual
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [manualOrigin, setManualOrigin] = useState('Cadastro Manual');

  // Modal de importação com sub-abas
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importModalTab, setImportModalTab] = useState<'summary' | 'batch' | 'sample'>('summary');

  // Estados de compras simuladas
  const [purchaseQty, setPurchaseQty] = useState(20);
  const [isConfirmPurchaseOpen, setIsConfirmPurchaseOpen] = useState(false);
  const unitPrice = 1.25;
  const totalCost = purchaseQty * unitPrice;
  const balanceAfter = balance - totalCost;

  // Fechar painel lateral e resetar senha oculta
  const handleCloseSidePanel = () => {
    setSelectedEmail(null);
    setRevealedPassword(false);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copiado para a área de transferência.`);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress) return;
    await createEmail({
      address: manualAddress,
      origin: manualOrigin,
      password: manualPassword || 'Sec#Pass99',
    });
    showToast('Email cadastrado com sucesso!');
    setIsManualModalOpen(false);
    setManualAddress('');
    setManualPassword('');
    refetch();
  };

  const handleConfirmPurchase = async () => {
    if (balanceAfter < 0) {
      showToast('Saldo insuficiente para esta compra simulada.', 'error');
      return;
    }
    await purchaseEmails(purchaseQty);
    showToast(`Compra simulada de ${purchaseQty} emails confirmada!`, 'success');
    setIsConfirmPurchaseOpen(false);
    refetch();
  };

  // Colunas da tabela de Estoque
  const columns: Column<EmailRecord>[] = [
    {
      key: 'address',
      header: 'Email',
      cell: (e) => <span className="font-mono text-foam-50 font-medium">{e.address}</span>,
    },
    {
      key: 'origin',
      header: 'Origem',
      cell: (e) => <span className="text-foam-300 text-[13px]">{e.origin}</span>,
    },
    {
      key: 'purchasedAt',
      header: 'Data da compra',
      cell: (e) => (
        <span className="text-foam-500 tabular-nums text-[13px]">
          {new Date(e.purchasedAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (e) => <StatusBadge status={e.status} type="email" />,
    },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      cell: (e) => (
        <RowActionsMenu
          items={[
            {
              label: 'Ver detalhes',
              onClick: () => {
                setSelectedEmail(e);
                setRevealedPassword(false);
              },
            },
            {
              label: e.status === 'B' ? 'Desbloquear email' : 'Bloquear email',
              onClick: async () => {
                const nextStatus: EmailStatus = e.status === 'B' ? 'D' : 'B';
                await setEmailStatus(e.id, nextStatus);
                showToast(`Email ${nextStatus === 'B' ? 'bloqueado' : 'desbloqueado'}.`);
                refetch();
              },
            },
            {
              label: 'Copiar email',
              onClick: () => handleCopy(e.address, 'Email'),
            },
          ]}
        />
      ),
    },
  ];

  // Itens do Rail Lateral do Workspace
  const workspaceItems = [
    {
      value: 'overview' as const,
      label: 'Visão Geral',
      icon: Inbox,
    },
    {
      value: 'stock' as const,
      label: 'Estoque',
      icon: Mail,
      badge: availableEmails,
      badgeTone: availableEmails > 0 ? ('success' as const) : ('warning' as const),
    },
    {
      value: 'import' as const,
      label: 'Importar & Cadastrar',
      icon: Upload,
    },
    {
      value: 'purchase' as const,
      label: 'Compras',
      icon: ShoppingBag,
    },
    {
      value: 'metrics' as const,
      label: 'Indicadores',
      icon: BarChart3,
    },
  ];

  return (
    <>
      <OperationalWorkspace
        items={workspaceItems}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Gestão de E-mails"
        headerTitle="Gestão e Estoque de E-mails"
        headerDescription="Controle de caixas postais, credenciais disponíveis, importação em lote e aquisição"
        onRefresh={refetch}
        isRefreshing={loading}
        lastUpdatedAt={new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        statusNode={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-[var(--radius-tag)] bg-[#4CC38A]/15 text-[#4CC38A] border border-[#4CC38A]/30 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#4CC38A] animate-pulse" />
              ApiMail Online
            </span>
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-tag)] bg-white/10 text-[var(--text-secondary)]">
              Saldo: R$ {balance.toFixed(2).replace('.', ',')}
            </span>
          </div>
        }
        bottom={
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span>Disponíveis:</span>
              <strong className="text-ok font-mono">{availableEmails}</strong>
            </div>
            <div className="flex justify-between">
              <span>Em uso:</span>
              <strong className="text-[var(--text-primary)] font-mono">{usedEmails}</strong>
            </div>
            <div className="flex justify-between">
              <span>Bloqueados:</span>
              <strong className="text-bad font-mono">{blockedEmails}</strong>
            </div>
          </div>
        }
      >
        {/* SUB-ABA 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Strip de Métricas Consolidadas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Saldo em Carteira
                </span>
                <span className="text-[22px] font-bold text-foam-50 tabular-nums">
                  R$ {balance.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Saldo simulado ApiMail</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Estoque Disponível
                </span>
                <span className="text-[22px] font-bold text-ok tabular-nums">
                  {availableEmails}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Prontos para vincular ('D')</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Caixas em Uso
                </span>
                <span className="text-[22px] font-bold text-foam-50 tabular-nums">
                  {usedEmails}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Vinculados a contas Ankama</span>
              </div>

              <div className="surface p-4 rounded-[var(--radius-ctl)] flex flex-col gap-1 border border-[var(--border-app)]">
                <span className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.05em]">
                  Total no Histórico
                </span>
                <span className="text-[22px] font-bold text-foam-50 tabular-nums">
                  {totalEmails}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">Desde o início da operação</span>
              </div>
            </div>

            {/* Painel de Prontidão e Ações Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Prontidão da Infraestrutura de E-mails
                </h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  O fluxo automático de criação de contas consome e-mails disponíveis no estoque.
                </p>
                <div className="flex flex-col gap-2 mt-2 text-[13px]">
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-[var(--text-secondary)]">Serviço ApiMail</span>
                    <span className="font-semibold text-ok flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Ativo & Conectado
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <span className="text-[var(--text-secondary)]">Caixa de Entrada IMAP/POP3</span>
                    <span className="font-semibold text-ok flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Pronto para Leitura de Códigos
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-[var(--text-secondary)]">Capacidade para Novas Contas</span>
                    <span className="font-semibold text-foam-50">{availableEmails} slots livres</span>
                  </div>
                </div>
              </div>

              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Ações Rápidas</h3>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    Abasteça o estoque ou consulte as contas ativas.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="primary"
                    icon={<FileUp size={15} />}
                    onClick={() => setActiveTab('import')}
                    className="flex-1"
                  >
                    Importar novo lote
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<ShoppingBag size={15} />}
                    onClick={() => setActiveTab('purchase')}
                    className="flex-1"
                  >
                    Comprar simulado
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-ABA 2: ESTOQUE */}
        {activeTab === 'stock' && (
          <div className="flex flex-col gap-4">
            {/* Toolbar com Filtros */}
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
                  placeholder="Buscar por endereço ou origem..."
                />
                <SegmentedControl
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'D', label: 'Disponível' },
                    { value: 'U', label: 'Utilizado' },
                    { value: 'B', label: 'Bloqueado' },
                  ]}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  icon={<FileUp size={16} />}
                  onClick={() => setIsImportModalOpen(true)}
                >
                  Importar lote
                </Button>
                <Button
                  variant="primary"
                  icon={<Plus size={16} />}
                  onClick={() => setIsManualModalOpen(true)}
                >
                  Cadastrar email
                </Button>
              </div>
            </div>

            {/* Tabela de Estoque */}
            <div className="flex flex-col">
              <DataTable
                columns={columns}
                data={data.items}
                keyExtractor={(e) => e.id}
                loading={loading}
                onRowClick={(e) => {
                  setSelectedEmail(e);
                  setRevealedPassword(false);
                }}
                selectedId={selectedEmail?.id}
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

        {/* SUB-ABA 3: IMPORTAR & CADASTRAR */}
        {activeTab === 'import' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Cadastro Manual */}
            <div className="surface p-6 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-[16px] font-semibold text-foam-50">Cadastro Manual Unitário</h3>
                <p className="text-[13px] text-[var(--text-secondary)]">Adicione uma credencial de e-mail avulsa ao estoque</p>
              </div>
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                <TextField
                  label="Endereço de email"
                  placeholder="ex: operador@mailbox.test"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  required
                />
                <PasswordField
                  label="Senha"
                  placeholder="Senha de acesso"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  helperText="A senha será armazenada de forma segura e oculta por padrão"
                />
                <TextField
                  label="Origem / Fornecedor"
                  placeholder="ex: Cadastro Manual"
                  value={manualOrigin}
                  onChange={(e) => setManualOrigin(e.target.value)}
                />
                <div className="flex justify-end pt-2">
                  <Button variant="primary" type="submit">
                    Cadastrar e salvar
                  </Button>
                </div>
              </form>
            </div>

            {/* Importação em Lote */}
            <div className="surface p-6 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-[16px] font-semibold text-foam-50">Importação em Lote (TXT / CSV)</h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Carregue um arquivo com múltiplas linhas no padrão <code className="text-foam-50">email:senha</code>.
                </p>
              </div>

              <div
                onClick={() => setIsImportModalOpen(true)}
                className="border-2 border-dashed border-[var(--border-app)] hover:border-[var(--accent-gold)]/60 rounded-[var(--radius-ctl)] p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-black/10 hover:bg-black/20"
              >
                <div className="size-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--accent-gold)]">
                  <FileUp size={24} />
                </div>
                <div className="text-center">
                  <span className="text-[14px] font-semibold text-foam-50 block">
                    Clique para abrir o assistente de importação
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)] mt-1 block">
                    Prévia detalhada, verificação de duplicidades e correção de formato
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-ABA 4: COMPRAS SIMULADAS */}
        {activeTab === 'purchase' && (
          <div className="flex flex-col gap-6 max-w-[800px]">
            <div className="surface p-6 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-[16px] font-semibold text-foam-50">Comprar Lote de E-mails (Simulação)</h3>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Aquisição fictícia para testes do pipeline. Nenhum valor monetário real será debitado.
                </p>
              </div>

              {/* Seletor de Quantidade */}
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-[var(--text-secondary)]">Quantidade de e-mails</label>
                <div className="flex items-center gap-3">
                  {[10, 20, 50, 100].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setPurchaseQty(qty)}
                      className={`flex-1 py-3 px-4 rounded-[var(--radius-ctl)] border text-[14px] font-semibold transition-all ${
                        purchaseQty === qty
                          ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-foam-50'
                          : 'border-[var(--border-app)] bg-black/20 text-[var(--text-secondary)] hover:text-foam-50'
                      }`}
                    >
                      {qty} emails
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumo Financeiro */}
              <div className="p-4 rounded-[var(--radius-ctl)] bg-black/30 border border-white/5 flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Preço unitário:</span>
                  <span className="font-mono">R$ {unitPrice.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Custo total estimado:</span>
                  <span className="font-mono font-semibold text-foam-50">
                    R$ {totalCost.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)] pt-2 border-t border-white/5">
                  <span>Saldo disponível:</span>
                  <span className="font-mono">R$ {balance.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Saldo pós-compra:</span>
                  <span className={`font-mono font-semibold ${balanceAfter < 0 ? 'text-bad' : 'text-ok'}`}>
                    R$ {balanceAfter.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => setIsConfirmPurchaseOpen(true)}
                disabled={balanceAfter < 0}
                className="w-full h-[42px]"
              >
                Confirmar compra simulada ({purchaseQty} e-mails)
              </Button>
            </div>
          </div>
        )}

        {/* SUB-ABA 5: INDICADORES */}
        {activeTab === 'metrics' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Disponibilidade</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-bold text-ok tabular-nums">
                    {totalEmails ? Math.round((availableEmails / totalEmails) * 100) : 0}%
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)]">do estoque livre</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-ok transition-all duration-500"
                    style={{ width: `${totalEmails ? (availableEmails / totalEmails) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Taxa de Utilização</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-bold text-foam-50 tabular-nums">
                    {totalEmails ? Math.round((usedEmails / totalEmails) * 100) : 0}%
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)]">vinculados a contas</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-foam-50 transition-all duration-500"
                    style={{ width: `${totalEmails ? (usedEmails / totalEmails) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="surface p-5 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">Taxa de Bloqueio</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-bold text-bad tabular-nums">
                    {totalEmails ? Math.round((blockedEmails / totalEmails) * 100) : 0}%
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)]">marcados como impróprios</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-bad transition-all duration-500"
                    style={{ width: `${totalEmails ? (blockedEmails / totalEmails) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </OperationalWorkspace>

      {/* Painel Lateral de Detalhes do Email Selecionado */}
      <SidePanel
        isOpen={Boolean(selectedEmail)}
        onClose={handleCloseSidePanel}
        title="Detalhes do Email"
      >
        {selectedEmail && (
          <div className="flex flex-col gap-6 text-[14px]">
            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Status Atual</span>
              <div>
                <StatusBadge status={selectedEmail.status} type="email" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Endereço</span>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10 font-mono text-foam-50 select-all">
                <span className="truncate">{selectedEmail.address}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedEmail.address, 'Endereço')}
                  className="p-1 text-[var(--text-secondary)] hover:text-foam-50"
                  title="Copiar"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Senha de Acesso</span>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10">
                <span className="font-mono text-foam-50 tracking-wider">
                  {revealedPassword ? selectedEmail.password || 'K9#mQ001!xZ' : '••••••••••'}
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
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Origem</span>
              <span className="text-foam-50 font-medium">{selectedEmail.origin}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[var(--text-tertiary)] text-[12px] uppercase tracking-wider">Data de Cadastro</span>
              <span className="text-[var(--text-secondary)] tabular-nums">
                {new Date(selectedEmail.purchasedAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Modal de Cadastro Manual Avulso */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Cadastrar Novo Email"
        maxWidth="460px"
      >
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
          <TextField
            label="Endereço de email"
            placeholder="usuario@mailbox.test"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            required
            autoFocus
          />
          <PasswordField
            label="Senha"
            placeholder="Senha de acesso"
            value={manualPassword}
            onChange={(e) => setManualPassword(e.target.value)}
            helperText="A senha ficará oculta por padrão até clique em Revelar"
          />
          <TextField
            label="Origem"
            placeholder="Cadastro Manual"
            value={manualOrigin}
            onChange={(e) => setManualOrigin(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsManualModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Cadastrar email
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Importação com SUB-ABAS (Organizado para não ficar cheio) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importação de E-mails em Lote"
        description="Validação estruturada de linhas e descarte de duplicidades"
        maxWidth="640px"
        headerTabs={
          <ModalTabs
            activeTab={importModalTab}
            onChange={(tab) => setImportModalTab(tab as typeof importModalTab)}
            tabs={[
              { id: 'summary', label: 'Resumo e Validação', icon: CheckCircle2 },
              { id: 'sample', label: 'Amostragem de Linhas', icon: FileText, badge: 5 },
              { id: 'batch', label: 'Configuração do Lote', icon: Sliders },
            ]}
          />
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({
                  type: 'IMPORT_EMAILS',
                  payload: {
                    emails: Array.from({ length: 48 }, (_, i) => ({
                      address: `batch.import.${i + 1}@mailbox.test`,
                      origin: 'Lote_Fornecedor_Alpha.csv',
                      password: `Batch#${i + 100}`,
                    })),
                  },
                });
                showToast('48 emails importados com sucesso para o estoque!');
                setIsImportModalOpen(false);
                refetch();
              }}
            >
              Importar 48 emails válidos
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-[14px]">
          {/* Sub-Aba 1: Resumo */}
          {importModalTab === 'summary' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-[var(--radius-ctl)] bg-white/[0.04] border border-white/10 flex items-center justify-between text-[13px] select-none">
                <span className="font-semibold text-ok">48 válidos detectados</span>
                <span className="text-foam-500">·</span>
                <span className="font-medium text-warn">2 duplicados</span>
                <span className="text-foam-500">·</span>
                <span className="font-medium text-bad">1 inválido descartado</span>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                As credenciais foram analisadas contra o padrão RFC e o histórico local. Linhas duplicadas ou inválidas são ignoradas automaticamente sem interromper o lote.
              </p>
            </div>
          )}

          {/* Sub-Aba 2: Amostragem */}
          {importModalTab === 'sample' && (
            <div className="flex flex-col border border-white/10 rounded-[var(--radius-ctl)] overflow-hidden">
              {[
                { email: 'import.alpha.001@mailbox.test', status: 'Válido', ok: true },
                { email: 'import.alpha.002@mailbox.test', status: 'Válido', ok: true },
                { email: 'import.alpha.003@mailbox.test', status: 'Válido', ok: true },
                { email: 'email_sem_dominio_correto', status: 'Inválido: formato incorreto', ok: false },
                { email: 'import.alpha.004@mailbox.test', status: 'Válido', ok: true },
              ].map((row, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 px-3 flex items-center justify-between text-[13px] border-b border-white/5 last:border-0 ${
                    row.ok ? 'text-foam-50' : 'bg-bad/15 text-bad'
                  }`}
                >
                  <span className="font-mono">{row.email}</span>
                  <span className="font-medium text-[12px]">{row.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sub-Aba 3: Configuração */}
          {importModalTab === 'batch' && (
            <div className="flex flex-col gap-3">
              <TextField
                label="Identificador do lote"
                value="Lote_Fornecedor_Alpha.csv"
                readOnly
              />
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">Política de senhas</span>
                <span className="text-[13px] text-foam-50">Preservar senhas originais do arquivo importado</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirmação de Compra Simulada */}
      <ConfirmDialog
        isOpen={isConfirmPurchaseOpen}
        onClose={() => setIsConfirmPurchaseOpen(false)}
        onConfirm={handleConfirmPurchase}
        title="Confirmar compra simulada?"
        description={`Você está simulando a aquisição de ${purchaseQty} emails por R$ ${totalCost.toFixed(2).replace('.', ',')}. Nenhum valor monetário real será debitado.`}
        confirmLabel="Confirmar compra"
        destructive={false}
      />
    </>
  );
};
