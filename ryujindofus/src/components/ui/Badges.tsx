import React from 'react';
import {
  AccountStatus,
  CharacterStatus,
  EmailStatus,
  OperationState,
} from '../../types/domain';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  PlayCircle,
  XCircle,
} from 'lucide-react';

export interface StatusBadgeProps {
  status: EmailStatus | AccountStatus | CharacterStatus;
  type?: 'email' | 'account' | 'character';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'character' }) => {
  // Configuração por status e tipo
  let label = '';
  let dotColor = 'bg-[#8CA0B3]';
  let badgeBg = 'bg-[#8CA0B3]/10';
  let textColor = 'text-foam-300';
  let borderColor = 'border-[#8CA0B3]/20';

  if (type === 'email') {
    switch (status) {
      case 'D':
        label = 'Disponível';
        dotColor = 'bg-ok';
        badgeBg = 'bg-ok/10';
        textColor = 'text-[#74DEAA]';
        borderColor = 'border-ok/30';
        break;
      case 'U':
        label = 'Utilizado';
        dotColor = 'bg-foam-500';
        badgeBg = 'bg-foam-500/10';
        textColor = 'text-foam-300';
        borderColor = 'border-foam-500/20';
        break;
      case 'B':
        label = 'Bloqueado';
        dotColor = 'bg-bad';
        badgeBg = 'bg-bad/10';
        textColor = 'text-[#F49694]';
        borderColor = 'border-bad/30';
        break;
    }
  } else if (type === 'account') {
    switch (status) {
      case 'C':
        label = 'Criada';
        dotColor = 'bg-ok';
        badgeBg = 'bg-ok/10';
        textColor = 'text-[#74DEAA]';
        borderColor = 'border-ok/30';
        break;
      case 'B':
        label = 'Banida';
        dotColor = 'bg-bad';
        badgeBg = 'bg-bad/10';
        textColor = 'text-[#F49694]';
        borderColor = 'border-bad/30';
        break;
    }
  } else {
    // character
    switch (status) {
      case 'C':
        label = 'Criado';
        dotColor = 'bg-foam-500';
        badgeBg = 'bg-foam-500/10';
        textColor = 'text-foam-300';
        borderColor = 'border-foam-500/20';
        break;
      case 'E':
        label = 'Em progresso';
        dotColor = 'bg-info';
        badgeBg = 'bg-info/10';
        textColor = 'text-[#96C8F6]';
        borderColor = 'border-info/30';
        break;
      case 'F':
        label = 'Finalizado';
        dotColor = 'bg-ok';
        badgeBg = 'bg-ok/10';
        textColor = 'text-[#74DEAA]';
        borderColor = 'border-ok/30';
        break;
      case 'B':
        label = 'Banido';
        dotColor = 'bg-bad';
        badgeBg = 'bg-bad/10';
        textColor = 'text-[#F49694]';
        borderColor = 'border-bad/30';
        break;
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-tag)] text-[12px] font-medium border ${badgeBg} ${textColor} ${borderColor} select-none`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export interface OperationPillProps {
  state: OperationState;
}

export const OperationPill: React.FC<OperationPillProps> = ({ state }) => {
  let label = '';
  let Icon = Clock;
  let pillStyle = '';

  switch (state) {
    case 'waiting':
      label = 'Aguardando';
      Icon = Clock;
      pillStyle = 'bg-foam-500/10 text-foam-300 border-foam-500/30';
      break;
    case 'running':
      label = 'Executando';
      Icon = PlayCircle;
      pillStyle = 'bg-info/15 text-info border-info/40 animate-pulse';
      break;
    case 'done':
      label = 'Concluída';
      Icon = CheckCircle2;
      pillStyle = 'bg-ok/15 text-ok border-ok/40';
      break;
    case 'failed':
      label = 'Falhou';
      Icon = XCircle;
      pillStyle = 'bg-bad/15 text-bad border-bad/40';
      break;
    case 'uncertain':
      label = 'Resultado incerto';
      Icon = HelpCircle;
      pillStyle = 'bg-warn/15 text-warn border-warn/40';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium border ${pillStyle} select-none`}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

