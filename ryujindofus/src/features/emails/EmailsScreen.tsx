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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { EmailRecord, EmailStatus } from '../../types/domain';
import {
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  FileUp,
  Lock,
  Plus,
  ShoppingBag,
  Unlock,
} from 'lucide-react';

export type EmailTab = 'stock' | 'import' | 'purchase' | 'metrics';

interface EmailsScreenProps {
  initialTab?: EmailTab;
}

export const EmailsScreen: React.FC<EmailsScreenProps> = ({ initialTab = 'stock' }) => {
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

  // Painel lateral de detalhes do email
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [revealedPassword, setRevealedPassword] = useState(false);

  // Modal de cadastro manual
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [manualOrigin, setManualOrigin] = useState('Cadastro Manual');

  // Modal de importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

  return (
    <div className="flex flex-col gap-6">
      {/* Abas Superiores */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 select-none">
        {[
          { id: 'stock' as const, label: 'Estoque' },
          { id: 'import' as const, label: 'Importar e cadastrar' },
          { id: 'purchase' as const, label: 'Compras' },
          { id: 'metrics' as const, label: 'Indicadores' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-[var(--radius-ctl)] text-[14px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white/15 text-foam-50 shadow-sm'
                : 'text-foam-300 hover:text-foam-50 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. ABA ESTOQUE */}
      {activeTab === 'stock' && (
        <div className="flex flex-col gap-4">
          {/* Toolbar */}
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
                Importar
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

      {/* 2. ABA IMPORTAR E CADASTRAR */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Cadastro Manual */}
          <div className="surface corner-accent p-[22px] flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-[16px] font-semibold text-foam-50">Cadastro manual</h3>
              <p className="text-[13px] text-foam-500">Adicione um email unitário ao estoque</p>
            </div>
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <TextField
                label="Endereço de email"
                placeholder="operador@mailbox.test"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                required
              />
              <PasswordField
                label="Senha (opcional)"
                placeholder="Senha de acesso"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
              />
              <TextField
                label="Origem / Fornecedor"
                placeholder="Cadastro Manual"
                value={manualOrigin}
                onChange={(e) => setManualOrigin(e.target.value)}
              />
              <div className="pt-2">
                <Button type="submit" variant="primary" className="w-full">
                  Salvar email no estoque
                </Button>
              </div>
            </form>
          </div>

          {/* Importação via Arquivo */}
          <div className="surface corner-accent p-[22px] flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-[16px] font-semibold text-foam-50">Importação em lote</h3>
              <p className="text-[13px] text-foam-500">Suba um arquivo CSV com emails e senhas</p>
            </div>

            {/* Zona de arrastar arquivo */}
            <div
              onClick={() => setIsImportModalOpen(true)}
              className="border-2 border-dashed border-white/20 hover:border-biolum-400/60 rounded-[var(--radius-card)] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/[0.04]"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-foam-300 mb-3">
                <FileUp size={24} strokeWidth={1.5} />
              </div>
              <span className="text-[14px] font-medium text-foam-50 mb-1">
                Clique para selecionar ou arraste o arquivo CSV
              </span>
              <span className="text-[12px] text-foam-500">
                Formato suportado: email:senha ou email,senha (máx. 500 registros)
              </span>
            </div>

            <Button
              variant="secondary"
              onClick={() => setIsImportModalOpen(true)}
              className="w-full"
            >
              Abrir modal de prévia da importação
            </Button>
          </div>
        </div>
      )}

      {/* 3. ABA COMPRAS (SIMULADAS) */}
      {activeTab === 'purchase' && (
        <div className="flex flex-col gap-6 max-w-3xl">
          {/* Faixa permanente de compra simulada (Seção 7.2) */}
          <div className="p-4 rounded-[var(--radius-card)] bg-info/10 border border-info/30 flex items-center gap-3 text-info select-none">
            <AlertCircle size={20} className="shrink-0" strokeWidth={1.75} />
            <div className="flex flex-col">
              <strong className="text-[14px] font-semibold text-foam-50">
                Compra simulada: nenhum valor real será cobrado
              </strong>
              <span className="text-[12px] text-foam-300">
                Este ambiente opera exclusivamente com créditos e dados de teste para validação de fluxo.
              </span>
            </div>
          </div>

          <div className="surface corner-accent p-[22px] flex flex-col gap-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex flex-col">
                <span className="text-[13px] text-foam-500">Saldo disponível em conta</span>
                <span className="text-[28px] font-semibold text-foam-50 tabular-nums">
                  R$ {balance.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[13px] text-foam-500">Disponibilidade no fornecedor</span>
                <span className="text-[18px] font-semibold text-ok tabular-nums">
                  5.000 emails prontos
                </span>
              </div>
            </div>

            {/* Stepper de quantidade */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-foam-300">
                Quantidade de emails
              </label>
              <div className="flex items-center gap-3">
                {[10, 20, 50, 100].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setPurchaseQty(qty)}
                    className={`px-4 py-2 rounded-[var(--radius-ctl)] text-[14px] font-medium border transition-all ${
                      purchaseQty === qty
                        ? 'bg-foam-50 text-[#0B0D12] border-foam-50 font-semibold'
                        : 'bg-white/[0.06] text-foam-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {qty} emails
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo da Compra */}
            <div className="p-4 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10 flex flex-col gap-2 text-[14px]">
              <div className="flex justify-between text-foam-300">
                <span>Quantidade:</span>
                <span className="text-foam-50 font-medium tabular-nums">{purchaseQty} un.</span>
              </div>
              <div className="flex justify-between text-foam-300">
                <span>Preço unitário estimado:</span>
                <span className="text-foam-50 font-medium tabular-nums">
                  R$ {unitPrice.toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex justify-between text-foam-300 pt-2 border-t border-white/10">
                <strong className="text-foam-50">Total da compra:</strong>
                <strong className="text-foam-50 font-semibold tabular-nums">
                  R$ {totalCost.toFixed(2).replace('.', ',')}
                </strong>
              </div>
              <div className="flex justify-between text-foam-500 text-[13px]">
                <span>Saldo após a compra:</span>
                <span className="tabular-nums">
                  R$ {balanceAfter.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              icon={<ShoppingBag size={18} />}
              onClick={() => setIsConfirmPurchaseOpen(true)}
              disabled={balanceAfter < 0}
              className="w-full"
            >
              Confirmar compra (simulada)
            </Button>
          </div>
        </div>
      )}

      {/* 4. ABA INDICADORES */}
      {activeTab === 'metrics' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="surface corner-accent p-[22px] flex flex-col gap-2">
            <span className="text-[13px] text-foam-300 font-medium">Emails Disponíveis</span>
            <span className="text-[32px] font-semibold text-ok tabular-nums">
              {state.emails.filter((e) => e.status === 'D').length}
            </span>
            <span className="text-[12px] text-foam-500">Prontos para vincular a contas</span>
          </div>
          <div className="surface corner-accent p-[22px] flex flex-col gap-2">
            <span className="text-[13px] text-foam-300 font-medium">Emails Utilizados</span>
            <span className="text-[32px] font-semibold text-foam-300 tabular-nums">
              {state.emails.filter((e) => e.status === 'U').length}
            </span>
            <span className="text-[12px] text-foam-500">Vinculados a contas Ankama</span>
          </div>
          <div className="surface corner-accent p-[22px] flex flex-col gap-2">
            <span className="text-[13px] text-foam-300 font-medium">Emails Bloqueados</span>
            <span className="text-[32px] font-semibold text-bad tabular-nums">
              {state.emails.filter((e) => e.status === 'B').length}
            </span>
            <span className="text-[12px] text-foam-500">Restrição de segurança</span>
          </div>
        </div>
      )}

      {/* Painel Lateral de Detalhes (400px vidro) */}
      <SidePanel
        isOpen={Boolean(selectedEmail)}
        onClose={handleCloseSidePanel}
        title="Detalhes do Email"
        subtitle={selectedEmail?.address}
        footer={
          selectedEmail && (
            <Button
              variant="secondary"
              onClick={async () => {
                const nextStatus: EmailStatus = selectedEmail.status === 'B' ? 'D' : 'B';
                await setEmailStatus(selectedEmail.id, nextStatus);
                setSelectedEmail({ ...selectedEmail, status: nextStatus });
                showToast(`Email ${nextStatus === 'B' ? 'bloqueado' : 'desbloqueado'}.`);
                refetch();
              }}
            >
              {selectedEmail.status === 'B' ? 'Desbloquear email' : 'Bloquear email'}
            </Button>
          )
        }
      >
        {selectedEmail && (
          <div className="flex flex-col gap-5 text-[14px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-foam-300">Status atual</span>
              <StatusBadge status={selectedEmail.status} type="email" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Endereço</span>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10">
                <span className="font-mono text-foam-50 select-all">{selectedEmail.address}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedEmail.address, 'Email')}
                  title="Copiar endereço"
                  className="p-1 text-foam-500 hover:text-foam-50"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            {/* Credencial oculta com botão REVELAR (Seção 7.2) */}
            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Senha de Acesso</span>
              <div className="flex items-center justify-between p-2.5 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10">
                <span
                  className="font-mono text-foam-50 tracking-wider"
                  aria-live="polite"
                >
                  {revealedPassword
                    ? selectedEmail.password || 'K9#mQ001!xZ'
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
              <span className="text-foam-500 text-[12px] uppercase">Origem</span>
              <span className="text-foam-50">{selectedEmail.origin}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Data de cadastro / compra</span>
              <span className="text-foam-300 tabular-nums">
                {new Date(selectedEmail.purchasedAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        )}
      </SidePanel>

      {/* Modal de Cadastro Manual */}
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

      {/* Modal de Importação (560px) com prévia e resumo (Seção 7.2) */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Prévia da Importação em Lote"
        maxWidth="560px"
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
              Importar 48 emails
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-[14px]">
          {/* Resumo exigido pela especificação */}
          <div className="p-3.5 rounded-[var(--radius-ctl)] bg-white/[0.04] border border-white/10 flex items-center justify-between text-[13px] select-none">
            <span className="font-semibold text-ok">48 válidos</span>
            <span className="text-foam-500">·</span>
            <span className="font-medium text-warn">2 duplicados</span>
            <span className="text-foam-500">·</span>
            <span className="font-medium text-bad">1 inválido</span>
          </div>

          <span className="text-[12px] font-semibold text-foam-500 uppercase tracking-[0.05em]">
            Linhas de Prévia (amostragem)
          </span>

          {/* 5 linhas, uma com erro em vermelho */}
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
    </div>
  );
};

