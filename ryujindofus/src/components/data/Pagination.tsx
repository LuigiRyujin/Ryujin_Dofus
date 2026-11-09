import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (newPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[#162840] select-none text-[13px] text-foam-300">
      <span className="tabular-nums">
        {total > 0 ? (
          <>
            <strong className="text-foam-50 font-semibold">{startItem}–{endItem}</strong> de{' '}
            <strong className="text-foam-50 font-semibold">{total}</strong>
          </>
        ) : (
          'Nenhum registro'
        )}
      </span>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="p-1.5 rounded-[var(--radius-ctl)] text-foam-300 hover:text-foam-50 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </button>

        <span className="px-2 text-foam-50 font-medium tabular-nums text-[13px]">
          Página {page} de {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
          className="p-1.5 rounded-[var(--radius-ctl)] text-foam-300 hover:text-foam-50 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

