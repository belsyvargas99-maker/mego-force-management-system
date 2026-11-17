/**
 * Autenticación de administradores para las rutas sensibles del servidor.
 *
 * 1. Verifica el Firebase ID token (JWT RS256) sin firebase-admin: firma con los
 *    certificados públicos de securetoken y crypto nativo de Node, y comprueba
 *    iss / aud / exp / iat / sub / email_verified.
 * 2. Decide si el usuario es admin:
 *    - su correo está en ADMIN_EMAILS (por defecto belsyvargas99@gmail.com), o
 *    - existe authorizedAdmins/{email} con active == true en Firestore, leído por
 *      la API REST con el token del propio usuario (las reglas de Firestore
 *      permiten que cada usuario lea su propio documento). Resultado en caché corta.
 *
 * No hay ningún secreto aquí: todo lo que usa es público (projectId, databaseId,
 * certificados de Google) o viene del propio usuario (su ID token).
 */
import crypto from 'node:crypto';

export const SECURETOKEN_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export const DEFAULT_FIREBASE_PROJECT_ID = 'gen-lang-client-0551519025';
export const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-3597d09b-0266-4bf3-9b3e-a6dc952c1277';
export const DEFAULT_ADMIN_EMAILS = ['belsyvargas99@gmail.com'];

/** Tiempo máximo de espera de cada llamada a Google (certificados, Firestore). */
export const OUTBOUND_FETCH_TIMEOUT_MS = 5000;

/**
 * Un `kid` desconocido fuerza descargar los certificados de nuevo (Google rota las
 * claves). Para que un atacante no pueda provocar una descarga por petición, la
 * recarga forzada se hace como mucho una vez cada 60 s.
 */
export const FORCED_CERT_REFRESH_MIN_INTERVAL_MS = 60_000;

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
}

export type IdTokenVerifier = (idToken: string) => Promise<VerifiedFirebaseUser>;
export type AdminResolver = (user: VerifiedFirebaseUser, idToken: string) => Promise<boolean>;

export class AdminAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 503,
    message: string
  ) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

export function parseAdminEmails(value: string | null | undefined): string[] {
  const list = String(value || '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length > 0 ? list : [...DEFAULT_ADMIN_EMAILS];
}

function base64UrlDecode(segment: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(segment)) {
    throw new AdminAuthError(401, 'Token mal formado.');
  }
  return Buffer.from(segment, 'base64url');
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(base64UrlDecode(segment).toString('utf8'));
    if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof AdminAuthError) throw err;
    throw new AdminAuthError(401, 'Token mal formado.');
  }
}

export interface CertSet {
  certs: Record<string, string>;
  /** Momento (ms epoch) en que deja de ser válido el caché. */
  expiresAt: number;
}

export type CertFetcher = () => Promise<CertSet>;

/** Descarga los certificados públicos de Firebase Auth respetando Cache-Control. */
export async function fetchSecureTokenCerts(): Promise<CertSet> {
  let res: Response;
  try {
    res = await fetch(SECURETOKEN_CERTS_URL, {
      signal: AbortSignal.timeout(OUTBOUND_FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new AdminAuthError(503, 'No se pudieron obtener los certificados de Firebase.');
  }
  if (!res.ok) {
    throw new AdminAuthError(503, 'No se pudieron obtener los certificados de Firebase.');
  }
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  return { certs, expiresAt: Date.now() + Math.max(60, maxAgeSec) * 1000 };
}

export interface TokenVerifierOptions {
  projectId: string;
  fetchCerts?: CertFetcher;
  now?: () => number;
  /** Tolerancia de reloj en segundos para iat / exp / auth_time. */
  clockSkewSec?: number;
  /** Mínimo entre dos recargas forzadas de certificados (por defecto 60 s). */
  forcedRefreshMinIntervalMs?: number;
}

export function createFirebaseIdTokenVerifier(options: TokenVerifierOptions): IdTokenVerifier {
  const projectId = options.projectId;
  const fetchCerts = options.fetchCerts || fetchSecureTokenCerts;
  const now = options.now || Date.now;
  const skewMs = (options.clockSkewSec ?? 60) * 1000;
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  const forcedRefreshMinIntervalMs =
    options.forcedRefreshMinIntervalMs ?? FORCED_CERT_REFRESH_MIN_INTERVAL_MS;

  let cache: CertSet | null = null;
  let inflight: Promise<CertSet> | null = null;
  let lastForcedRefreshAt = Number.NEGATIVE_INFINITY;

  async function getCerts(forceRefresh = false): Promise<Record<string, string>> {
    if (forceRefresh && cache) {
      // Recarga forzada limitada: si hubo otra hace menos de 60 s, usa el caché.
      if (now() - lastForcedRefreshAt < forcedRefreshMinIntervalMs) {
        return inflight ? (await inflight).certs : cache.certs;
      }
      lastForcedRefreshAt = now();
    } else if (cache && cache.expiresAt > now()) {
      return cache.certs;
    }
    if (!inflight) {
      inflight = fetchCerts()
        .then((set) => {
          cache = set;
          return set;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return (await inflight).certs;
  }

  return async function verifyIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
    const token = String(idToken || '').trim();
    const parts = token.split('.');
    if (parts.length !== 3 || token.length > 8192) {
      throw new AdminAuthError(401, 'Token mal formado.');
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = decodeJsonSegment(headerB64);
    const payload = decodeJsonSegment(payloadB64);

    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      throw new AdminAuthError(401, 'Algoritmo o clave del token no válidos.');
    }

    let certs = await getCerts();
    let pem = certs[header.kid];
    if (!pem) {
      // Google rota las claves: reintenta una vez con certificados frescos
      // (como mucho una recarga forzada cada 60 s).
      certs = await getCerts(true);
      pem = certs[header.kid];
    }
    if (!pem) {
      throw new AdminAuthError(401, 'El token fue firmado con una clave desconocida.');
    }

    let signatureOk = false;
    try {
      const publicKey = crypto.createPublicKey(pem);
      signatureOk = crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${headerB64}.${payloadB64}`, 'utf8'),
        publicKey,
        base64UrlDecode(signatureB64)
      );
    } catch {
      signatureOk = false;
    }
    if (!signatureOk) {
      throw new AdminAuthError(401, 'Firma del token inválida.');
    }

    const nowMs = now();
    const exp = payload.exp;
    const iat = payload.iat;
    const authTime = payload.auth_time;
    if (typeof exp !== 'number' || exp * 1000 <= nowMs - skewMs) {
      throw new AdminAuthError(401, 'La sesión expiró. Vuelve a iniciar sesión.');
    }
    if (typeof iat !== 'number' || iat * 1000 > nowMs + skewMs) {
      throw new AdminAuthError(401, 'Token emitido en el futuro.');
    }
    if (authTime !== undefined && (typeof authTime !== 'number' || authTime * 1000 > nowMs + skewMs)) {
      throw new AdminAuthError(401, 'auth_time inválido.');
    }
    if (payload.aud !== projectId) {
      throw new AdminAuthError(401, 'El token no pertenece a este proyecto (aud).');
    }
    if (payload.iss !== expectedIssuer) {
      throw new AdminAuthError(401, 'Emisor del token inválido (iss).');
    }
    const sub = payload.sub;
    const email = payload.email;
    if (typeof sub !== 'string' || !sub || sub.length > 128) {
      throw new AdminAuthError(401, 'Usuario del token inválido (sub).');
    }
    if (payload.email_verified !== true || typeof email !== 'string' || !email) {
      throw new AdminAuthError(403, 'El correo de la cuenta no está verificado.');
    }

    return { uid: sub, email };
  };
}

export interface AdminResolverOptions {
  adminEmails: string[];
  projectId: string;
  databaseId: string;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createAdminResolver(options: AdminResolverOptions): AdminResolver {
  const allow = new Set(options.adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const ttl = options.cacheTtlMs ?? 60_000;
  const doFetch = options.fetchImpl || fetch;
  const now = options.now || Date.now;
  const cache = new Map<string, { isAdmin: boolean; expiresAt: number }>();

  return async function isAdminUser(user, idToken) {
    const email = user.email;
    if (allow.has(email.trim().toLowerCase())) return true;

    const hit = cache.get(email);
    if (hit && hit.expiresAt > now()) return hit.isAdmin;

    // Mismo id de documento que usan las reglas: request.auth.token.email tal cual.
    const url =
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(options.projectId)}` +
      `/databases/${encodeURIComponent(options.databaseId)}` +
      `/documents/authorizedAdmins/${encodeURIComponent(email)}`;

    let res: Response;
    try {
      res = await doFetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(OUTBOUND_FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new AdminAuthError(503, 'No se pudo verificar los permisos de administrador.');
    }

    let isAdmin = false;
    if (res.ok) {
      const docJson = (await res.json().catch(() => null)) as {
        fields?: { active?: { booleanValue?: boolean } };
      } | null;
      isAdmin = docJson?.fields?.active?.booleanValue === true;
    } else if (res.status === 404 || res.status === 403 || res.status === 401) {
      // 404: no existe el documento. 403/401: las reglas no le dejan leerlo -> no es admin.
      isAdmin = false;
    } else {
      throw new AdminAuthError(503, 'Firestore no respondió al verificar permisos.');
    }

    if (cache.size > 500) cache.clear();
    cache.set(email, { isAdmin, expiresAt: now() + ttl });
    return isAdmin;
  };
}
