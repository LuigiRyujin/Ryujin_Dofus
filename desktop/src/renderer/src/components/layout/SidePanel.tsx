import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      panelRef.current?.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop transparente para capturar clique fora */}
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel Flutuante (400px) */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="glass fixed top-[42px] right-[12px] bottom-[12px] w-[400px] max-w-[calc(100vw-24px)] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 outline-none border border-[var(--border-app)] rounded-[14px]"
        style={{
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--border-app)]">
          <div className="flex flex-col">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] leading-tight">
              {title}
            </h3>
            {subtitle && (
              <span className="text-[13px] text-[var(--text-tertiary)] mt-1">{subtitle}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="p-1 rounded-[var(--radius-ctl)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Corpo com rolagem */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Rodapé opcional */}
        {footer && (
          <div className="p-4 border-t border-[var(--border-app)] bg-black/10 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
};
