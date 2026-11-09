import React, { useEffect, useState } from 'react';
import { useConnection } from '../../hooks/useDataHooks';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/States';
import { useToast } from '../../components/ui/Toast';
import { Activity, Database, RefreshCw, Server, Zap, ShieldCheck } from 'lucide-react';

export const ConnectionScreen: React.FC = () => {
  const { snapshot, checking, checkNow } = useConnection();
  const { showToast } = useToast();
  const [appVersion, setAppVersion] = useState('0.1.0');
  const [platform, setPlatform] = useState('win32');

  useEffect(() => {
    if (window.ryujin) {
      void window.ryujin.getAppVersion().then((v) => v && setAppVersion(v));
      void window.ryujin.getPlatform().then((p) => p && setPlatform(p));
    }
  }, []);

  const handleCheck = async () => {
    await checkNow();
    showToast('Diagnóstico de conexão e infraestrutura atualizado.');
  };

  const platformDisplay = platform === 'win32' ? 'Windows (x64)' : platform;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1 select-none">
        <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">Conexão e Infraestrutura</h2>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Monitore a integridade da comunicação entre o cliente desktop Electron, a API e os serviços locais.
        </p>
      </div>

      {/* Cartões de Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cartão 1: Conexão com a API */}
        <div className="surface card-corners p-[20px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">Conexão com a API</span>
            <Server size={18} className="text-[var(--text-tertiary)]" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-24" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${snapshot.api.ok ? 'bg-[var(--status-ok)]' : 'bg-[var(--status-bad)]'}`}
                aria-hidden="true"
              />
              <span className="text-[20px] font-semibold text-[var(--text-primary)] tabular-nums">
                {snapshot.api.ok ? `${snapshot.api.latencyMs} ms` : 'Indisponível'}
              </span>
            </div>
          )}
          <span className="text-[12px] text-[var(--text-tertiary)]">Fastify / Node.js 24 LTS</span>
        </div>

        {/* Cartão 2: Disponibilidade do Banco */}
        <div className="surface card-corners p-[20px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">Disponibilidade do Banco</span>
            <Database size={18} className="text-[var(--text-tertiary)]" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-28" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${snapshot.database.ok ? 'bg-[var(--status-ok)]' : 'bg-[var(--status-bad)]'}`}
                aria-hidden="true"
              />
              <span className="text-[20px] font-semibold text-[var(--text-primary)]">
                {snapshot.database.ok ? 'Operacional' : 'Falha na conexão'}
              </span>
            </div>
          )}
          <span className="text-[12px] text-[var(--text-tertiary)]">PostgreSQL com TLS</span>
        </div>

        {/* Cartão 3: Estado da Automação Local */}
        <div className="surface card-corners p-[20px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">Automação Local</span>
            <Zap size={18} className="text-[var(--text-tertiary)]" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-28" />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  snapshot.automation.state === 'running'
                    ? 'bg-[var(--status-ok)]'
                    : snapshot.automation.state === 'idle'
                    ? 'bg-[var(--status-warn)]'
                    : 'bg-[var(--status-bad)]'
                }`}
                aria-hidden="true"
              />
              <span className="text-[20px] font-semibold text-[var(--text-primary)] capitalize">
                {snapshot.automation.state === 'running'
                  ? 'Ativa / Ociosa'
                  : snapshot.automation.state === 'idle'
                  ? 'Aguardando'
                  : 'Desconectada'}
              </span>
            </div>
          )}
          <span className="text-[12px] text-[var(--text-tertiary)]">Worker Playwright</span>
        </div>

        {/* Cartão 4: Cliente Desktop Electron */}
        <div className="surface card-corners p-[20px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">Aplicativo Desktop</span>
            <ShieldCheck size={18} className="text-[var(--status-ok)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[18px] font-semibold text-[var(--text-primary)]">
              Ryujin v{appVersion}
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]">{platformDisplay}</span>
          </div>
          <span className="text-[11px] text-[var(--text-tertiary)]">Sandbox & Context Isolation Ativos</span>
        </div>

        {/* Cartão 5: Data e Hora da Última Verificação */}
        <div className="surface card-corners p-[20px] flex flex-col justify-between h-[150px]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">Última Verificação</span>
            <Activity size={18} className="text-[var(--text-tertiary)]" />
          </div>
          {checking ? (
            <Skeleton height={28} className="w-36" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-info)]" aria-hidden="true" />
              <span className="text-[16px] font-semibold text-[var(--text-primary)] tabular-nums">
                {new Date(snapshot.checkedAt).toLocaleTimeString('pt-BR')}
              </span>
            </div>
          )}
          <span className="text-[12px] text-[var(--text-tertiary)] tabular-nums">
            {new Date(snapshot.checkedAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      {/* Botão de Verificação */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} className={checking ? 'animate-spin' : ''} />}
          onClick={handleCheck}
          loading={checking}
        >
          {checking ? 'Verificando serviços…' : 'Verificar agora'}
        </Button>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          Checagem sintetizada de latência e heartbeat
        </span>
      </div>
    </div>
  );
};
