import React, { ReactNode } from 'react';
import { LucideIcon, RefreshCcw } from 'lucide-react';

export interface OperationalWorkspaceItem<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  badge?: string | number;
  badgeTone?: 'default' | 'success' | 'warning' | 'danger';
}

interface OperationalWorkspaceProps<T extends string> {
  items: readonly OperationalWorkspaceItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  children: ReactNode;
  headerTitle?: string;
  headerDescription?: string;
  statusNode?: ReactNode;
  bottom?: ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdatedAt?: string;
  className?: string;
}

export function OperationalWorkspace<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  children,
  headerTitle,
  headerDescription,
  statusNode,
  bottom,
  onRefresh,
  isRefreshing = false,
  lastUpdatedAt,
  className = '',
}: OperationalWorkspaceProps<T>) {
  return (
    <div
      className={`glass rounded-[var(--radius-card)] border border-[var(--border-app)] overflow-hidden flex flex-col min-h-[680px] w-full ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      {/* Cabeçalho do Workspace (se fornecido) */}
      {(headerTitle || statusNode) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[var(--border-app)] bg-black/10 select-none">
          <div>
            {headerTitle && (
              <h2 className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight">
                {headerTitle}
              </h2>
            )}
            {headerDescription && (
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                {headerDescription}
              </p>
            )}
          </div>
          {statusNode && <div className="flex items-center gap-2">{statusNode}</div>}
        </div>
      )}

      {/* Grid: Rail de Sub-Abas + Viewport de Conteúdo */}
      <div className="grid grid-cols-1 xl:grid-cols-[210px_minmax(0,1fr)] flex-1 min-h-0">
        {/* Rail de Sub-Abas */}
        <aside className="border-b xl:border-b-0 xl:border-r border-[var(--border-app)] bg-black/15 flex flex-col justify-between">
          <nav
            aria-label={ariaLabel}
            role="tablist"
            className="flex gap-1.5 overflow-x-auto p-2.5 xl:flex-col xl:p-3 xl:space-y-1 xl:overflow-visible"
          >
            {items.map((item) => {
              const active = item.value === value;
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onChange(item.value)}
                  className={`group relative flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-[var(--radius-ctl)] text-[13px] font-medium transition-all shrink-0 xl:w-full select-none text-left ${
                    active
                      ? 'bg-[var(--accent-gold)]/15 text-[var(--text-primary)] border border-[var(--accent-gold)]/40 shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {Icon && (
                      <Icon
                        size={15}
                        className={`shrink-0 transition-colors ${
                          active
                            ? 'text-[var(--accent-gold)]'
                            : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                        }`}
                      />
                    )}
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[11px] font-semibold tabular-nums rounded-[var(--radius-tag)] shrink-0 ${
                        item.badgeTone === 'success'
                          ? 'bg-[#4CC38A]/20 text-[#4CC38A] border border-[#4CC38A]/30'
                          : item.badgeTone === 'warning'
                          ? 'bg-[#E0A84A]/20 text-[#E0A84A] border border-[#E0A84A]/30'
                          : item.badgeTone === 'danger'
                          ? 'bg-[#F0706E]/20 text-[#F0706E] border border-[#F0706E]/30'
                          : 'bg-white/10 text-[var(--text-secondary)]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Rodapé do Rail */}
          <div className="hidden xl:flex flex-col gap-2 p-3 border-t border-[var(--border-app)]/60 bg-black/10 text-[11px] text-[var(--text-tertiary)]">
            {bottom}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-ctl)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                <RefreshCcw size={12} className={isRefreshing ? 'animate-spin' : ''} />
                <span>
                  {isRefreshing
                    ? 'Atualizando…'
                    : lastUpdatedAt
                    ? `Atualizado ${lastUpdatedAt}`
                    : 'Atualizar dados'}
                </span>
              </button>
            )}
          </div>
        </aside>

        {/* Viewport de Conteúdo com rolagem limpa */}
        <div className="flex flex-col min-w-0 p-5 xl:p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

