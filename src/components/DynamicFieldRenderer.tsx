import React from 'react';
import { Check } from 'lucide-react';
import type { FormFieldConfig } from '../types/mego';
import { SizeSelector } from './SizeSelector';

interface DynamicFieldRendererProps {
  field: FormFieldConfig;
  value: any;
  availableSizes?: string[];
  error?: string;
  onChange: (value: any) => void;
  disabled?: boolean;
}

export function DynamicFieldRenderer({
  field,
  value,
  availableSizes,
  error,
  onChange,
  disabled = false,
}: DynamicFieldRendererProps) {
  if (!field.enabled) return null;

  const inputId = `mego-field-${field.id}`;
  const baseInputClass =
    'w-full min-h-[48px] px-4 py-3 bg-[#0D0D0D] border rounded-md text-base text-white placeholder-[#666666] outline-none transition-colors ' +
    (error ? 'border-[#ED1010]' : 'border-[#292929] focus:border-[#ED1010]');

  const renderControl = () => {
    // Special visual size selector for TALLA
    if (field.key === 'size') {
      const sizes =
        availableSizes && availableSizes.length > 0
          ? availableSizes
          : field.options || ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
      return (
        <SizeSelector
          sizes={sizes}
          value={String(value || '')}
          onChange={onChange}
          disabled={disabled}
        />
      );
    }

    // Special visual payment modality selector (mutually exclusive radio)
    if (field.key === 'paymentSelection' || field.type === 'single_choice') {
      const opts = field.options || [];
      return (
        <div
          className={`grid gap-2.5 ${opts.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}
          role="radiogroup"
          aria-labelledby={`${inputId}-label`}
        >
          {opts.map((opt) => {
            const checked = value === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => onChange(opt)}
                className={`min-h-[52px] px-4 py-3 rounded-md border text-left flex items-center justify-between gap-3 transition-all ${
                  checked
                    ? 'bg-[#ED1010]/15 border-[#ED1010] text-white'
                    : 'bg-[#0D0D0D] border-[#292929] text-[#D4D4D4] hover:border-[#666666]'
                }`}
              >
                <span className="font-medium text-sm sm:text-base">{opt}</span>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    checked ? 'border-[#ED1010] bg-[#ED1010] text-white' : 'border-[#525252]'
                  }`}
                >
                  {checked && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (field.type === 'long_text') {
      return (
        <textarea
          id={inputId}
          rows={3}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength || 1000}
          disabled={disabled}
          className={`${baseInputClass} min-h-[96px]`}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          id={inputId}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={baseInputClass}
        >
          <option value="">Selecciona una opción...</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'multi_checkbox') {
      const selected: string[] = Array.isArray(value) ? value : [];
      const toggle = (opt: string) => {
        if (selected.includes(opt)) {
          onChange(selected.filter((x) => x !== opt));
        } else {
          onChange([...selected, opt]);
        }
      };
      return (
        <div className="space-y-2">
          {(field.options || []).map((opt) => {
            const isChecked = selected.includes(opt);
            return (
              <label
                key={opt}
                className={`min-h-[48px] px-4 py-2.5 rounded-md border flex items-center gap-3 cursor-pointer transition-colors ${
                  isChecked
                    ? 'bg-[#ED1010]/10 border-[#ED1010] text-white'
                    : 'bg-[#0D0D0D] border-[#292929] text-[#D4D4D4]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => toggle(opt)}
                  className="w-4 h-4 accent-[#ED1010]"
                />
                <span className="text-sm sm:text-base">{opt}</span>
              </label>
            );
          })}
        </div>
      );
    }

    const htmlType =
      field.type === 'email'
        ? 'email'
        : field.type === 'phone'
          ? 'tel'
          : field.type === 'date'
            ? 'date'
            : field.type === 'number'
              ? 'number'
              : 'text';

    return (
      <input
        id={inputId}
        type={htmlType}
        inputMode={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'numeric' : undefined}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        maxLength={field.maxLength || 160}
        disabled={disabled}
        className={baseInputClass}
      />
    );
  };

  return (
    <div className="space-y-2">
      <label
        id={`${inputId}-label`}
        htmlFor={inputId}
        className="block text-xs sm:text-sm font-semibold tracking-wide uppercase text-white"
      >
        {field.label}
        {field.required && <span className="text-[#ED1010] ml-1" aria-hidden="true">*</span>}
      </label>

      {renderControl()}

      {field.helpText && !error && (
        <p className="text-xs text-[#888888] leading-relaxed">{field.helpText}</p>
      )}
      {error && (
        <p className="text-xs text-[#ED1010] font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
