import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Desaparece automaticamente em 2.4 segundos (Seção 9)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Container fixo no canto inferior central */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none select-none max-w-[90vw]"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="glass pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-white/15 animate-in fade-in slide-in-from-bottom-2 duration-150 min-w-[280px]"
            style={{
              backgroundColor: 'rgba(10, 22, 38, 0.94)',
            }}
          >
            {t.type === 'success' && (
              <CheckCircle2 size={18} className="text-ok shrink-0" strokeWidth={1.75} />
            )}
            {t.type === 'error' && (
              <AlertCircle size={18} className="text-bad shrink-0" strokeWidth={1.75} />
            )}
            {t.type === 'info' && (
              <Info size={18} className="text-info shrink-0" strokeWidth={1.75} />
            )}

            <span className="text-[13px] font-medium text-foam-50 flex-1">
              {t.message}
            </span>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              aria-label="Fechar notificação"
              className="text-foam-500 hover:text-foam-50 p-0.5 ml-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

