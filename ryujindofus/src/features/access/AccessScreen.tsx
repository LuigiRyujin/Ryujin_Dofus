import React, { useState } from 'react';
import { PasswordField, TextField } from '../../components/ui/Fields';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { KeyRound, Shield } from 'lucide-react';

export const AccessScreen: React.FC = () => {
  const { showToast } = useToast();
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
      showToast('Configuração salva (simulado)');
    }, 600);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-1 select-none">
        <h2 className="text-[20px] font-semibold text-foam-50">Credenciais e Acesso</h2>
        <p className="text-[14px] text-foam-500">
          Configure a chave de autenticação do operador para comunicação segura com a API.
        </p>
      </div>

      <div className="surface corner-accent p-[22px] flex flex-col gap-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
          <Shield size={18} className="text-ok" />
          <span className="text-[14px] font-semibold text-foam-50">
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
            helperText="Token JWT protegido com chave de 32 bytes (fictício)"
          />

          {savedFeedback && (
            <div className="p-3 rounded-[var(--radius-ctl)] bg-ok/10 border border-ok/30 text-ok text-[13px] font-medium flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ok" />
              <span>Configuração salva (simulado)</span>
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

