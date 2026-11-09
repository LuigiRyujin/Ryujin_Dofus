import React from 'react';
import { ArrowUp, Check, CircleDot, Clock } from 'lucide-react';

/* 1. Faixa de métricas: Um único bloco de vidro leve com 4 células */
export interface MetricCell {
  label: string;
  value: number | string;
  variation?: number;
}

export interface MetricStripProps {
  metrics: MetricCell[];
}

export const MetricStrip: React.FC<MetricStripProps> = ({ metrics }) => {
  return (
    <div className="glass w-full rounded-[var(--radius-card)] overflow-hidden shadow-lg mb-6 border border-[var(--border-app)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-app)]">
        {metrics.map((m, idx) => (
          <div key={idx} className="p-5 flex flex-col gap-1.5 select-none">
            <span className="text-[13px] font-medium text-[var(--text-secondary)] tracking-wide">
              {m.label}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-[30px] font-semibold text-[var(--text-primary)] tabular-nums leading-none">
                {m.value}
              </span>
              {m.variation !== undefined && (
                <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--status-ok)] bg-[var(--status-ok)]/15 px-2 py-0.5 rounded-full tabular-nums">
                  <ArrowUp size={12} strokeWidth={2.5} />
                  <span>{m.variation}</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* 2. BarChart: Barras finas com topo suavizado */
export interface BarDataPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface BarChartProps {
  data: BarDataPoint[];
  totalLabel?: string;
}

export const BarChart: React.FC<BarChartProps> = ({ data, totalLabel = 'Total: 158 operações' }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 35);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between text-[12px] text-[var(--text-tertiary)] mb-1">
        <span>Atividade diária</span>
        <span className="font-medium text-[var(--text-secondary)] tabular-nums">{totalLabel}</span>
      </div>

      <div className="h-[140px] w-full flex items-end justify-between gap-3 pt-4 px-2">
        {data.map((item, idx) => {
          const heightPercent = Math.round((item.value / maxValue) * 100);
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
              {/* Tooltip no hover */}
              <span className="text-[11px] font-semibold text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                {item.value}
              </span>

              {/* Barra fina com topo suavizado e hover dourado */}
              <div
                className={`w-[14px] rounded-t-[5px] rounded-b-[2px] transition-all duration-200 group-hover:bg-[var(--accent-gold)] ${
                  item.highlight ? 'bg-[var(--text-primary)] shadow-md' : 'bg-white/20'
                }`}
                style={{ height: `${heightPercent}%` }}
              />

              {/* Rótulo do dia */}
              <span
                className={`text-[12px] tracking-wide select-none ${
                  item.highlight ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-tertiary)]'
                }`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* 3. SegmentedBar: Barra segmentada horizontal com legenda numérica */
export interface SegmentItem {
  label: string;
  count: number;
  color: string;
}

export interface SegmentedBarProps {
  segments: SegmentItem[];
  total: number;
}

export const SegmentedBar: React.FC<SegmentedBarProps> = ({ segments, total }) => {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Barra empilhada horizontal (raio 4px) */}
      <div className="h-[12px] w-full bg-black/20 rounded-[4px] overflow-hidden flex p-0.5 gap-0.5">
        {segments.map((seg, idx) => {
          const percent = total > 0 ? (seg.count / total) * 100 : 0;
          if (percent === 0) return null;
          return (
            <div
              key={idx}
              title={`${seg.label}: ${seg.count} (${percent.toFixed(1)}%)`}
              className={`h-full rounded-[2px] transition-all duration-300 hover:brightness-110 ${seg.color}`}
              style={{ width: `${percent}%` }}
            />
          );
        })}
      </div>

      {/* Legenda numérica */}
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${seg.color}`} aria-hidden="true" />
              <span className="text-[var(--text-secondary)]">{seg.label}</span>
            </div>
            <strong className="text-[var(--text-primary)] font-semibold tabular-nums">{seg.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

/* 4. Timeline: Etapas verticais */
export interface TimelineStep {
  title: string;
  status: 'completed' | 'running' | 'pending';
  detail?: string;
}

export interface TimelineProps {
  steps: TimelineStep[];
}

export const Timeline: React.FC<TimelineProps> = ({ steps }) => {
  return (
    <div className="flex flex-col gap-0 py-2">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <div key={idx} className="flex items-start gap-3 relative pb-6">
            {!isLast && (
              <div
                className={`absolute left-[13px] top-[26px] bottom-0 w-[1.5px] ${
                  step.status === 'completed' ? 'bg-[var(--status-ok)]/50' : 'bg-white/10'
                }`}
                aria-hidden="true"
              />
            )}

            {/* Ícone do nó */}
            <div className="shrink-0 mt-0.5">
              {step.status === 'completed' && (
                <div className="w-[26px] h-[26px] rounded-full bg-[var(--status-ok)]/20 border border-[var(--status-ok)]/40 flex items-center justify-center text-[var(--status-ok)]">
                  <Check size={14} strokeWidth={2.5} />
                </div>
              )}
              {step.status === 'running' && (
                <div className="w-[26px] h-[26px] rounded-full bg-[var(--status-info)]/20 border border-[var(--status-info)]/50 flex items-center justify-center text-[var(--status-info)] animate-pulse">
                  <CircleDot size={14} strokeWidth={2} />
                </div>
              )}
              {step.status === 'pending' && (
                <div className="w-[26px] h-[26px] rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-[var(--text-tertiary)]">
                  <Clock size={13} strokeWidth={1.5} />
                </div>
              )}
            </div>

            {/* Texto da etapa */}
            <div className="flex flex-col">
              <span
                className={`text-[14px] font-medium leading-tight ${
                  step.status === 'pending' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
                }`}
              >
                {step.title}
              </span>
              {step.detail && (
                <span className="text-[12px] text-[var(--text-secondary)] mt-1">{step.detail}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* 5. AttentionList: Itens que exigem decisão do usuário */
export interface AttentionItem {
  id: string;
  title: string;
  severity: 'warn' | 'bad';
  description: string;
  actionText: string;
  onClick: () => void;
}

export interface AttentionListProps {
  items: AttentionItem[];
}

export const AttentionList: React.FC<AttentionListProps> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="p-4 text-[13px] text-[var(--text-tertiary)] text-center">
        Nenhuma pendência crítica no momento.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={item.onClick}
          className={`p-3.5 rounded-[var(--radius-ctl)] bg-white/[0.03] hover:bg-white/[0.07] border border-[var(--border-app)] transition-all cursor-pointer flex flex-col gap-1.5 ${
            item.severity === 'bad' ? 'border-l-4 border-l-[var(--status-bad)]' : 'border-l-4 border-l-[var(--status-warn)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
              {item.title}
            </span>
            <span className="text-[12px] text-[var(--accent-gold)] font-medium hover:underline">
              {item.actionText} →
            </span>
          </div>
          <p className="text-[12px] text-[var(--text-secondary)] leading-normal">{item.description}</p>
        </div>
      ))}
    </div>
  );
};
