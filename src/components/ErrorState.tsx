import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'No se pudo cargar la información',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="w-full bg-[#141414] border border-[#ED1010]/40 rounded-lg p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#ED1010] shrink-0 mt-0.5" />
        <div>
          <h3 className="font-display text-lg uppercase tracking-wide text-white">
            {title}
          </h3>
          <p className="text-sm text-[#888888] mt-1">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#292929] hover:bg-[#383838] text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      )}
    </div>
  );
}
