import React from 'react';
import { Skeleton } from '../ui/States';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  cell: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedId?: string;
  loading?: boolean;
  emptyState?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedId,
  loading = false,
  emptyState
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="surface card-corners overflow-hidden">
        <div className="p-4 flex flex-col gap-3">
          <Skeleton height={32} className="w-full opacity-60" />
          <Skeleton height={42} className="w-full" />
          <Skeleton height={42} className="w-full" />
          <Skeleton height={42} className="w-full" />
          <Skeleton height={42} className="w-full" />
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <div className="surface card-corners">{emptyState}</div>;
  }

  return (
    <div className="surface card-corners overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-app)] bg-black/10 select-none">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={{ width: col.width }}
                  className={`px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[0.05em] ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const id = keyExtractor(row);
              const isSelected = selectedId === id;
              const isClickable = Boolean(onRowClick);

              return (
                <tr
                  key={id}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick?.(row);
                    }
                  }}
                  className={`border-b border-[var(--border-muted)] transition-colors duration-150 ${
                    isSelected
                      ? 'bg-[var(--accent-gold)]/[0.12]'
                      : 'hover:bg-white/[0.04]'
                  } ${isClickable ? 'cursor-pointer focus-visible:outline-[var(--accent-gold)]' : ''}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-[var(--text-primary)] ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
