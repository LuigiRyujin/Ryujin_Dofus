import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface ModalTabItem {
  id: string;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  badge?: string | number;
}

interface ModalTabsProps {
  tabs: readonly ModalTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const ModalTabs: React.FC<ModalTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-1 border-b border-[var(--border-app)] px-6 pt-2 pb-0 bg-black/10 select-none overflow-x-auto ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors outline-none cursor-pointer ${
              active
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {Icon && (
              <Icon
                size={14}
                className={active ? 'text-[var(--accent-gold)]' : 'text-current'}
              />
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-[var(--radius-tag)] bg-white/10 text-[var(--text-secondary)] tabular-nums">
                {tab.badge}
              </span>
            )}
            {active && (
              <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[var(--accent-gold)] shadow-[0_0_8px_var(--accent-gold-glow)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};

