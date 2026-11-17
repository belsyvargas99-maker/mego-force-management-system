/**
 * Separación por subdominio (portal público vs. panel administrativo).
 *
 * El MISMO build sirve los dos subdominios. El modo se decide así:
 *   1. Si el hostname coincide con el host admin configurado  -> 'admin'
 *   2. Si el hostname coincide con el host público configurado -> 'public'
 *   3. Si hay un modo de respaldo explícito (VITE_APP_MODE / APP_MODE) -> ese modo
 *   4. Si es un host de desarrollo local (localhost, 127.0.0.1, *.localhost) -> 'all'
 *   5. Cualquier otro host desconocido -> 'public' (lo más seguro: nunca expone el panel)
 *
 * Este archivo no depende del navegador ni de Node, así lo usan el frontend
 * (src/App.tsx) y el servidor (server.ts) con la misma lógica.
 */

export type AppMode = 'public' | 'admin' | 'all';

export interface HostModeConfig {
  publicHost?: string | null;
  adminHost?: string | null;
  fallbackMode?: string | null;
}

export function normalizeHostname(value: string | null | undefined): string {
  let host = String(value || '').trim().toLowerCase();
  if (!host) return '';
  // Quitar protocolo si alguien pegó una URL completa en la variable
  host = host.replace(/^[a-z]+:\/\//, '');
  // Quitar ruta
  host = host.split('/')[0];
  // IPv6 entre corchetes: [::1]:3000 -> ::1
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end > 0 ? host.slice(1, end) : host;
  }
  // Quitar puerto (solo si hay un único ':', para no romper IPv6 sin corchetes)
  if ((host.match(/:/g) || []).length === 1) {
    host = host.split(':')[0];
  }
  // Quitar punto final (FQDN absoluto)
  return host.replace(/\.$/, '');
}

export function isLocalDevHost(hostname: string | null | undefined): boolean {
  const host = normalizeHostname(hostname);
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost')
  );
}

export function parseAppMode(value: string | null | undefined): AppMode | null {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'public' || mode === 'admin' || mode === 'all' ? mode : null;
}

export function resolveAppMode(hostname: string | null | undefined, config: HostModeConfig): AppMode {
  const host = normalizeHostname(hostname);
  const adminHost = normalizeHostname(config.adminHost);
  const publicHost = normalizeHostname(config.publicHost);

  if (adminHost && host === adminHost) return 'admin';
  if (publicHost && host === publicHost) return 'public';

  const fallback = parseAppMode(config.fallbackMode);
  if (fallback) return fallback;

  if (isLocalDevHost(host)) return 'all';

  return 'public';
}

export function canAccessAdmin(mode: AppMode): boolean {
  return mode === 'admin' || mode === 'all';
}

export function canAccessPublicPortal(mode: AppMode): boolean {
  return mode === 'public' || mode === 'all';
}

/**
 * /api o /api/lo-que-sea, sin distinguir mayúsculas (Express enruta /API/... igual
 * que /api/...).
 */
export function isApiPath(pathname: string): boolean {
  const p = String(pathname || '').toLowerCase();
  return p === '/api' || p.startsWith('/api/');
}

/**
 * Rutas de API que se permiten desde el host público. No distingue mayúsculas,
 * igual que el enrutado de Express.
 */
export function isPublicApiPath(pathname: string): boolean {
  const p = String(pathname || '').toLowerCase();
  return p === '/api/health' || p === '/api/public' || p.startsWith('/api/public/');
}

/** /admin, /admin/, /admin/lo-que-sea (no confunde /administracion). */
export function isAdminPath(pathname: string): boolean {
  const p = String(pathname || '').toLowerCase();
  return p === '/admin' || p.startsWith('/admin/');
}

export interface PublicUrlContext {
  hostname: string;
  origin: string;
  publicHost?: string | null;
}

/**
 * URL absoluta hacia el portal PÚBLICO. Los enlaces que el panel entrega a los
 * clientes (registro, masivo, consulta) deben apuntar siempre aquí, no al host admin.
 * En desarrollo local se usa el origen actual para poder probar sin DNS.
 */
export function buildPublicUrl(pathname: string, ctx: PublicUrlContext): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const publicHost = normalizeHostname(ctx.publicHost);
  if (!publicHost || isLocalDevHost(ctx.hostname)) {
    return `${ctx.origin}${path}`;
  }
  // El portal público en producción siempre va por HTTPS (Traefik emite el certificado).
  return `https://${publicHost}${path}`;
}
