import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = true,
  loading = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04060A]/60 backdrop-blur-[12px] animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="glass max-w-[440px] w-full rounded-[var(--radius-glass)] shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200 outline-none"
      >
        <div className="flex gap-4 items-start">
          {/* Quadrado de 40px com fundo vermelho a 12% */}
          <div className="w-[40px] h-[40px] shrink-0 rounded-[var(--radius-ctl)] bg-bad/12 border border-bad/20 flex items-center justify-center text-bad">
            <AlertTriangle size={20} strokeWidth={1.75} />
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <h3 className="text-[16px] font-semibold text-foam-50 leading-tight">
              {title}
            </h3>
            <p className="text-[14px] text-foam-300 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

