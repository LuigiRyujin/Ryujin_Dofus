import React, { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import {
  MetricStrip,
  BarChart,
  SegmentedBar,
  AttentionList,
  AttentionItem,
} from '../../components/data/Charts';
import { DataTable, Column } from '../../components/data/DataTable';
import { OperationPill } from '../../components/ui/Badges';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Operation } from '../../types/domain';
import { NavRoute } from '../../components/layout/Sidebar';
import { Mail, Plus, UserPlus } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface HomeScreenProps {
  onNavigate: (route: NavRoute) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { state, dispatch, metrics } = useAppStore();
  const { showToast } = useToast();
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);

  // Dados do gráfico dos últimos 7 dias (Seção 7.1)
  // seg 18, ter 24, qua 21, qui 27 em Espuma, sex 30, sáb 16, dom 22 (total 158)
  const chartData = [
    { label: 'Seg', value: 18 },
    { label: 'Ter', value: 24 },
    { label: 'Qua', value: 21 },
    { label: 'Qui', value: 27, highlight: true },
    { label: 'Sex', value: 30 },
    { label: 'Sáb', value: 16 },
    { label: 'Dom', value: 22 },
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
      onClick: () => setSelectedOperation(op),
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
          purchase_emails: 'Comprar emails',
        };
        return <span className="font-medium text-foam-50">{labels[op.type] || op.type}</span>;
      },
    },
    {
      key: 'subject',
      header: 'Conta / Email',
      cell: (op) => <span className="text-foam-300 font-mono text-[13px]">{op.subject}</span>,
    },
    {
      key: 'state',
      header: 'Estado',
      cell: (op) => <OperationPill state={op.state} />,
    },
    {
      key: 'time',
      header: 'Hora',
      align: 'right',
      cell: (op) => (
        <span className="text-foam-500 tabular-nums text-[13px]">
          {new Date(op.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Título e subtítulo da página */}
      <div className="flex flex-col gap-1 select-none">
        <h1
          className="text-[32px] font-semibold text-foam-50 tracking-[-0.02em] leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Boa tarde, Ryujin
        </h1>
        <p className="text-[15px] font-normal text-foam-300">
          Quinta-feira, 5 de novembro · 9 operações hoje, {attentionItems.length} precisam de atenção.
        </p>
      </div>

      {/* 2. Faixa de métricas: Um único bloco de vidro com 4 células derivadas */}
      <MetricStrip
        metrics={[
          {
            label: 'Emails disponíveis',
            value: metrics.availableEmails,
            variation: 4,
          },
          {
            label: 'Contas Ankama',
            value: metrics.accountsCount,
            variation: 2,
          },
          {
            label: 'Personagens em progresso',
            value: metrics.charactersInProgress,
            variation: 9,
          },
          {
            label: 'Fluxos finalizados',
            value: metrics.finishedCharacters,
            variation: 3,
          },
        ]}
      />

      {/* 3. Grade 8 / 4 Colunas (gap 24px) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: 8 Colunas */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Card: Operações nos últimos 7 dias */}
          <div className="surface corner-accent p-[22px] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-foam-50">
                Operações nos últimos 7 dias
              </h3>
              <span className="text-[12px] font-semibold text-foam-300 uppercase tracking-[0.05em]">
                HISTÓRICO SEMANAL
              </span>
            </div>
            <BarChart data={chartData} totalLabel="Total: 158 operações" />
          </div>

          {/* Card: Operações recentes (tabela) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-foam-50">
                Operações recentes
              </h3>
              <span className="text-[12px] text-foam-500">
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
          <div className="surface corner-accent p-[22px] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-foam-50">Requer atenção</h3>
              <span className="text-[12px] font-semibold text-warn tabular-nums bg-warn/10 px-2 py-0.5 rounded-full">
                {attentionItems.length}
              </span>
            </div>
            <AttentionList items={attentionItems} />
          </div>

          {/* Card: Personagens por status (Total 112 = 14 + 63 + 29 + 6) */}
          <div className="surface corner-accent p-[22px] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-foam-50">
                Personagens por status
              </h3>
              <span className="text-[13px] font-semibold text-foam-50 tabular-nums">
                Total: {metrics.totalCharacters}
              </span>
            </div>
            <SegmentedBar
              total={metrics.totalCharacters}
              segments={[
                { label: 'Criado', count: metrics.charactersByStatus.C, color: 'bg-foam-500' },
                { label: 'Em progresso', count: metrics.charactersByStatus.E, color: 'bg-info' },
                { label: 'Finalizado', count: metrics.charactersByStatus.F, color: 'bg-ok' },
                { label: 'Banido', count: metrics.charactersByStatus.B, color: 'bg-bad' },
              ]}
            />
          </div>

          {/* Card: Atalhos rápidos */}
          <div className="surface corner-accent p-[22px] flex flex-col gap-3 select-none">
            <h3 className="text-[16px] font-semibold text-foam-50">Atalhos rápidos</h3>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="justify-start text-left"
                icon={<Mail size={16} className="text-foam-300" />}
                onClick={() => onNavigate('emails-stock')}
              >
                Cadastrar email
              </Button>
              <Button
                variant="secondary"
                className="justify-start text-left"
                icon={<UserPlus size={16} className="text-foam-300" />}
                onClick={() => onNavigate('accounts')}
              >
                Nova conta Ankama
              </Button>
              <Button
                variant="secondary"
                className="justify-start text-left"
                icon={<Plus size={16} className="text-foam-300" />}
                onClick={() => onNavigate('creation')}
              >
                Criar personagem
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalhe da Operação */}
      {selectedOperation && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedOperation(null)}
          title="Detalhes da Operação"
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
                      payload: { id: selectedOperation.id, targetState: 'done' },
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
                        updatedAt: new Date().toISOString(),
                      },
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
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-foam-300">Estado técnico</span>
              <OperationPill state={selectedOperation.state} />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Alvo da Operação</span>
              <span className="text-foam-50 font-mono text-[14px]">{selectedOperation.subject}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Etapa Atual</span>
              <span className="text-foam-50">{selectedOperation.step}</span>
            </div>

            {selectedOperation.state === 'uncertain' && (
              <div className="p-3 rounded-[var(--radius-ctl)] bg-warn/10 border border-warn/30 text-warn text-[13px] leading-relaxed">
                Verifique ou concilie antes de repetir. Nenhuma nova tentativa pode ser disparada sem validação prévia.
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Última atualização</span>
              <span className="text-foam-300 tabular-nums">
                {new Date(selectedOperation.updatedAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

