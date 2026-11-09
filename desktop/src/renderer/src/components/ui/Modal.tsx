import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  headerTabs?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: '440px' | '460px' | '560px' | '640px' | '720px' | '800px';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  headerTabs,
  children,
  footer,
  maxWidth = '460px'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else if (previousFocus.current) {
      previousFocus.current.focus();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[12px] animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ maxWidth, width: '100%' }}
        className="glass rounded-[var(--radius-modal)] border border-[var(--border-app)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 outline-none"
      >
        {/* Barra de título do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-app)] select-none">
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] leading-tight">{title}</h3>
            {description && (
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-[var(--radius-ctl)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Sub-Abas do Modal (se fornecido) */}
        {headerTabs}

        {/* Corpo do Modal */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-130px)] text-[var(--text-primary)]">
          {children}
        </div>

        {/* Rodapé de Ações */}
        {footer && (
          <div className="px-6 py-4 bg-black/20 border-t border-[var(--border-app)] flex items-center justify-end gap-3 select-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
