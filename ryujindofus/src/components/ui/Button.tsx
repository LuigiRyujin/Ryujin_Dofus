import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'h-[38px] px-4 rounded-[var(--radius-ctl)] text-[14px] font-medium inline-flex items-center justify-center gap-2 select-none cursor-pointer transition-all duration-150 active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-biolum-400 focus-visible:outline-offset-2';

  const variantClasses = {
    // Primário: fundo Espuma, texto escuro #0B0D12, nunca ciano
    primary:
      'bg-foam-50 text-[#0B0D12] font-semibold hover:bg-white hover:shadow-[0_0_15px_rgba(242,247,251,0.25)] hover:-translate-y-[1px]',
    // Secundário: vidro 8% + borda 16%
    secondary:
      'bg-white/[0.08] text-foam-50 border border-white/[0.16] hover:bg-white/[0.14] hover:border-white/[0.24] hover:-translate-y-[1px]',
    // Destrutivo: vermelho #F0706E com texto escuro
    destructive:
      'bg-bad text-[#0B0D12] font-semibold hover:bg-[#F2807E] hover:shadow-[0_0_12px_rgba(240,112,110,0.3)] hover:-translate-y-[1px]',
    // Ghost: transparente
    ghost:
      'bg-transparent text-foam-300 hover:text-foam-50 hover:bg-white/[0.06] hover:-translate-y-[1px]',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin text-current" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

