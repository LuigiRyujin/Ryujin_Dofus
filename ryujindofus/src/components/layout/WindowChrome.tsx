import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const WindowChrome: React.FC = () => {
  return (
    <header
      className="glass h-[32px] w-full flex items-center justify-between select-none px-3 z-50 rounded-none border-b border-white/5"
      style={{
        borderRadius: 0,
        backgroundColor: 'rgba(5, 11, 20, 0.85)',
      }}
    >
      {/* Esquerda: Símbolo e Nome */}
      <div className="flex items-center gap-2">
        <div
          className="h-[16px] aspect-[257/440] mark text-foam-50"
          aria-hidden="true"
        />
        <span className="text-[12px] font-medium text-foam-300 tracking-wide">
          RyujinDofus
        </span>
      </div>

      {/* Direita: Controles de Janela Windows */}
      <div className="flex items-center -mr-3 h-full">
        <button
          type="button"
          aria-label="Minimizar"
          className="w-[46px] h-full flex items-center justify-center text-foam-300 hover:bg-white/10 hover:text-foam-50 transition-colors"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Maximizar"
          className="w-[46px] h-full flex items-center justify-center text-foam-300 hover:bg-white/10 hover:text-foam-50 transition-colors"
        >
          <Square size={12} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Fechar"
          className="w-[46px] h-full flex items-center justify-center text-foam-300 hover:bg-[#C42B1C] hover:text-white transition-colors"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
};

