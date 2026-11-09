import React, { useState } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';

interface BaseFieldProps {
  label: string;
  error?: string;
  helperText?: string;
  id?: string;
}

export interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    BaseFieldProps {}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-foam-300">
        {label}
      </label>
      <input
        id={fieldId}
        className={`h-[40px] px-3.5 bg-white/[0.06] border ${
          error ? 'border-bad' : 'border-[#2E4864]'
        } rounded-[var(--radius-ctl)] text-[14px] text-foam-50 placeholder:text-foam-500 focus:outline-none focus:border-biolum-400 focus:ring-1 focus:ring-biolum-400 transition-colors ${className}`}
        {...props}
      />
      {error && <span className="text-[12px] text-bad mt-0.5">{error}</span>}
      {helperText && !error && (
        <span className="text-[12px] text-foam-500 mt-0.5">{helperText}</span>
      )}
    </div>
  );
};

export interface PasswordFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    BaseFieldProps {}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  label,
  error,
  helperText,
  id,
  value,
  className = '',
  ...props
}) => {
  const [revealed, setRevealed] = useState(false);
  const fieldId = id || `pwd-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-foam-300">
        {label}
      </label>
      <div className="relative w-full">
        <input
          id={fieldId}
          type={revealed ? 'text' : 'password'}
          value={value}
          className={`h-[40px] w-full pl-3.5 pr-10 bg-white/[0.06] border ${
            error ? 'border-bad' : 'border-[#2E4864]'
          } rounded-[var(--radius-ctl)] text-[14px] text-foam-50 placeholder:text-foam-500 focus:outline-none focus:border-biolum-400 focus:ring-1 focus:ring-biolum-400 transition-colors ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          aria-label={revealed ? 'Ocultar senha' : 'Revelar senha'}
          title={revealed ? 'Ocultar senha' : 'Revelar senha'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-foam-500 hover:text-foam-50 transition-colors rounded-[var(--radius-ctl)] focus-visible:outline-biolum-400"
        >
          {revealed ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">
        {revealed ? 'Senha visível' : 'Senha oculta'}
      </span>
      {error && <span className="text-[12px] text-bad mt-0.5">{error}</span>}
      {helperText && !error && (
        <span className="text-[12px] text-foam-500 mt-0.5">{helperText}</span>
      )}
    </div>
  );
};

export interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    BaseFieldProps {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const fieldId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-foam-300">
        {label}
      </label>
      <select
        id={fieldId}
        className={`h-[40px] px-3 bg-[#0A1626] border ${
          error ? 'border-bad' : 'border-[#2E4864]'
        } rounded-[var(--radius-ctl)] text-[14px] text-foam-50 focus:outline-none focus:border-biolum-400 focus:ring-1 focus:ring-biolum-400 transition-colors cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            className="bg-[#0A1626] text-foam-50"
          >
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-[12px] text-bad mt-0.5">{error}</span>}
      {helperText && !error && (
        <span className="text-[12px] text-foam-500 mt-0.5">{helperText}</span>
      )}
    </div>
  );
};

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onClear,
  placeholder = 'Buscar...',
  className = '',
  ...props
}) => {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search
        size={16}
        strokeWidth={1.5}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-foam-500 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        className={`w-full h-[38px] pl-9 pr-8 bg-white/[0.06] border border-[#2E4864] rounded-[var(--radius-ctl)] text-[14px] text-foam-50 placeholder:text-foam-500 focus:outline-none focus:border-biolum-400 focus:ring-1 focus:ring-biolum-400 transition-colors ${className}`}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Limpar busca"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-foam-500 hover:text-foam-50"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex items-center p-1 bg-black/40 border border-white/10 rounded-[var(--radius-ctl)] select-none">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-[13px] font-medium rounded-[6px] transition-all duration-150 flex items-center gap-1.5 ${
              isSelected
                ? 'bg-white/15 text-foam-50 shadow-sm'
                : 'text-foam-300 hover:text-foam-50 hover:bg-white/5'
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums ${
                  isSelected ? 'bg-white/20 text-foam-50' : 'bg-white/5 text-foam-500'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, value, onRemove }) => {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.08] border border-white/[0.14] rounded-full text-[12px] text-foam-50">
      <span className="text-foam-300">{label}:</span>
      <span className="font-medium text-foam-50">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover filtro ${label}`}
        className="text-foam-500 hover:text-foam-50 ml-0.5"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
};

