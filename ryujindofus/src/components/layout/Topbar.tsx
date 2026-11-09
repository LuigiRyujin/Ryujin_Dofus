import React, { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  actions?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  actions,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Atalho global Ctrl+K ou Meta+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="glass h-[64px] w-full flex items-center justify-between px-6 z-30 mb-6">
      {/* Esquerda: Título e subtítulo */}
      <div className="flex items-baseline gap-3 truncate">
        <h2 className="text-[16px] font-semibold text-foam-50 tracking-tight truncate">
          {title}
        </h2>
        <span className="text-[13px] text-foam-500 hidden sm:inline truncate">
          {subtitle}
        </span>
      </div>

      {/* Direita: Busca Global e Ações */}
      <div className="flex items-center gap-3">
        {/* Campo de Busca Global (280px) */}
        <div className="relative w-[280px] max-sm:w-[180px]">
          <Search
            size={16}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foam-500 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar..."
            aria-label="Buscar no sistema"
            className="w-full h-[38px] pl-9 pr-16 bg-white/[0.06] border border-[#2E4864] rounded-[var(--radius-ctl)] text-[14px] text-foam-50 placeholder:text-foam-500 focus:outline-none focus:border-biolum-400 focus:ring-1 focus:ring-biolum-400 transition-all"
          />
          <kbd
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-semibold text-foam-300 bg-black/40 border border-white/10 rounded-[4px] pointer-events-none select-none"
            title="Pressione Ctrl K para focar a busca"
          >
            Ctrl K
          </kbd>
        </div>

        {/* Ações contextuais */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};

