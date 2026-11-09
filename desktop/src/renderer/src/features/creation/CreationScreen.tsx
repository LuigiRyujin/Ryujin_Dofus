import React, { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { useOperations } from '../../hooks/useDataHooks';
import { DataTable, Column } from '../../components/data/DataTable';
import { OperationPill } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Fields';
import { Timeline, TimelineStep } from '../../components/data/Charts';
import { Modal } from '../../components/ui/Modal';
import { ModalTabs } from '../../components/ui/ModalTabs';
import { useToast } from '../../components/ui/Toast';
import { Operation } from '../../types/domain';
import {
  AlertCircle,
  Play,
  Sparkles,
  UserPlus,
  Boxes,
  History,
  Activity,
  CheckCircle2,
  Sliders,
  ShieldCheck,
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

export type CreationTab = 'overview' | 'queue' | 'history';

export const CreationScreen: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { showToast } = useToast();
  const { operations, submitCode, retry, reconcile } = useOperations();

  const [activeTab, setActiveTab] = useState<CreationTab>('overview');

  // Coluna 1: Criar Conta Ankama
  const availableEmails = state.emails.filter((e) => e.status === 'D');
  const [selectedEmailId, setSelectedEmailId] = useState(availableEmails[0]?.id || '');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountCreationStep, setAccountCreationStep] = useState(0); // 0: não iniciou, 1: abrindo navegador, 2: aguardando código, 3: concluído
  const [manualCode, setManualCode] = useState('');

  // Coluna 2: Criar Personagem (Comando separado)
  const [selectedAccountId, setSelectedAccountId] = useState(state.accounts[0]?.id || '');
  const [selectedRace, setSelectedRace] = useState(RACES[0] || 'Cra');
  const [selectedServer, setSelectedServer] = useState(SERVERS[0] || 'Draconiros');
  const [isCreatingChar, setIsCreatingChar] = useState(false);

  // Modal para código de confirmação em operações da lista
  const [codeOpModal, setCodeOpModal] = useState<Operation | null>(null);
  const [inputCode, setInputCode] = useState('');

  // Modal de Detalhes da Operação com sub-abas
  const [detailModalOp, setDetailModalOp] = useState<Operation | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'status' | 'step' | 'action'>('status');

  const activeOperationsCount = operations.filter((op) => op.state === 'running' || op.state === 'uncertain').length;

  // Iniciar criação de conta
  const handleStartAccountCreation = () => {
    if (!selectedEmailId) {
      showToast('Selecione um email disponível.', 'error');
      return;
    }
    const emailObj = state.emails.find((e) => e.id === selectedEmailId);
    setIsCreatingAccount(true);
    setAccountCreationStep(1);

    const newOp: Operation = {
      id: `op-acc-${Date.now()}`,
      type: 'create_account',
      subject: emailObj?.address || 'novo_email',
      state: 'running',
      step: 'Iniciando automação Playwright no portal Ankama',
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'UPDATE_OPERATION', payload: newOp });

    setTimeout(() => {
      setAccountCreationStep(2);
      dispatch({
        type: 'UPDATE_OPERATION',
        payload: {
          ...newOp,
          step: 'Aguardando código de confirmação enviado por email',
          needsCode: true,
        },
      });
    }, 1200);
  };

  const handleSendCodeAccountCreation = () => {
    if (!manualCode) {
      showToast('Informe o código de confirmação.', 'error');
      return;
    }
    setAccountCreationStep(3);

    const loginGenerated = `ryu_warrior_${Math.floor(Math.random() * 899 + 100)}`;
    dispatch({
      type: 'ADD_ACCOUNT',
      payload: {
        login: loginGenerated,
        emailId: selectedEmailId,
        password: 'AkPass#Generated99',
      },
    });

    showToast(`Conta Ankama ${loginGenerated} criada com sucesso!`);
    setIsCreatingAccount(false);
    setManualCode('');
    setAccountCreationStep(0);
  };

  // Iniciar criação de personagem (Comando SEPARADO)
  const handleStartCharacterCreation = () => {
    if (!selectedAccountId) {
      showToast('Selecione uma conta Ankama de destino.', 'error');
      return;
    }
    const targetAccount = state.accounts.find((a) => a.id === selectedAccountId);
    setIsCreatingChar(true);

    const randomNames = ['Tatsumaki', 'Homura', 'Kurogane', 'Suisei', 'Kage', 'Shinobu'];
    const generatedName = `${randomNames[Math.floor(Math.random() * randomNames.length)]}_${Math.floor(
      Math.random() * 89 + 10
    )}`;

    const newOp: Operation = {
      id: `op-char-${Date.now()}`,
      type: 'create_character',
      subject: targetAccount?.login || 'conta',
      state: 'running',
      step: `Gerando aparência e criando personagem ${generatedName}`,
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: 'UPDATE_OPERATION', payload: newOp });

    setTimeout(() => {
      dispatch({
        type: 'ADD_CHARACTER',
        payload: {
          name: generatedName,
          accountId: selectedAccountId,
          race: selectedRace,
          server: selectedServer,
        },
      });

      dispatch({
        type: 'UPDATE_OPERATION',
        payload: {
          ...newOp,
          state: 'done',
          step: `Personagem ${generatedName} criado com status Criado (C)`,
          updatedAt: new Date().toISOString(),
        },
      });

      setIsCreatingChar(false);
      showToast(`Personagem ${generatedName} criado com sucesso com status Criado (C)!`);
    }, 1500);
  };

  // Passos da Timeline para a criação de conta
  const accountTimelineSteps: TimelineStep[] = [
    {
      title: '1. Alocação do email disponível',
      status: accountCreationStep >= 1 ? 'completed' : 'pending',
      detail: 'Email reservado exclusivamente para esta tentativa',
    },
    {
      title: '2. Preenchimento cadastral e envio de código',
      status:
        accountCreationStep > 2
          ? 'completed'
          : accountCreationStep === 2
          ? 'running'
          : accountCreationStep === 1
          ? 'running'
          : 'pending',
      detail: 'Navegador automatizado preencheu formulário e solicitou código',
    },
    {
      title: '3. Validação do código e ativação da conta',
      status: accountCreationStep === 3 ? 'completed' : 'pending',
      detail: 'Confirmação do token de segurança Ankama',
    },
  ];

  // Colunas da Lista de Operações Técnicas
  const columns: Column<Operation>[] = [
    {
      key: 'type',
      header: 'Tipo',
      cell: (op) => {
        const labels: Record<string, string> = {
          create_account: 'Criar conta Ankama',
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
      cell: (op) => <span className="font-mono text-foam-300 text-[13px]">{op.subject}</span>,
    },
    {
      key: 'state',
      header: 'Estado técnico',
      cell: (op) => <OperationPill state={op.state} />,
    },
    {
      key: 'step',
      header: 'Etapa atual',
      cell: (op) => <span className="text-foam-300 text-[13px]">{op.step}</span>,
    },
    {
      key: 'updatedAt',
      header: 'Última atualização',
      cell: (op) => (
        <span className="text-foam-500 tabular-nums text-[13px]">
          {new Date(op.updatedAt).toLocaleTimeString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ação contextual',
      align: 'right',
      cell: (op) => {
        if (op.state === 'running' && op.needsCode) {
          return (
            <Button
              variant="secondary"
              className="h-[30px] px-2.5 text-[12px]"
              onClick={(e) => {
                e.stopPropagation();
                setCodeOpModal(op);
                setInputCode('');
              }}
            >
              Inserir código
            </Button>
          );
        }
        if (op.state === 'failed') {
          return (
            <Button
              variant="secondary"
              className="h-[30px] px-2.5 text-[12px]"
              onClick={(e) => {
                e.stopPropagation();
                retry(op.id);
                showToast('Operação reiniciada.');
              }}
            >
              Repetir
            </Button>
          );
        }
        if (op.state === 'uncertain') {
          return (
            <Button
              variant="secondary"
              className="h-[30px] px-2.5 text-[12px] text-warn border-warn/40"
              onClick={(e) => {
                e.stopPropagation();
                setDetailModalOp(op);
              }}
            >
              Verificar
            </Button>
          );
        }
        return (
          <Button
            variant="ghost"
            className="h-[30px] px-2.5 text-[12px]"
            onClick={(e) => {
              e.stopPropagation();
              setDetailModalOp(op);
            }}
          >
            Detalhes
          </Button>
        );
      },
    },
  ];

  const workspaceItems = [
    {
      value: 'overview' as const,
      label: 'Centro de Criação',
      icon: Sparkles,
    },
    {
      value: 'queue' as const,
      label: 'Fila de Operações',
      icon: Boxes,
      badge: activeOperationsCount > 0 ? activeOperationsCount : undefined,
      badgeTone: 'warning' as const,
    },
    {
      value: 'history' as const,
      label: 'Histórico & Logs',
      icon: History,
    },
  ];

  return (
    <>
      <OperationalWorkspace
        items={workspaceItems}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Criação e Automação"
        headerTitle="Oficina de Criação & Automação"
        headerDescription="Execução assistida de cadastros no portal Ankama e no jogo Dofus Touch"
        statusNode={
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-[var(--radius-tag)] bg-[#4CC38A]/15 text-[#4CC38A] border border-[#4CC38A]/30 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#4CC38A] animate-pulse" />
              Worker Playwright Ativo
            </span>
            <span className="px-2.5 py-1 text-[11px] font-medium rounded-[var(--radius-tag)] bg-white/10 text-[var(--text-secondary)]">
              {operations.length} tarefas processadas
            </span>
          </div>
        }
        bottom={
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span>Fila ativa:</span>
              <strong className="text-ok font-mono">{activeOperationsCount}</strong>
            </div>
            <div className="flex justify-between">
              <span>E-mails livres ('D'):</span>
              <strong className="text-[var(--accent-gold)] font-mono">{availableEmails.length}</strong>
            </div>
          </div>
        }
      >
        {/* SUB-ABA 1: CENTRO DE CRIAÇÃO */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Card 1: Criar Conta Ankama */}
              <div className="surface p-6 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[var(--radius-ctl)] bg-white/5 text-[var(--accent-gold)]">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-foam-50">1. Criar Conta Ankama</h3>
                    <p className="text-[12px] text-[var(--text-secondary)]">Consome 1 email com status 'D'</p>
                  </div>
                </div>

                {!isCreatingAccount ? (
                  <div className="flex flex-col gap-4">
                    <SelectField
                      label="Email disponível para uso"
                      value={selectedEmailId}
                      onChange={(e) => setSelectedEmailId(e.target.value)}
                      options={availableEmails.map((em) => ({
                        value: em.id,
                        label: `${em.address} (${em.origin})`,
                      }))}
                      helperText={
                        availableEmails.length === 0
                          ? 'Nenhum email livre no estoque. Compre ou importe emails antes.'
                          : undefined
                      }
                    />

                    <Button
                      variant="primary"
                      icon={<Play size={16} />}
                      onClick={handleStartAccountCreation}
                      disabled={availableEmails.length === 0}
                      className="w-full"
                    >
                      Iniciar criação de conta
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5 pt-2">
                    <Timeline steps={accountTimelineSteps} />

                    {accountCreationStep === 2 && (
                      <div className="p-4 rounded-[var(--radius-ctl)] bg-black/40 border border-white/10 flex flex-col gap-3">
                        <TextField
                          label="Código recebido no email"
                          placeholder="ex: 849201"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          autoFocus
                        />
                        <div className="flex justify-end">
                          <Button variant="primary" onClick={handleSendCodeAccountCreation}>
                            Confirmar código
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: Criar Personagem */}
              <div className="surface p-6 rounded-[var(--radius-ctl)] border border-[var(--border-app)] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[var(--radius-ctl)] bg-white/5 text-ok">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-foam-50">2. Criar Personagem</h3>
                    <p className="text-[12px] text-[var(--text-secondary)]">Associa a uma conta existente</p>
                  </div>
                </div>

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

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Raça"
                      value={selectedRace}
                      onChange={(e) => setSelectedRace(e.target.value)}
                      options={RACES.map((r) => ({ value: r, label: r }))}
                    />
                    <SelectField
                      label="Servidor"
                      value={selectedServer}
                      onChange={(e) => setSelectedServer(e.target.value)}
                      options={SERVERS.map((s) => ({ value: s, label: s }))}
                    />
                  </div>

                  <Button
                    variant="primary"
                    icon={<Play size={16} />}
                    onClick={handleStartCharacterCreation}
                    disabled={isCreatingChar || state.accounts.length === 0}
                    className="w-full"
                  >
                    {isCreatingChar ? 'Criando no jogo…' : 'Criar personagem na conta'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-ABA 2: FILA DE OPERAÇÕES */}
        {activeTab === 'queue' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[var(--text-secondary)]">
                Operações ativas, pendentes de confirmação ou com resolução de incerteza
              </span>
            </div>

            <DataTable
              columns={columns}
              data={operations.filter((op) => op.state !== 'done')}
              keyExtractor={(op) => op.id}
              onRowClick={(op) => setDetailModalOp(op)}
            />
          </div>
        )}

        {/* SUB-ABA 3: HISTÓRICO & LOGS */}
        {activeTab === 'history' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[var(--text-secondary)]">
                Registro de operações concluídas ou arquivadas
              </span>
            </div>

            <DataTable
              columns={columns}
              data={operations.filter((op) => op.state === 'done')}
              keyExtractor={(op) => op.id}
              onRowClick={(op) => setDetailModalOp(op)}
            />
          </div>
        )}
      </OperationalWorkspace>

      {/* Modal para Informar Código de Operação */}
      {codeOpModal && (
        <Modal
          isOpen={true}
          onClose={() => setCodeOpModal(null)}
          title="Informar Código de Confirmação"
          maxWidth="440px"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCodeOpModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (!inputCode) return;
                  await submitCode(codeOpModal.id, inputCode);
                  showToast('Código enviado e aceito pela automação!');
                  setCodeOpModal(null);
                }}
              >
                Confirmar código
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4 text-[14px]">
            <p className="text-foam-300">
              A operação para <strong className="text-foam-50">{codeOpModal.subject}</strong> está
              aguardando o token de verificação enviado pela Ankama.
            </p>
            <TextField
              label="Código de verificação"
              placeholder="ex: 493012"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* Modal de Detalhes da Operação com SUB-ABAS (Organizado para não ficar cheio) */}
      {detailModalOp && (
        <Modal
          isOpen={true}
          onClose={() => setDetailModalOp(null)}
          title="Detalhes da Operação"
          description={`Identificador técnico: ${detailModalOp.id}`}
          maxWidth="560px"
          headerTabs={
            <ModalTabs
              activeTab={detailModalTab}
              onChange={(t) => setDetailModalTab(t as typeof detailModalTab)}
              tabs={[
                { id: 'status', label: 'Estado & Alvo', icon: Activity },
                { id: 'step', label: 'Etapa & Logs', icon: CheckCircle2 },
                { id: 'action', label: 'Conciliação', icon: Sliders },
              ]}
            />
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setDetailModalOp(null)}>
                Fechar
              </Button>
              {detailModalOp.state === 'uncertain' && (
                <Button
                  variant="primary"
                  onClick={async () => {
                    await reconcile(detailModalOp.id);
                    showToast('Operação reconciliada com sucesso.');
                    setDetailModalOp(null);
                  }}
                >
                  Conciliar operação
                </Button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-4 text-[14px]">
            {detailModalTab === 'status' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-foam-300">Estado técnico</span>
                  <OperationPill state={detailModalOp.state} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-foam-500 text-[12px] uppercase">Alvo da Operação</span>
                  <span className="font-mono text-foam-50">{detailModalOp.subject}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-foam-500 text-[12px] uppercase">Data da última alteração</span>
                  <span className="text-foam-300 tabular-nums">
                    {new Date(detailModalOp.updatedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            )}

            {detailModalTab === 'step' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-foam-500 text-[12px] uppercase">Etapa Atual</span>
                  <span className="text-foam-50 leading-relaxed">{detailModalOp.step}</span>
                </div>
                {detailModalOp.state === 'uncertain' && (
                  <div className="p-3.5 rounded-[var(--radius-ctl)] bg-warn/10 border border-warn/30 text-warn text-[13px] leading-relaxed flex items-start gap-2.5">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <strong>Verifique ou concilie antes de repetir.</strong>
                      <span>
                        A automação não oferece a opção de repetir uma operação com resultado incerto para evitar duplicações de registros.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {detailModalTab === 'action' && (
              <div className="flex flex-col gap-3 text-[13px] text-[var(--text-secondary)]">
                <div className="p-3 rounded-[var(--radius-ctl)] bg-white/5 border border-white/10 flex items-center gap-2 text-ok">
                  <ShieldCheck size={16} />
                  <span>Tratamento idempotente verificado</span>
                </div>
                <p>
                  Caso a operação tenha sido interrompida durante a chamada ao portal, você pode reconciliá-la com o banco Neon com segurança.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
