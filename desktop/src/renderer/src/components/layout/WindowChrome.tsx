import React from 'react';
import ryujinDark from '../../assets/brand/ryujin-dark.png';
import ryujinLight from '../../assets/brand/ryujin-light.png';

interface WindowChromeProps {
  theme?: 'dark' | 'light';
}

export const WindowChrome: React.FC<WindowChromeProps> = ({ theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const logoSrc = isDark ? ryujinDark : ryujinLight;

  return (
    <header
      className="drag-region h-[32px] w-full flex items-center justify-between select-none px-3 z-50 shrink-0 border-b border-[var(--border-app)] glass"
      style={{
        borderRadius: 0,
        backgroundColor: isDark ? 'rgba(5, 11, 20, 0.88)' : 'rgba(235, 243, 251, 0.88)'
      }}
    >
      {/* Esquerda: Marca e Título da Janela */}
      <div className="flex items-center gap-2.5">
        <img
          src={logoSrc}
          alt=""
          className="h-[18px] w-auto object-contain no-drag"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--text-primary)]">
            RYUJIN
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
            Dofus
          </span>
        </div>
      </div>

      {/* Centro / Espaço arrastável */}
      <div className="flex-1 h-full" />

      {/* Direita: Espaço reservado para o titleBarOverlay nativo do Windows (aprox. 138px) */}
      <div className="w-[138px] h-full" aria-hidden="true" />
    </header>
  );
};
