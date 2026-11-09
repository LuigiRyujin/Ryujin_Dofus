import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
}) => {
  return (
    <div
      aria-busy="true"
      className={`animate-pulse bg-white/[0.07] rounded-[var(--radius-ctl)] ${className}`}
      style={{ width, height }}
    />
  );
};

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center select-none">
      {/* Símbolo do dragão a 72px de altura e 25% de opacidade (Seção 3) */}
      <div
        className="h-[72px] aspect-[257/440] mark text-foam-50 opacity-25 mb-4"
        aria-hidden="true"
      />
      <h4 className="text-[16px] font-semibold text-foam-50 mb-1">{title}</h4>
      <p className="text-[14px] text-foam-300 max-w-sm mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  cause: string;
  howToFix?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Ocorreu um erro',
  cause,
  howToFix,
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center select-none bg-bad/5 border border-bad/20 rounded-[var(--radius-card)]">
      <div className="w-10 h-10 rounded-full bg-bad/15 flex items-center justify-center text-bad mb-3">
        <AlertCircle size={22} strokeWidth={1.75} />
      </div>
      <h4 className="text-[16px] font-semibold text-foam-50 mb-1">{title}</h4>
      <p className="text-[14px] text-bad mb-1">{cause}</p>
      {howToFix && <p className="text-[13px] text-foam-500 mb-5">{howToFix}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<RefreshCw size={14} />}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
};

