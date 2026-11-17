import type { ContractStatus } from '../types/mego';

export const SUPPORTED_TIMEZONES = [
  'America/Caracas',
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/New_York',
  'Europe/Madrid',
  'UTC',
] as const;

export const CONTRACT_STATUS_META: Record<
  ContractStatus,
  { label: string; shortLabel: string; colorClass: string; isOpen: boolean }
> = {
  draft: {
    label: 'Borrador',
    shortLabel: 'Borrador',
    colorClass: 'text-[#888888]',
    isOpen: false,
  },
  scheduled: {
    label: 'Programado',
    shortLabel: 'Programado',
    colorClass: 'text-[#38BDF8]',
    isOpen: false,
  },
  active: {
    label: 'Abierto',
    shortLabel: 'Abierto',
    colorClass: 'text-[#4ADE80]',
    isOpen: true,
  },
  paused: {
    label: 'Pausado',
    shortLabel: 'Pausado',
    colorClass: 'text-[#FBBF24]',
    isOpen: false,
  },
  auto_closed: {
    label: 'Cerrado automáticamente',
    shortLabel: 'Cierre auto',
    colorClass: 'text-[#F87171]',
    isOpen: false,
  },
  closed: {
    label: 'Cerrado manualmente',
    shortLabel: 'Cerrado',
    colorClass: 'text-[#F87171]',
    isOpen: false,
  },
  finished: {
    label: 'Finalizado',
    shortLabel: 'Finalizado',
    colorClass: 'text-[#A3A3A3]',
    isOpen: false,
  },
  archived: {
    label: 'Archivado',
    shortLabel: 'Archivado',
    colorClass: 'text-[#737373]',
    isOpen: false,
  },
};

export interface ScheduleInput {
  status: ContractStatus;
  openDate?: string;
  openTime?: string;
  closeDate?: string;
  closeTime?: string;
  timezone?: string;
  closedMessage?: string;
}

export interface WindowEvaluationResult {
  effectiveStatus: ContractStatus;
  isAcceptingRegistrations: boolean;
  openAtMs: number | null;
  closeAtMs: number | null;
  timezone: string;
  reasonCode:
    | 'OPEN'
    | 'DRAFT'
    | 'PAUSED'
    | 'NOT_YET_OPEN'
    | 'EXPIRED'
    | 'MANUAL_CLOSED'
    | 'FINISHED'
    | 'ARCHIVED';
  visitorMessage: string;
}

function getTimezoneOffsetMs(utcGuessMs: number, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = formatter.formatToParts(new Date(utcGuessMs));
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = Number(p.value);
      }
    }
    const hour = map.hour === 24 ? 0 : map.hour;
    const asUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      hour,
      map.minute,
      map.second
    );
    return asUtc - utcGuessMs;
  } catch {
    return 0;
  }
}

/**
 * Converts a calendar date (YYYY-MM-DD) and wall-clock time (HH:mm) in a given IANA timezone
 * into an exact UTC epoch timestamp in milliseconds.
 */
export function computeLocalTimestampUtcMs(
  dateStr?: string,
  timeStr?: string,
  timeZone = 'America/Caracas'
): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return null;
  }
  const cleanTime =
    timeStr && /^\d{2}:\d{2}$/.test(timeStr.trim()) ? timeStr.trim() : '00:00';
  const [y, m, d] = dateStr.trim().split('-').map(Number);
  const [hh, mm] = cleanTime.split(':').map(Number);

  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offset1 = getTimezoneOffsetMs(utcGuess, timeZone);
  const adjusted = utcGuess - offset1;
  const offset2 = getTimezoneOffsetMs(adjusted, timeZone);
  return utcGuess - offset2;
}

export function formatWindowDisplay(
  dateStr?: string,
  timeStr?: string,
  timezone?: string
): string {
  if (!dateStr) return 'Sin programar';
  const t = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : '00:00';
  return `${dateStr} ${t}${timezone ? ` (${timezone})` : ''}`;
}

/**
 * Authoritative window evaluation used on both the Express server and client UI.
 * Enforces automatic opening for 'scheduled' contracts and automatic expiry for 'active' contracts.
 */
export function evaluateContractWindow(
  contract: ScheduleInput,
  nowMs: number = Date.now()
): WindowEvaluationResult {
  const tz = contract.timezone || 'America/Caracas';
  const openAtMs = computeLocalTimestampUtcMs(
    contract.openDate,
    contract.openTime || '00:00',
    tz
  );
  const closeAtMs = computeLocalTimestampUtcMs(
    contract.closeDate,
    contract.closeTime || '23:59',
    tz
  );

  if (contract.status === 'draft') {
    return {
      effectiveStatus: 'draft',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'DRAFT',
      visitorMessage:
        contract.closedMessage?.trim() ||
        'Este contrato aún se encuentra en preparación (Borrador) y no admite registros todavía.',
    };
  }

  if (contract.status === 'paused') {
    return {
      effectiveStatus: 'paused',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'PAUSED',
      visitorMessage:
        contract.closedMessage?.trim() ||
        'El proceso de registro fue pausado temporalmente por el equipo organizador.',
    };
  }

  if (contract.status === 'closed') {
    return {
      effectiveStatus: 'closed',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'MANUAL_CLOSED',
      visitorMessage:
        contract.closedMessage?.trim() ||
        'Este contrato fue cerrado manualmente por el administrador y ya no acepta nuevos registros.',
    };
  }

  if (contract.status === 'auto_closed') {
    return {
      effectiveStatus: 'auto_closed',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'EXPIRED',
      visitorMessage:
        contract.closedMessage?.trim() ||
        'El plazo programado de registro para este contrato ha vencido automáticamente.',
    };
  }

  if (contract.status === 'finished') {
    return {
      effectiveStatus: 'finished',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'FINISHED',
      visitorMessage:
        contract.closedMessage?.trim() ||
        'Este contrato ya fue finalizado y enviado a fabricación.',
    };
  }

  if (contract.status === 'archived') {
    return {
      effectiveStatus: 'archived',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'ARCHIVED',
      visitorMessage:
        contract.closedMessage?.trim() || 'Este contrato se encuentra archivado.',
    };
  }

  // Status is either 'scheduled' or 'active' -> check time window boundaries
  if (closeAtMs !== null && nowMs >= closeAtMs) {
    return {
      effectiveStatus: 'auto_closed',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'EXPIRED',
      visitorMessage:
        contract.closedMessage?.trim() ||
        `El período de registro cerró automáticamente el ${formatWindowDisplay(
          contract.closeDate,
          contract.closeTime || '23:59',
          tz
        )}.`,
    };
  }

  if (openAtMs !== null && nowMs < openAtMs) {
    return {
      effectiveStatus: 'scheduled',
      isAcceptingRegistrations: false,
      openAtMs,
      closeAtMs,
      timezone: tz,
      reasonCode: 'NOT_YET_OPEN',
      visitorMessage: `El formulario abrirá automáticamente el ${formatWindowDisplay(
        contract.openDate,
        contract.openTime || '00:00',
        tz
      )}.`,
    };
  }

  return {
    effectiveStatus: 'active',
    isAcceptingRegistrations: true,
    openAtMs,
    closeAtMs,
    timezone: tz,
    reasonCode: 'OPEN',
    visitorMessage: '',
  };
}

export interface LinkAvailabilityResult {
  allowed: boolean;
  reasonCode: 'ALLOWED' | 'MODE_DISABLED' | 'LINK_EXPIRED' | 'WINDOW_CLOSED';
  message: string;
  window: WindowEvaluationResult;
}

/**
 * Evaluates both the contract time window AND modality-specific enable/expiration flags.
 */
export function evaluatePublicLinkAvailability(
  contract: ScheduleInput & {
    individualRegistrationEnabled?: boolean;
    bulkRegistrationEnabled?: boolean;
    individualLinkExpiresAt?: string;
    bulkLinkExpiresAt?: string;
  },
  mode: 'individual' | 'bulk',
  nowMs: number = Date.now()
): LinkAvailabilityResult {
  const windowEval = evaluateContractWindow(contract, nowMs);

  if (mode === 'individual' && contract.individualRegistrationEnabled === false) {
    return {
      allowed: false,
      reasonCode: 'MODE_DISABLED',
      message:
        'El portal de registro individual está deshabilitado para este contrato por el administrador.',
      window: windowEval,
    };
  }

  if (mode === 'bulk' && !contract.bulkRegistrationEnabled) {
    return {
      allowed: false,
      reasonCode: 'MODE_DISABLED',
      message:
        'El portal de registro masivo por organizaciones no está habilitado para este contrato.',
      window: windowEval,
    };
  }

  const expStr =
    mode === 'bulk' ? contract.bulkLinkExpiresAt : contract.individualLinkExpiresAt;
  if (expStr && expStr.trim()) {
    const expMs = /^\d{4}-\d{2}-\d{2}$/.test(expStr.trim())
      ? computeLocalTimestampUtcMs(
          expStr.trim(),
          '23:59',
          contract.timezone || 'America/Caracas'
        )
      : Date.parse(expStr.trim());
    if (expMs !== null && !Number.isNaN(expMs) && nowMs >= expMs) {
      return {
        allowed: false,
        reasonCode: 'LINK_EXPIRED',
        message:
          'Este enlace de registro ha expirado. Solicita un enlace vigente a tu organización o a MEGO FORCE.',
        window: windowEval,
      };
    }
  }

  if (!windowEval.isAcceptingRegistrations) {
    return {
      allowed: false,
      reasonCode: 'WINDOW_CLOSED',
      message: windowEval.visitorMessage,
      window: windowEval,
    };
  }

  return {
    allowed: true,
    reasonCode: 'ALLOWED',
    message: '',
    window: windowEval,
  };
}

