import React from 'react';
import { CheckCircle2, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import type { SyncJobStatus } from '../types/mego';

interface SyncStatusProps {
  status?: SyncJobStatus;
  lastSyncAt?: string;
  errorMessage?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function SyncStatus({
  status = 'pending',
  lastSyncAt,
  errorMessage,
  onRetry,
  retrying = false,
}: SyncStatusProps) {
  const cfg = {
    synced: {
      label: 'Sincronizado',
      color: 'text-[#4ADE80]',
      Icon: CheckCircle2,
    },
    retrying: {
      label: 'Reintentando...',
      color: 'text-[#FBBF24]',
      Icon: RefreshCw,
    },
    error: {
      label: 'Error de sincronización',
      color: 'text-[#ED1010]',
      Icon: AlertTriangle,
    },
    pending: {
      label: 'Pendiente',
      color: 'text-[#888888]',
      Icon: Clock,
    },
  }[status];

  const Icon = cfg.Icon;

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <span className={`inline-flex items-center gap-1.5 font-medium ${cfg.color}`}>
        <Icon className={`w-3.5 h-3.5 ${status === 'retrying' ? 'animate-spin' : ''}`} />
        {cfg.label}
      </span>
      {lastSyncAt && (
        <span className="text-[#888888] tabular-nums">
          · {new Date(lastSyncAt).toLocaleString('es-ES')}
        </span>
      )}
      {errorMessage && (
        <span className="text-[#F87171] max-w-xs truncate" title={errorMessage}>
          · {errorMessage}
        </span>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#292929] hover:bg-[#383838] text-white rounded text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Sincronizando...' : 'Sincronizar ahora'}
        </button>
      )}
    </div>
  );
}
