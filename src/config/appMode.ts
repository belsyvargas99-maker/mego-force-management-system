import {
  buildPublicUrl,
  canAccessAdmin,
  canAccessPublicPortal,
  resolveAppMode,
  type AppMode,
} from '../utils/appMode';

/**
 * Valores horneados en el build por Vite (ver .env.example y el Dockerfile).
 * Ninguno es secreto: son nombres de dominio.
 */
const PUBLIC_HOST = import.meta.env.VITE_PUBLIC_HOST as string | undefined;
const ADMIN_HOST = import.meta.env.VITE_ADMIN_HOST as string | undefined;
const FALLBACK_MODE = import.meta.env.VITE_APP_MODE as string | undefined;

export const APP_MODE: AppMode = resolveAppMode(window.location.hostname, {
  publicHost: PUBLIC_HOST,
  adminHost: ADMIN_HOST,
  fallbackMode: FALLBACK_MODE,
});

export const IS_ADMIN_ENABLED = canAccessAdmin(APP_MODE);
export const IS_PUBLIC_PORTAL_ENABLED = canAccessPublicPortal(APP_MODE);

/** Enlace absoluto al portal público (para copiar/compartir con clientes). */
export function publicUrl(pathname: string): string {
  return buildPublicUrl(pathname, {
    hostname: window.location.hostname,
    origin: window.location.origin,
    publicHost: PUBLIC_HOST,
  });
}
