import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface RowActionsMenuProps {
  items: ActionMenuItem[];
}

export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Ações da linha"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="p-1.5 rounded-[var(--radius-ctl)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors focus-visible:outline-[var(--accent-gold)]"
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="glass absolute right-0 top-full mt-1.5 w-48 rounded-[var(--radius-ctl)] py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-[var(--border-app)] z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)'
          }}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setIsOpen(false);
                item.onClick();
              }}
              className={`w-full text-left px-3.5 py-2 text-[13px] flex items-center gap-2.5 transition-colors ${
                item.destructive
                  ? 'text-[var(--status-bad)] hover:bg-[var(--status-bad)]/15'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10'
              } disabled:opacity-40 disabled:pointer-events-none`}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
