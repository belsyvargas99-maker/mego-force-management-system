import React from 'react';
import { Check } from 'lucide-react';

interface SizeSelectorProps {
  sizes: string[];
  value: string;
  onChange: (size: string) => void;
  disabled?: boolean;
}

export function SizeSelector({
  sizes,
  value,
  onChange,
  disabled = false,
}: SizeSelectorProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" role="radiogroup" aria-label="Selector de talla">
      {sizes.map((size) => {
        const selected = value === size;
        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(size)}
            className={`min-h-[48px] px-3 py-2.5 rounded-md border text-sm font-display tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all ${
              selected
                ? 'bg-[#ED1010] border-[#ED1010] text-white font-bold'
                : 'bg-[#0F0F0F] border-[#292929] text-[#E5E5E5] hover:border-[#888888]'
            }`}
          >
            {selected && <Check className="w-4 h-4 shrink-0" />}
            <span>{size}</span>
          </button>
        );
      })}
    </div>
  );
}
