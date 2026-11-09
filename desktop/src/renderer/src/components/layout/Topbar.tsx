import React, { useEffect, useRef } from 'react';
import { Search, Sun, Moon } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  actions?: React.ReactNode;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  actions,
  theme = 'dark',
  onToggleTheme
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

    let unsubscribeIpc: (() => void) | undefined;
    if (window.ryujin?.onGlobalSearch) {
      unsubscribeIpc = window.ryujin.onGlobalSearch(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (unsubscribeIpc) unsubscribeIpc();
    };
  }, []);

  const isDark = theme === 'dark';

  return (
    <header className="glass h-[58px] w-full flex items-center justify-between px-6 z-30 mb-6 rounded-[14px] border border-[var(--border-app)]">
      {/* Esquerda: Título e subtítulo */}
      <div className="flex items-baseline gap-3 truncate">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)] tracking-tight truncate">
          {title}
        </h2>
        <span className="text-[13px] text-[var(--text-tertiary)] hidden sm:inline truncate">
          {subtitle}
        </span>
      </div>

      {/* Direita: Busca Global, Troca de Tema e Ações */}
      <div className="flex items-center gap-3">
        {/* Campo de Busca Global (280px) */}
        <div className="relative w-[280px] max-sm:w-[180px]">
          <Search
            size={16}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar..."
            aria-label="Buscar no sistema"
            className="w-full h-[36px] pl-9 pr-16 bg-white/[0.05] border border-[var(--border-app)] rounded-[var(--radius-ctl)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-gold)] transition-all"
          />
          <kbd
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] bg-black/20 border border-[var(--border-muted)] rounded-[4px] pointer-events-none select-none"
            title="Pressione Ctrl K para focar a busca"
          >
            Ctrl K
          </kbd>
        </div>

        {/* Botão de Troca Rápida de Tema */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label={isDark ? 'Tema Claro' : 'Tema Escuro'}
            className="h-[36px] w-[36px] rounded-[var(--radius-ctl)] border border-[var(--border-app)] bg-white/[0.05] hover:bg-white/[0.1] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors"
          >
            {isDark ? <Sun size={17} strokeWidth={1.7} /> : <Moon size={17} strokeWidth={1.7} />}
          </button>
        )}

        {/* Ações contextuais */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
