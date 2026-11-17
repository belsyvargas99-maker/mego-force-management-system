import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#292929] text-xs text-[#888888]">
      <span className="tabular-nums">
        Mostrando {start}–{end} de {totalItems} registros
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Página anterior"
          className="h-9 px-3 inline-flex items-center gap-1 bg-[#141414] border border-[#292929] hover:border-[#525252] disabled:opacity-40 rounded text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        <span className="px-2 text-white font-medium tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
          className="h-9 px-3 inline-flex items-center gap-1 bg-[#141414] border border-[#292929] hover:border-[#525252] disabled:opacity-40 rounded text-white transition-colors"
        >
          Siguiente
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
