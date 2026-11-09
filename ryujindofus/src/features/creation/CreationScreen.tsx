import React, { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { useOperations } from '../../hooks/useDataHooks';
import { DataTable, Column } from '../../components/data/DataTable';
import { OperationPill } from '../../components/ui/Badges';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Fields';
import { Timeline, TimelineStep } from '../../components/data/Charts';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Operation } from '../../types/domain';
import { AlertCircle, Play, Sparkles, UserPlus } from 'lucide-react';

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

export const CreationScreen: React.FC = () => {
  const { state, dispatch } = useAppStore();
  const { showToast } = useToast();
  const { operations, submitCode, retry, reconcile } = useOperations();

  // Coluna 1: Criar Conta Ankama
  const availableEmails = state.emails.filter((e) => e.status === 'D');
  const [selectedEmailId, setSelectedEmailId] = useState(availableEmails[0]?.id || '');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountCreationStep, setAccountCreationStep] = useState(0); // 0: não iniciou, 1: abrindo navegador, 2: aguardando código, 3: concluído
  const [manualCode, setManualCode] = useState('');

  // Coluna 2: Criar Personagem (Comando separado)
  const [selectedAccountId, setSelectedAccountId] = useState(state.accounts[0]?.id || '');
  const [selectedRace, setSelectedRace] = useState(RACES[0]);
  const [selectedServer, setSelectedServer] = useState(SERVERS[0]);
  const [isCreatingChar, setIsCreatingChar] = useState(false);

  // Modal para código de confirmação em operações da lista
  const [codeOpModal, setCodeOpModal] = useState<Operation | null>(null);
  const [inputCode, setInputCode] = useState('');

  // Modal de Detalhes da Operação
  const [detailModalOp, setDetailModalOp] = useState<Operation | null>(null);

  // Iniciar criação de conta
  const handleStartAccountCreation = () => {
    if (!selectedEmailId) {
      showToast('Selecione um email disponível.', 'error');
      return;
    }
    const emailObj = state.emails.find((e) => e.id === selectedEmailId);
    setIsCreatingAccount(true);
    setAccountCreationStep(1);

    // Adiciona operação na lista
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
    const emailObj = state.emails.find((e) => e.id === selectedEmailId);
    setAccountCreationStep(3);

    // Conclui e cria a conta Ankama no store (Regra 1: email passa para U)
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
      // Ao concluir, aparece em Personagens com status C (Seção 7.5)
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
        // Ação contextual por estado (Seção 7.5):
        if (op.state === 'running' && op.needsCode) {
          return (
            <Button
              variant="secondary"
              className="h-[30px] px-2.5 text-[12px]"
              onClick={() => {
                setCodeOpModal(op);
                setInputCode('');
              }}
            >
              Informar código
            </Button>
          );
        }
        if (op.state === 'failed' && op.recoverable) {
          return (
            <Button
              variant="secondary"
              className="h-[30px] px-2.5 text-[12px]"
              onClick={async () => {
                await retry(op.id);
                showToast('Operação retomada com sucesso.');
              }}
            >
              Retomar
            </Button>
          );
        }
        if (op.state === 'uncertain') {
          return (
            <Button
              variant="secondary"
              className="h-[30px] px-2.5 text-[12px] text-warn border-warn/30"
              onClick={async () => {
                await reconcile(op.id);
                showToast('Operação reconciliada com sucesso.');
              }}
            >
              Conciliar
            </Button>
          );
        }
        return (
          <Button
            variant="ghost"
            className="h-[30px] px-2.5 text-[12px]"
            onClick={() => setDetailModalOp(op)}
          >
            Ver detalhes
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Duas Ações Distintas em Duas Colunas (Seção 7.5) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* COLUNA 1: Criar Conta Ankama */}
        <div className="surface corner-accent p-[22px] flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
            <UserPlus size={18} className="text-foam-300" />
            <h3 className="text-[16px] font-semibold text-foam-50">Criar conta Ankama</h3>
          </div>

          <p className="text-[13px] text-foam-500">
            Selecione um email disponível no estoque para disparar a automação de cadastro.
          </p>

          <SelectField
            label="Email disponível no estoque"
            value={selectedEmailId}
            onChange={(e) => setSelectedEmailId(e.target.value)}
            disabled={isCreatingAccount}
            options={availableEmails.map((e) => ({
              value: e.id,
              label: `${e.address} (${e.origin})`,
            }))}
          />

          {!isCreatingAccount && accountCreationStep === 0 && (
            <Button
              variant="primary"
              icon={<Play size={15} />}
              onClick={handleStartAccountCreation}
              disabled={availableEmails.length === 0}
            >
              Iniciar criação da conta
            </Button>
          )}

          {/* Timeline Vertical de Etapas (Seção 7.5) */}
          {(isCreatingAccount || accountCreationStep > 0) && (
            <div className="flex flex-col gap-3 pt-2 border-t border-white/10">
              <span className="text-[12px] font-semibold text-foam-300 uppercase tracking-[0.05em]">
                Progresso da Operação
              </span>
              <Timeline steps={accountTimelineSteps} />

              {/* Campo de Código quando a etapa pedir */}
              {accountCreationStep === 2 && (
                <div className="p-3.5 rounded-[var(--radius-ctl)] bg-info/10 border border-info/30 flex flex-col gap-2.5">
                  <span className="text-[13px] font-medium text-foam-50">
                    Código de confirmação recebido por email:
                  </span>
                  <div className="flex gap-2">
                    <TextField
                      label=""
                      placeholder="ex: 849201"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="h-[36px]"
                    />
                    <Button
                      variant="primary"
                      className="h-[36px] shrink-0"
                      onClick={handleSendCodeAccountCreation}
                    >
                      Enviar código
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUNA 2: Criar Personagem (Comando SEPARADO) */}
        <div className="surface corner-accent p-[22px] flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
            <Sparkles size={18} className="text-foam-300" />
            <h3 className="text-[16px] font-semibold text-foam-50">Criar personagem</h3>
          </div>

          <p className="text-[13px] text-foam-500">
            Selecione a conta destino, classe e servidor. O fluxo executará login técnico e criação.
          </p>

          <SelectField
            label="Conta Ankama de destino"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            disabled={isCreatingChar}
            options={state.accounts
              .filter((a) => a.status === 'C') // Só contas ativas
              .map((acc) => ({
                value: acc.id,
                label: acc.login,
              }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Raça"
              value={selectedRace}
              onChange={(e) => setSelectedRace(e.target.value)}
              disabled={isCreatingChar}
              options={RACES.map((r) => ({ value: r, label: r }))}
            />
            <SelectField
              label="Servidor"
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              disabled={isCreatingChar}
              options={SERVERS.map((s) => ({ value: s, label: s }))}
            />
          </div>

          {/* Aviso discreto obrigatório (Seção 7.5) */}
          <div className="p-3 rounded-[var(--radius-ctl)] bg-white/[0.03] border border-white/10 text-[12px] text-foam-300 leading-relaxed">
            Nome, sexo e aparência serão gerados aleatoriamente com parâmetros válidos do runtime.
          </div>

          <Button
            variant="primary"
            icon={<Play size={15} />}
            onClick={handleStartCharacterCreation}
            loading={isCreatingChar}
            disabled={state.accounts.filter((a) => a.status === 'C').length === 0}
          >
            Iniciar criação do personagem
          </Button>
        </div>
      </div>

      {/* Lista de Operações Técnicas (Seção 7.5) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-foam-50">Operações e filas ativas</h3>
          <span className="text-[12px] text-foam-500">
            Acompanhe o estado de execução das tarefas automatizadas
          </span>
        </div>

        <DataTable
          columns={columns}
          data={operations}
          keyExtractor={(op) => op.id}
          onRowClick={(op) => setDetailModalOp(op)}
        />
      </div>

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

      {/* Modal de Detalhes da Operação */}
      {detailModalOp && (
        <Modal
          isOpen={true}
          onClose={() => setDetailModalOp(null)}
          title="Detalhes da Operação"
          maxWidth="460px"
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
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-foam-300">Estado técnico</span>
              <OperationPill state={detailModalOp.state} />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Alvo</span>
              <span className="font-mono text-foam-50">{detailModalOp.subject}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Etapa</span>
              <span className="text-foam-50">{detailModalOp.step}</span>
            </div>

            {/* Aviso estrito de Resultado Incerto (Seção 7.5) */}
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

            <div className="flex flex-col gap-1">
              <span className="text-foam-500 text-[12px] uppercase">Data da última alteração</span>
              <span className="text-foam-300 tabular-nums">
                {new Date(detailModalOp.updatedAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

