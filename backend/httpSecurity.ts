/**
 * Cabeceras de seguridad, separación por host y caché de archivos estáticos.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  isAdminPath,
  isApiPath,
  isPublicApiPath,
  resolveAppMode,
  type AppMode,
  type HostModeConfig,
} from '../src/utils/appMode';

/**
 * Content-Security-Policy para el build de producción.
 *
 * Lo que necesita la app (y por eso está permitido):
 * - Firebase Auth con popup de Google: carga https://apis.google.com/js/api.js y un
 *   iframe oculto en https://<proyecto>.firebaseapp.com; habla con
 *   identitytoolkit / securetoken.googleapis.com.
 * - Firestore y Storage: firestore.googleapis.com y firebasestorage.googleapis.com.
 * - Google Fonts: fonts.googleapis.com (CSS) y fonts.gstatic.com (fuentes).
 * - Imágenes: propias, data:/blob: (previsualizaciones) y https: (fotos de perfil de
 *   Google y mockups en Firebase Storage).
 * - style-src 'unsafe-inline': React (motion, recharts) usa atributos style="…".
 *   No se permite 'unsafe-inline' en scripts.
 */
export function buildContentSecurityPolicy(authDomain: string): string {
  const firebaseAuthOrigin = authDomain ? `https://${authDomain}` : 'https://*.firebaseapp.com';
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': ["'self'", 'https://apis.google.com', 'https://www.gstatic.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': [
      "'self'",
      'https://*.googleapis.com',
      'https://apis.google.com',
      'https://*.firebaseio.com',
      'wss://*.firebaseio.com',
      firebaseAuthOrigin,
    ],
    'frame-src': [
      firebaseAuthOrigin,
      'https://apis.google.com',
      'https://accounts.google.com',
      'https://docs.google.com',
    ],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export interface SecurityHeadersOptions {
  /** Si es false no se manda CSP (modo desarrollo: Vite inyecta scripts inline). */
  csp: boolean;
  /** Content-Security-Policy-Report-Only en vez de bloquear (para depurar). */
  cspReportOnly?: boolean;
  authDomain: string;
}

export function securityHeaders(options: SecurityHeadersOptions): RequestHandler {
  const cspValue = buildContentSecurityPolicy(options.authDomain);
  const cspHeader = options.cspReportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // same-origin-allow-popups: imprescindible para signInWithPopup de Firebase.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
    );
    if (req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    if (options.csp) {
      res.setHeader(cspHeader, cspValue);
    }
    next();
  };
}

/** Cabeceras extra para /uploads: un SVG subido nunca puede ejecutar scripts. */
export function setUploadHeaders(res: Response): void {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
  );
  res.setHeader('Cache-Control', 'public, max-age=86400');
}

export const PUBLIC_HOST_ADMIN_404_HTML =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Página no encontrada</title></head>' +
  '<body style="background:#080808;color:#fff;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">' +
  '<main style="text-align:center;padding:24px"><h1 style="font-size:20px">Página no encontrada</h1><p><a href="/" style="color:#ED1010">Volver al inicio</a></p></main></body></html>';

/**
 * Decide el modo por host (Host / X-Forwarded-Host de Traefik) y, en el host
 * público, corta el panel (/admin*) y toda API que no sea /api/public/* o /api/health.
 */
export function hostModeGuard(hostConfig: HostModeConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const mode: AppMode = resolveAppMode(req.hostname, hostConfig);
    res.locals.appMode = mode;

    if (mode !== 'public') return next();

    // Express enruta sin distinguir mayúsculas (/API/sheets == /api/sheets), así que
    // toda decisión de ruta de esta guardia se toma sobre la ruta en minúsculas.
    const pathname = req.path.toLowerCase();
    if (isApiPath(pathname)) {
      if (!isPublicApiPath(pathname)) {
        return res.status(404).json({ error: 'Recurso no encontrado.' });
      }
      return next();
    }
    if (isAdminPath(pathname)) {
      res.status(404);
      res.setHeader('Cache-Control', 'no-store');
      return res.type('html').send(PUBLIC_HOST_ADMIN_404_HTML);
    }
    return next();
  };
}

/** Archivos de Vite con hash en el nombre: /assets/index-AbC123xy.js */
const HASHED_ASSET_RE = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;

export function isHashedAssetPath(urlPath: string): boolean {
  return HASHED_ASSET_RE.test(urlPath);
}

export const INDEX_HTML_CACHE_CONTROL = 'no-cache, no-store, must-revalidate';
