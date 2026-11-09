import React from 'react';
import { useConnection } from '../../hooks/useDataHooks';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { Activity, Database, RefreshCw, Server, Zap } from 'lucide-react';

export const ConnectionScreen: React.FC = () => {
  const { snapshot, checking, checkNow } = useConnection();
  const { showToast } = useToast();

  const handleCheck = async () => {
    await checkNow();
    showToast('Diagnóstico de conexão atualizado com sucesso.');
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1 select-none">
        <h2 className="text-[20px] font-semibold text-foam-50">Conexão e Infraestrutura</h2>
        <p className="text-[14px] text-foam-500">
          Monitore a integridade da comunicação entre o cliente desktop, a API central e o banco de dados.
        </p>
      </div>

      {/* Quatro Cartões Separados (Seção 7.6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cartão 1: Conexão com a API */}
        <div className="surface corner-accent p-[22px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foam-300">Conexão com a API</span>
            <Server size={18} className="text-foam-500" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-24" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${snapshot.api.ok ? 'bg-ok' : 'bg-bad'}`}
                aria-hidden="true"
              />
              <span className="text-[20px] font-semibold text-foam-50 tabular-nums">
                {snapshot.api.ok ? `${snapshot.api.latencyMs} ms` : 'Indisponível'}
              </span>
            </div>
          )}
          <span className="text-[12px] text-foam-500">Fastify / Node.js 24 LTS</span>
        </div>

        {/* Cartão 2: Disponibilidade do Banco */}
        <div className="surface corner-accent p-[22px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foam-300">Disponibilidade do Banco</span>
            <Database size={18} className="text-foam-500" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-28" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${snapshot.database.ok ? 'bg-ok' : 'bg-bad'}`}
                aria-hidden="true"
              />
              <span className="text-[20px] font-semibold text-foam-50">
                {snapshot.database.ok ? 'Operacional' : 'Falha na conexão'}
              </span>
            </div>
          )}
          <span className="text-[12px] text-foam-500">PostgreSQL com TLS</span>
        </div>

        {/* Cartão 3: Estado da Automação Local */}
        <div className="surface corner-accent p-[22px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foam-300">Automação Local</span>
            <Zap size={18} className="text-foam-500" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-28" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  snapshot.automation.state === 'running'
                    ? 'bg-ok'
                    : snapshot.automation.state === 'idle'
                    ? 'bg-warn'
                    : 'bg-bad'
                }`}
                aria-hidden="true"
              />
              <span className="text-[20px] font-semibold text-foam-50 capitalize">
                {snapshot.automation.state === 'running'
                  ? 'Ativa / Ociosa'
                  : snapshot.automation.state === 'idle'
                  ? 'Aguardando'
                  : 'Desconectada'}
              </span>
            </div>
          )}
          <span className="text-[12px] text-foam-500">Worker Playwright</span>
        </div>

        {/* Cartão 4: Data e Hora da Última Verificação */}
        <div className="surface corner-accent p-[22px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-foam-300">Última Verificação</span>
            <Activity size={18} className="text-foam-500" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-36" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-info" aria-hidden="true" />
              <span className="text-[16px] font-semibold text-foam-50 tabular-nums">
                {new Date(snapshot.checkedAt).toLocaleTimeString('pt-BR')}
              </span>
            </div>
          )}
          <span className="text-[12px] text-foam-500 tabular-nums">
            {new Date(snapshot.checkedAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Botão de Verificação com Skeleton (~800ms) */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} className={checking ? 'animate-spin' : ''} />}
          onClick={handleCheck}
          loading={checking}
        >
          {checking ? 'Verificando serviços…' : 'Verificar agora'}
        </Button>
        <span className="text-[12px] text-foam-500">
          Checagem sintetizada de latência e heartbeat
        </span>
      </div>
    </div>
  );
};

