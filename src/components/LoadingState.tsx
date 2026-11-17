import React from 'react';

export function LoadingState({
  label = 'Cargando información...',
  rows = 4,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="w-full space-y-4 py-6" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-[#888888]">
        <div className="w-4 h-4 rounded-full border-2 border-[#ED1010] border-t-transparent animate-spin" />
        <span>{label}</span>
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full rounded-md bg-[#141414] border border-[#292929] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
