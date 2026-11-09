import React, { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import {
  MetricStrip,
  BarChart,
  SegmentedBar,
  AttentionList,
  AttentionItem
} from '../../components/data/Charts';
import { DataTable, Column } from '../../components/data/DataTable';
import { OperationPill } from '../../components/ui/Badges';
import { Modal } from '../../components/ui/Modal';
import { ModalTabs } from '../../components/ui/ModalTabs';
import { Button } from '../../components/ui/Button';
import { Operation } from '../../types/domain';
import { NavRoute } from '../../components/layout/Sidebar';
import { Activity, CheckCircle2, Mail, Plus, Sliders, UserPlus } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface HomeScreenProps {
  onNavigate: (route: NavRoute) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { state, dispatch, metrics } = useAppStore();
  const { showToast } = useToast();
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [opModalTab, setOpModalTab] = useState<'status' | 'step' | 'action'>('status');

  // Dados do gráfico dos últimos 7 dias (Seção 7.1)
  const chartData = [
    { label: 'Seg', value: 18 },
    { label: 'Ter', value: 24 },
    { label: 'Qua', value: 21 },
    { label: 'Qui', value: 27, highlight: true },
    { label: 'Sex', value: 30 },
    { label: 'Sáb', value: 16 },
    { label: 'Dom', value: 22 }
  ];

  // Itens de atenção (Resultado incerto e Falhas)
  const attentionItems: AttentionItem[] = state.operations
    .filter((op) => op.state === 'uncertain' || op.state === 'failed')
    .map((op) => ({
      id: op.id,
      title: op.type === 'create_character' ? `Criação de Personagem: ${op.subject}` : `Criação de Conta: ${op.subject}`,
      severity: op.state === 'failed' ? 'bad' : 'warn',
      description: op.step,
      actionText: op.state === 'uncertain' ? 'Conciliar' : 'Ver detalhes',
      onClick: () => setSelectedOperation(op)
    }));

  // Colunas para a tabela de operações recentes
  const columns: Column<Operation>[] = [
    {
      key: 'type',
      header: 'Tipo',
      cell: (op) => {
        const labels: Record<string, string> = {
          create_account: 'Criar conta',
          create_character: 'Criar personagem',
          import_emails: 'Importar emails',
          purchase_emails: 'Comprar emails'
        };
        return <span className="font-medium text-[var(--text-primary)]">{labels[op.type] || op.type}</span>;
      }
    },
    {
      key: 'subject',
      header: 'Conta / Email',
      cell: (op) => <span className="text-[var(--text-secondary)] font-mono text-[13px]">{op.subject}</span>
    },
    {
      key: 'state',
      header: 'Estado',
      cell: (op) => <OperationPill state={op.state} />
    },
    {
      key: 'time',
      header: 'Hora',
      align: 'right',
      cell: (op) => (
        <span className="text-[var(--text-tertiary)] tabular-nums text-[13px]">
          {new Date(op.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Título e subtítulo da página */}
      <div className="flex flex-col gap-1 select-none">
        <h1
          className="text-[32px] font-semibold text-[var(--text-primary)] tracking-[-0.02em] leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Boa tarde, Ryujin
        </h1>
        <p className="text-[14px] font-normal text-[var(--text-secondary)]">
          Quinta-feira, 5 de novembro · 9 operações hoje, {attentionItems.length} precisam de atenção.
        </p>
      </div>

      {/* 2. Faixa de métricas: Um único bloco de vidro com 4 células derivadas */}
      <MetricStrip
        metrics={[
          {
            label: 'Emails disponíveis',
            value: metrics.availableEmails,
            variation: 4
          },
          {
            label: 'Contas Ankama',
            value: metrics.accountsCount,
            variation: 2
          },
          {
            label: 'Personagens em progresso',
            value: metrics.charactersInProgress,
            variation: 9
          },
          {
            label: 'Fluxos finalizados',
            value: metrics.finishedCharacters,
            variation: 3
          }
        ]}
      />

      {/* 3. Grade 8 / 4 Colunas (gap 24px) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: 8 Colunas */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Card: Operações nos últimos 7 dias */}
          <div className="surface card-corners p-[22px] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
                Operações nos últimos 7 dias
              </h3>
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em]">
                HISTÓRICO SEMANAL
              </span>
            </div>
            <BarChart data={chartData} totalLabel="Total: 158 operações" />
          </div>

          {/* Card: Operações recentes (tabela) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
                Operações recentes
              </h3>
              <span className="text-[12px] text-[var(--text-tertiary)]">
                Clique na linha para ver detalhes
              </span>
            </div>
            <DataTable
              columns={columns}
              data={state.operations.slice(0, 5)}
              keyExtractor={(op) => op.id}
              onRowClick={(op) => setSelectedOperation(op)}
            />
          </div>
        </div>

        {/* Coluna Direita: 4 Colunas */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card: Requer atenção (em primeiro lugar) */}
          <div className="surface card-corners p-[22px] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">Requer atenção</h3>
              <span className="text-[12px] font-semibold text-[var(--status-warn)] tabular-nums bg-[var(--status-warn)]/15 px-2 py-0.5 rounded-full">
                {attentionItems.length}
              </span>
            </div>
            <AttentionList items={attentionItems} />
          </div>

          {/* Card: Personagens por status */}
          <div className="surface card-corners p-[22px] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
                Personagens por status
              </h3>
              <span className="text-[13px] font-semibold text-[var(--text-primary)] tabular-nums">
                Total: {metrics.totalCharacters}
              </span>
            </div>
            <SegmentedBar
              total={metrics.totalCharacters}
              segments={[
                { label: 'Criado', count: metrics.charactersByStatus.C, color: 'bg-white/40' },
                { label: 'Em progresso', count: metrics.charactersByStatus.E, color: 'bg-[var(--status-info)]' },
                { label: 'Finalizado', count: metrics.charactersByStatus.F, color: 'bg-[var(--status-ok)]' },
                { label: 'Banido', count: metrics.charactersByStatus.B, color: 'bg-[var(--status-bad)]' }
              ]}
            />
          </div>

          {/* Card: Atalhos rápidos */}
          <div className="surface card-corners p-[22px] flex flex-col gap-3 select-none">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">Atalhos rápidos</h3>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="justify-start text-left"
                icon={<Mail size={16} className="text-[var(--text-secondary)]" />}
                onClick={() => onNavigate('emails-stock')}
              >
                Cadastrar email
              </Button>
              <Button
                variant="secondary"
                className="justify-start text-left"
                icon={<UserPlus size={16} className="text-[var(--text-secondary)]" />}
                onClick={() => onNavigate('accounts')}
              >
                Nova conta Ankama
              </Button>
              <Button
                variant="secondary"
                className="justify-start text-left"
                icon={<Plus size={16} className="text-[var(--text-secondary)]" />}
                onClick={() => onNavigate('creation')}
              >
                Criar personagem
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalhe da Operação com SUB-ABAS */}
      {selectedOperation && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOperation(null)}
          title="Detalhes da Operação"
          description={`Identificador técnico: ${selectedOperation.id}`}
          maxWidth="560px"
          headerTabs={
            <ModalTabs
              activeTab={opModalTab}
              onChange={(t) => setOpModalTab(t as typeof opModalTab)}
              tabs={[
                { id: 'status', label: 'Estado & Alvo', icon: Activity },
                { id: 'step', label: 'Etapa Atual', icon: CheckCircle2 },
                { id: 'action', label: 'Ações', icon: Sliders },
              ]}
            />
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setSelectedOperation(null)}>
                Fechar
              </Button>
              {selectedOperation.state === 'uncertain' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    dispatch({
                      type: 'RECONCILE_OPERATION',
                      payload: { id: selectedOperation.id, targetState: 'done' }
                    });
                    showToast('Operação reconciliada com sucesso.');
                    setSelectedOperation(null);
                  }}
                >
                  Conciliar operação
                </Button>
              )}
              {selectedOperation.state === 'failed' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    dispatch({
                      type: 'UPDATE_OPERATION',
                      payload: {
                        ...selectedOperation,
                        state: 'running',
                        step: 'Retomando execução a partir da última etapa',
                        updatedAt: new Date().toISOString()
                      }
                    });
                    showToast('Operação retomada.');
                    setSelectedOperation(null);
                  }}
                >
                  Retomar operação
                </Button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-4 text-[14px]">
            {opModalTab === 'status' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
                  <span className="text-[var(--text-secondary)]">Estado técnico</span>
                  <OperationPill state={selectedOperation.state} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text-tertiary)] text-[12px] uppercase">Alvo da Operação</span>
                  <span className="text-[var(--text-primary)] font-mono text-[14px]">{selectedOperation.subject}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text-tertiary)] text-[12px] uppercase">Última atualização</span>
                  <span className="text-[var(--text-secondary)] tabular-nums">
                    {new Date(selectedOperation.updatedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            )}

            {opModalTab === 'step' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text-tertiary)] text-[12px] uppercase">Etapa Atual</span>
                  <span className="text-[var(--text-primary)] leading-relaxed">{selectedOperation.step}</span>
                </div>
                {selectedOperation.state === 'uncertain' && (
                  <div className="p-3 rounded-[var(--radius-ctl)] bg-[var(--status-warn)]/10 border border-[var(--status-warn)]/30 text-[var(--status-warn)] text-[13px] leading-relaxed">
                    Verifique ou concilie antes de repetir. Nenhuma nova tentativa pode ser disparada sem validação prévia.
                  </div>
                )}
              </div>
            )}

            {opModalTab === 'action' && (
              <div className="flex flex-col gap-3 text-[13px] text-[var(--text-secondary)]">
                <p>
                  Operações são monitoradas pelo motor local de fila. A conciliação permite marcar como concluída uma operação que tenha finalizado remotamente sem confirmação de callback.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
