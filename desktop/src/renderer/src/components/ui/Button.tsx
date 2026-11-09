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
    'h-[36px] px-3.5 rounded-[var(--radius-ctl)] text-[13px] font-medium inline-flex items-center justify-center gap-2 select-none cursor-pointer transition-all duration-150 active:translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--accent-gold)] focus-visible:outline-offset-2';

  const variantClasses = {
    primary:
      'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-semibold shadow-sm hover:opacity-95 hover:-translate-y-[1px]',
    secondary:
      'bg-white/[0.06] text-[var(--text-primary)] border border-[var(--border-app)] hover:bg-white/[0.12] hover:-translate-y-[1px]',
    destructive:
      'bg-[var(--status-bad)] text-white font-medium hover:brightness-110 hover:-translate-y-[1px]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] hover:-translate-y-[1px]'
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
