import React, { useState } from 'react';
import { PasswordField, TextField } from '../../components/ui/Fields';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useTheme } from '../../hooks/useTheme';
import { KeyRound, Shield, Palette, Moon, Sun, Laptop } from 'lucide-react';
import type { ThemePreference } from '../../../../shared/ipc';

export const AccessScreen: React.FC = () => {
  const { showToast } = useToast();
  const { preference, setTheme } = useTheme();

  const [operatorToken, setOperatorToken] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token_payload_sample_key');
  const [apiEndpoint, setApiEndpoint] = useState('http://localhost:3000/api');
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSavedFeedback(true);
      showToast('Configuração salva com sucesso (simulado)');
    }, 500);
  };

  const handleThemeChange = async (newPref: ThemePreference) => {
    await setTheme(newPref);
    showToast(`Tema alterado para: ${newPref === 'dark' ? 'Escuro (Profundezas)' : newPref === 'light' ? 'Claro (Maré)' : 'Seguir Sistema'}`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1 select-none">
        <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">Configurações e Acesso</h2>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Ajuste as preferências visuais do aplicativo e credenciais do operador.
        </p>
      </div>

      {/* Seção 1: Aparência / Temas */}
      <div className="surface card-corners p-[22px] flex flex-col gap-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-app)]">
          <Palette size={18} className="text-[var(--accent-gold)]" />
          <div className="flex flex-col">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              Aparência do Aplicativo
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]">
              Personalize a paleta visual e os efeitos de profundidade aquática.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Opção Escuro */}
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`p-3.5 rounded-[var(--radius-ctl)] border flex flex-col items-center gap-2 transition-all ${
              preference === 'dark'
                ? 'border-[var(--accent-gold)] bg-white/[0.08] shadow-sm'
                : 'border-[var(--border-app)] hover:border-white/20 bg-white/[0.02]'
            }`}
          >
            <Moon size={22} className={preference === 'dark' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Escuro</span>
              <span className="text-[11px] text-[var(--text-tertiary)]">Profundezas</span>
            </div>
          </button>

          {/* Opção Claro */}
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`p-3.5 rounded-[var(--radius-ctl)] border flex flex-col items-center gap-2 transition-all ${
              preference === 'light'
                ? 'border-[var(--accent-gold)] bg-white/[0.08] shadow-sm'
                : 'border-[var(--border-app)] hover:border-white/20 bg-white/[0.02]'
            }`}
          >
            <Sun size={22} className={preference === 'light' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Claro</span>
              <span className="text-[11px] text-[var(--text-tertiary)]">Maré</span>
            </div>
          </button>

          {/* Opção Sistema */}
          <button
            type="button"
            onClick={() => handleThemeChange('system')}
            className={`p-3.5 rounded-[var(--radius-ctl)] border flex flex-col items-center gap-2 transition-all ${
              preference === 'system'
                ? 'border-[var(--accent-gold)] bg-white/[0.08] shadow-sm'
                : 'border-[var(--border-app)] hover:border-white/20 bg-white/[0.02]'
            }`}
          >
            <Laptop size={22} className={preference === 'system' ? 'text-[var(--accent-gold)]' : 'text-[var(--text-secondary)]'} />
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Sistema</span>
              <span className="text-[11px] text-[var(--text-tertiary)]">Automático</span>
            </div>
          </button>
        </div>
      </div>

      {/* Seção 2: Credenciais e Segurança */}
      <div className="surface card-corners p-[22px] flex flex-col gap-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border-app)]">
          <Shield size={18} className="text-[var(--status-ok)]" />
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">
            Armazenamento Seguro do Windows (DPAPI)
          </span>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <TextField
            label="Endpoint da API"
            value={apiEndpoint}
            onChange={(e) => {
              setApiEndpoint(e.target.value);
              setSavedFeedback(false);
            }}
            helperText="Endereço base do serviço Fastify"
          />

          <PasswordField
            label="Token do Operador (OPERATOR_TOKEN)"
            value={operatorToken}
            onChange={(e) => {
              setOperatorToken(e.target.value);
              setSavedFeedback(false);
            }}
            helperText="Token JWT protegido com chave de 32 bytes (armazenado com segurança)"
          />

          {savedFeedback && (
            <div className="p-3 rounded-[var(--radius-ctl)] bg-[var(--status-ok)]/10 border border-[var(--status-ok)]/30 text-[var(--status-ok)] text-[13px] font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-ok)]" />
              <span>Configuração salva e sincronizada</span>
            </div>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              icon={<KeyRound size={16} />}
              loading={isSaving}
              className="w-full sm:w-auto"
            >
              Salvar credenciais
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
