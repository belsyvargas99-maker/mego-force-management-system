import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type http from 'http';
import {
  AdminAuthError,
  createAdminResolver,
  createFirebaseIdTokenVerifier,
  DEFAULT_FIREBASE_PROJECT_ID,
  DEFAULT_FIRESTORE_DATABASE_ID,
  OUTBOUND_FETCH_TIMEOUT_MS,
  parseAdminEmails,
  type AdminResolver,
  type IdTokenVerifier,
} from './backend/adminAuth';
import {
  hostModeGuard,
  INDEX_HTML_CACHE_CONTROL,
  isHashedAssetPath,
  securityHeaders,
  setUploadHeaders,
} from './backend/httpSecurity';
import type { HostModeConfig } from './src/utils/appMode';
import {
  normalizeIdentificationDisplay,
  normalizeIdentificationKey,
  normalizeInstagram,
  normalizeNickname,
  normalizePhone,
} from './src/utils/normalizers';
import {
  calculateProductionSummary,
  groupRegistrationsBySize,
  sortRegistrationsChronologically,
} from './src/utils/sizeEngine';
import {
  evaluateContractWindow,
  evaluatePublicLinkAvailability,
  type ScheduleInput,
} from './src/utils/contractSchedule';
import { validateBulkRows } from './src/utils/bulkValidation';
import type { ContractStatus, Registration } from './src/types/mego';

const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_ROOT = path.resolve(process.cwd(), 'public', 'uploads');
const UPLOAD_DIR = path.join(UPLOADS_ROOT, 'mockups');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Límite de cuerpo JSON: un .xlsx/.docx de 10 MB pesa ~13,4 MB en base64. */
const JSON_BODY_LIMIT = '15mb';

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
}

function readFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return null;
  }
}

export interface ServerPublicContractState extends ScheduleInput {
  contractId: string;
  publicToken: string;
  bulkRegistrationEnabled: boolean;
  individualRegistrationEnabled?: boolean;
  individualLinkExpiresAt?: string;
  bulkLinkExpiresAt?: string;
  bulkToken?: string;
  availableSizes: string[];
}

function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map(decodeFirestoreValue);
  }
  return undefined;
}

export async function fetchPublicContractFromFirestoreRest(
  publicToken: string
): Promise<ServerPublicContractState | null> {
  const cfg = readFirebaseConfig();
  if (!cfg?.projectId || !cfg?.apiKey) return null;
  const dbId = cfg.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/${encodeURIComponent(dbId)}/documents/publicContracts/${encodeURIComponent(
    publicToken
  )}?key=${encodeURIComponent(cfg.apiKey)}`;

  try {
    // Llamada servidor -> Firestore REST con ?key= y SIN cabecera Referer: por eso la
    // apiKey no puede tener restricción de "referentes HTTP" (ver DEPLOY.md, paso 6.3).
    const res = await fetch(url, { signal: AbortSignal.timeout(OUTBOUND_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const doc = await res.json();
    const fields = doc?.fields;
    if (!fields) return null;

    return {
      contractId: String(decodeFirestoreValue(fields.contractId) || ''),
      publicToken: String(decodeFirestoreValue(fields.publicToken) || publicToken),
      status: (decodeFirestoreValue(fields.status) as ContractStatus) || 'draft',
      openDate: String(decodeFirestoreValue(fields.openDate) || ''),
      openTime: String(decodeFirestoreValue(fields.openTime) || ''),
      closeDate: String(decodeFirestoreValue(fields.closeDate) || ''),
      closeTime: String(decodeFirestoreValue(fields.closeTime) || ''),
      timezone: String(decodeFirestoreValue(fields.timezone) || 'America/Caracas'),
      closedMessage: String(decodeFirestoreValue(fields.closedMessage) || ''),
      bulkRegistrationEnabled: Boolean(decodeFirestoreValue(fields.bulkRegistrationEnabled)),
      individualRegistrationEnabled:
        fields.individualRegistrationEnabled !== undefined
          ? Boolean(decodeFirestoreValue(fields.individualRegistrationEnabled))
          : true,
      individualLinkExpiresAt: String(decodeFirestoreValue(fields.individualLinkExpiresAt) || ''),
      bulkLinkExpiresAt: String(decodeFirestoreValue(fields.bulkLinkExpiresAt) || ''),
      bulkToken: String(decodeFirestoreValue(fields.bulkToken) || ''),
      availableSizes: Array.isArray(decodeFirestoreValue(fields.availableSizes))
        ? (decodeFirestoreValue(fields.availableSizes) as string[])
        : [],
    };
  } catch {
    return null;
  }
}

const registrationValidationSchema = z.object({
  contractId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  publicToken: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
  fullName: z.string().trim().min(2, 'Nombre y apellido es obligatorio').max(160),
  identificationNumber: z.string().trim().min(3, 'Cédula obligatoria').max(40),
  size: z.string().trim().min(1, 'Talla obligatoria').max(24),
  nickname: z.string().max(60).optional().default(''),
  phone: z.string().trim().min(5, 'Teléfono obligatorio').max(40),
  instagram: z.string().max(80).optional().default(''),
  paymentSelection: z.enum(['PAGO COMPLETO', 'PAGO PARCIAL']),
  privacyAccepted: z.literal(true, {
    message: 'Debes aceptar la política de privacidad',
  }),
  website: z.string().max(0).optional().default(''),
  garmentItems: z
    .array(
      z.object({
        garment: z.string().min(1).max(120),
        size: z.string().min(1).max(24),
        nickname: z.string().max(60).optional().default(''),
      })
    )
    .max(20)
    .optional(),
  customFields: z.record(z.string(), z.any()).optional().default({}),
});

const bulkBatchValidationSchema = z.object({
  contractId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_\-]+$/),
  publicToken: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
  bulkToken: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_\-]+$/),
  representativeName: z.string().trim().min(2, 'Nombre del representante obligatorio').max(160),
  representativeContact: z.string().max(120).optional().default(''),
  privacyAccepted: z.literal(true).optional().default(true),
  website: z.string().max(0).optional().default(''),
  rows: z
    .array(
      z.object({
        rowId: z.string().min(1).max(80),
        fullName: z.string().max(160),
        identificationNumber: z.string().max(40),
        size: z.string().max(24),
        nickname: z.string().max(60).optional().default(''),
        phone: z.string().max(40),
        instagram: z.string().max(80).optional().default(''),
        paymentSelection: z.enum(['PAGO COMPLETO', 'PAGO PARCIAL']),
        garmentItems: z
          .array(
            z.object({
              garment: z.string().min(1).max(120),
              size: z.string().min(1).max(24),
              nickname: z.string().max(60).optional().default(''),
            })
          )
          .max(20)
          .optional(),
      })
    )
    .min(1, 'Debes incluir al menos una fila')
    .max(2000, 'Máximo 2000 participantes por envío masivo'),
});

export interface CreateAppOptions {
  resolvePublicContract?: (publicToken: string) => Promise<ServerPublicContractState | null>;
  /** Verificador del Firebase ID token (inyectable en tests). */
  verifyIdToken?: IdTokenVerifier;
  /** Decide si un usuario verificado es admin (inyectable en tests). */
  isAdminUser?: AdminResolver;
  /** Hosts público/admin. Por defecto: PUBLIC_HOST, ADMIN_HOST y APP_MODE del entorno. */
  hostConfig?: HostModeConfig;
  /** Carpeta del build de Vite. Si se indica, se sirve con caché y SPA fallback. */
  spaDistPath?: string;
  /** Enviar Content-Security-Policy (solo con el build de producción). */
  csp?: boolean;
  cspReportOnly?: boolean;
  /**
   * Rate limit de las rutas de admin (peticiones por minuto y por IP).
   * Por defecto ADMIN_RATE_LIMIT_MAX del entorno o 120. false lo desactiva.
   */
  adminRateLimitMax?: number | false;
}

/** Cabecera con el Firebase ID token del admin en las rutas /api/sheets/*. */
export const FIREBASE_TOKEN_HEADER = 'x-firebase-token';

const DEFAULT_ADMIN_RATE_LIMIT_MAX = 120;

function adminRateLimitFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.ADMIN_RATE_LIMIT_MAX);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_ADMIN_RATE_LIMIT_MAX;
}

/**
 * true cuando se ejecuta el bundle compilado (dist-server/server.js), p. ej. con
 * `npm start`. Ese bundle siempre corre en modo producción: nunca intenta levantar Vite.
 */
export const IS_BUNDLED_SERVER =
  path.basename(path.dirname(fileURLToPath(import.meta.url))) === 'dist-server';

// Track recently evaluated contract schedule transitions inside server process
let lastSchedulerCheckAt = new Date().toISOString();

function envFlag(value: string | undefined): boolean {
  return /^(1|true|yes|si|sí)$/i.test(String(value || '').trim());
}

export function hostConfigFromEnv(env: NodeJS.ProcessEnv = process.env): HostModeConfig {
  return {
    publicHost: env.PUBLIC_HOST || env.VITE_PUBLIC_HOST || null,
    adminHost: env.ADMIN_HOST || env.VITE_ADMIN_HOST || null,
    fallbackMode: env.APP_MODE || null,
  };
}

function buildDefaultAdminAuth(): { verifyIdToken: IdTokenVerifier; isAdminUser: AdminResolver } {
  const cfg = readFirebaseConfig();
  const projectId =
    process.env.FIREBASE_PROJECT_ID || cfg?.projectId || DEFAULT_FIREBASE_PROJECT_ID;
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID || cfg?.firestoreDatabaseId || DEFAULT_FIRESTORE_DATABASE_ID;
  return {
    verifyIdToken: createFirebaseIdTokenVerifier({ projectId }),
    isAdminUser: createAdminResolver({
      adminEmails: parseAdminEmails(process.env.ADMIN_EMAILS),
      projectId,
      databaseId,
      cacheTtlMs: 60_000,
    }),
  };
}

export function createApp(options: CreateAppOptions = {}) {
  const resolvePublicContract =
    options.resolvePublicContract || fetchPublicContractFromFirestoreRest;

  const defaultAuth =
    options.verifyIdToken && options.isAdminUser ? null : buildDefaultAdminAuth();
  const verifyIdToken = options.verifyIdToken || defaultAuth!.verifyIdToken;
  const isAdminUser = options.isAdminUser || defaultAuth!.isAdminUser;
  const hostConfig = options.hostConfig || hostConfigFromEnv();
  const firebaseCfg = readFirebaseConfig();

  const app = express();
  app.disable('x-powered-by');
  // Detrás de Traefik (un salto): req.ip, req.hostname y req.secure salen de X-Forwarded-*.
  app.set('trust proxy', 1);

  app.use(
    securityHeaders({
      csp: Boolean(options.csp),
      cspReportOnly: options.cspReportOnly,
      authDomain: firebaseCfg?.authDomain || '',
    })
  );
  // Host público: 404 para /admin* y para toda API que no sea /api/public/* o /api/health.
  app.use(hostModeGuard(hostConfig));

  const jsonBody = express.json({ limit: JSON_BODY_LIMIT });

  /**
   * Exige un Firebase ID token válido de un administrador. `readIdToken` dice de qué
   * cabecera sale: Authorization: Bearer (rutas normales) o X-Firebase-Token (rutas
   * /api/sheets/*, donde Authorization lleva el token OAuth de Google).
   */
  const makeRequireAdmin = (
    readIdToken: (req: express.Request) => string | null
  ): express.RequestHandler => async (req, res, next) => {
    const idToken = readIdToken(req);
    if (!idToken) {
      return res.status(401).json({ error: 'Inicia sesión como administrador para continuar.' });
    }
    try {
      const user = await verifyIdToken(idToken);
      const ok = await isAdminUser(user, idToken);
      if (!ok) {
        return res.status(403).json({ error: 'Tu cuenta no tiene permisos de administrador.' });
      }
      res.locals.adminUser = user;
      return next();
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return res.status(err.status).json({ error: err.message });
      }
      return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    }
  };

  /** Firebase ID token del admin en Authorization: Bearer. */
  const requireAdmin = makeRequireAdmin((req) => {
    const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() || null : null;
  });

  /** Firebase ID token del admin en X-Firebase-Token (rutas de Google Sheets). */
  const requireAdminFirebaseHeader = makeRequireAdmin((req) => {
    const raw = req.headers[FIREBASE_TOKEN_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const token = String(value || '').trim().replace(/^Bearer\s+/i, '');
    return token || null;
  });

  // Rate limit moderado para las rutas de admin (por IP; detrás de Traefik req.ip
  // sale de X-Forwarded-For). Va antes de verificar el token.
  const adminRateLimitMax =
    options.adminRateLimitMax === undefined ? adminRateLimitFromEnv() : options.adminRateLimitMax;
  const adminLimiter: express.RequestHandler =
    adminRateLimitMax === false
      ? (_req, _res, next) => next()
      : rateLimit({
          windowMs: 60 * 1000,
          limit: adminRateLimitMax,
          standardHeaders: true,
          legacyHeaders: false,
          message: {
            error: 'Demasiadas solicitudes al panel desde esta conexión. Intenta nuevamente en un minuto.',
          },
        });

  // Serve uploaded mockups statically (un SVG subido nunca ejecuta scripts)
  app.use(
    '/uploads',
    express.static(UPLOADS_ROOT, {
      fallthrough: false,
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => setUploadHeaders(res),
    })
  );

  // Rate limit public submission validation to protect against automated abuse
  const publicSubmitLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Demasiadas solicitudes desde este dispositivo. Intenta nuevamente en un minuto.',
    },
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'mego-force-api',
      timestamp: new Date().toISOString(),
      lastSchedulerCheckAt,
    });
  });

  // Authoritative server-side schedule window & link mode check for public visitors
  app.get('/api/public/contract-window/:publicToken', async (req, res) => {
    const token = String(req.params.publicToken || '').trim();
    if (!/^[a-zA-Z0-9_\-]{8,64}$/.test(token)) {
      return res.status(400).json({ error: 'Token de contrato inválido.' });
    }
    const contract = await resolvePublicContract(token);
    if (!contract) {
      return res.status(404).json({ error: 'Contrato no encontrado.' });
    }
    const mode = req.query.mode === 'bulk' ? 'bulk' : 'individual';
    const providedBulkToken =
      typeof req.query.bulkToken === 'string' ? req.query.bulkToken.trim() : '';
    const linkEval = evaluatePublicLinkAvailability(contract, mode, Date.now());
    const tokenMismatch =
      mode === 'bulk' &&
      Boolean(contract.bulkToken) &&
      Boolean(providedBulkToken) &&
      contract.bulkToken !== providedBulkToken;

    const effectiveAllowed = tokenMismatch ? false : linkEval.allowed;
    const effectiveMessage = tokenMismatch
      ? 'Este enlace de registro masivo fue revocado o regenerado.'
      : linkEval.message;

    return res.json({
      contractId: contract.contractId,
      serverNowIso: new Date().toISOString(),
      allowed: effectiveAllowed,
      linkReasonCode: tokenMismatch ? 'TOKEN_REVOKED' : linkEval.reasonCode,
      linkMessage: effectiveMessage,
      window: linkEval.window,
      ...linkEval.window,
    });
  });

  // Backend schedule reconciler: evaluates current schedule state transitions across contracts
  app.post('/api/contracts/reconcile-schedules', adminLimiter, requireAdmin, jsonBody, (req, res) => {
    const items = Array.isArray(req.body?.contracts) ? req.body.contracts : [];
    const nowMs = Date.now();
    lastSchedulerCheckAt = new Date(nowMs).toISOString();

    const transitions: {
      contractId: string;
      previousStatus: ContractStatus;
      nextStatus: ContractStatus;
      reasonCode: string;
      closedAt?: string;
      closeReason?: string;
    }[] = [];

    for (const item of items) {
      if (!item?.contractId || !item?.status) continue;
      if (item.status !== 'scheduled' && item.status !== 'active') continue;
      const evalRes = evaluateContractWindow(item, nowMs);
      if (evalRes.effectiveStatus !== item.status) {
        transitions.push({
          contractId: item.contractId,
          previousStatus: item.status,
          nextStatus: evalRes.effectiveStatus,
          reasonCode: evalRes.reasonCode,
          ...(evalRes.effectiveStatus === 'auto_closed'
            ? {
                closedAt: new Date(nowMs).toISOString(),
                closeReason: evalRes.visitorMessage,
              }
            : {}),
        });
      }
    }

    return res.json({ checkedAt: lastSchedulerCheckAt, transitions });
  });

  // Server-side normalization, authoritative schedule check & identification hash calculation
  app.post('/api/public/validate-registration', publicSubmitLimiter, jsonBody, async (req, res) => {
    const parsed = registrationValidationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de registro inválidos',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;

    // Authoritative server-side schedule & individual link enforcement
    const remoteContract = await resolvePublicContract(data.publicToken);
    if (!remoteContract || remoteContract.contractId !== data.contractId) {
      return res.status(404).json({
        error: 'Este contrato no existe o no está disponible.',
      });
    }

    const linkEval = evaluatePublicLinkAvailability(remoteContract, 'individual', Date.now());
    if (!linkEval.allowed) {
      return res.status(403).json({
        error: linkEval.message,
        reasonCode:
          linkEval.reasonCode === 'WINDOW_CLOSED'
            ? linkEval.window.reasonCode
            : linkEval.reasonCode,
        effectiveStatus: linkEval.window.effectiveStatus,
      });
    }

    const idDisplay = normalizeIdentificationDisplay(data.identificationNumber);
    const idKey = normalizeIdentificationKey(data.identificationNumber);
    if (idKey.length < 3) {
      return res.status(400).json({ error: 'Número de cédula demasiado corto.' });
    }

    const phone = normalizePhone(data.phone);
    if (phone.replace(/\D/g, '').length < 6) {
      return res.status(400).json({ error: 'Número de teléfono inválido.' });
    }

    const instagram = normalizeInstagram(data.instagram || '');
    const nickname = normalizeNickname(data.nickname || '', 40);
    const identificationHash = crypto
      .createHash('sha256')
      .update(`${data.contractId}:${idKey}`)
      .digest('hex');

    return res.json({
      valid: true,
      normalized: {
        contractId: data.contractId,
        publicToken: data.publicToken,
        fullName: data.fullName.trim().replace(/\s+/g, ' '),
        identificationNumber: idDisplay,
        identificationHash,
        size: data.size.trim().toUpperCase(),
        nickname,
        phone,
        instagram,
        paymentSelection: data.paymentSelection,
        privacyAccepted: true,
        customFields: data.customFields || {},
      },
    });
  });

  // Server-side validation & normalization for Bulk Organization Registrations
  app.post('/api/public/validate-bulk-batch', publicSubmitLimiter, jsonBody, async (req, res) => {
    const parsed = bulkBatchValidationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de lote inválidos.',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const data = parsed.data;
    const remoteContract = await resolvePublicContract(data.publicToken);
    if (!remoteContract || remoteContract.contractId !== data.contractId) {
      return res.status(404).json({
        error: 'Contrato no encontrado o enlace expirado.',
      });
    }

    if (remoteContract.bulkToken && remoteContract.bulkToken !== data.bulkToken) {
      return res.status(403).json({
        error: 'Este enlace de registro masivo fue revocado o reemplazado por uno nuevo.',
        reasonCode: 'TOKEN_REVOKED',
      });
    }

    const linkEval = evaluatePublicLinkAvailability(remoteContract, 'bulk', Date.now());
    if (!linkEval.allowed) {
      return res.status(403).json({
        error: linkEval.message,
        reasonCode:
          linkEval.reasonCode === 'WINDOW_CLOSED'
            ? linkEval.window.reasonCode
            : linkEval.reasonCode,
        effectiveStatus: linkEval.window.effectiveStatus,
      });
    }

    const { validRows, errorRows } = validateBulkRows(
      data.rows,
      remoteContract.availableSizes,
      new Set()
    );

    const preparedValid = validRows.map((item) => {
      const identificationHash = crypto
        .createHash('sha256')
        .update(`${data.contractId}:${item.normalized.identificationKey}`)
        .digest('hex');
      return {
        rowId: item.rowId,
        rowIndex: item.rowIndex,
        ...item.normalized,
        identificationHash,
      };
    });

    const duplicatesInBatch = errorRows.filter((e) => e.isDuplicateInBatch).length;

    return res.json({
      valid: true,
      serverNowIso: new Date().toISOString(),
      duplicatesInBatch,
      validRows: preparedValid,
      errorRows: errorRows.map((err) => ({
        rowId: err.rowId,
        rowIndex: err.rowIndex,
        isDuplicateInBatch: err.isDuplicateInBatch,
        errors: err.errors,
      })),
    });
  });

  // Upload mockup image safely (validates MIME and max 5MB)
  app.post('/api/uploads/mockup', adminLimiter, requireAdmin, jsonBody, (req, res) => {
    try {
      const { fileName, dataUrl } = req.body as { fileName?: string; dataUrl?: string };
      if (!fileName || !dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'Archivo o imagen inválida.' });
      }
      const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: 'Solo se admiten imágenes PNG, JPG, WEBP o SVG.' });
      }
      const mime = match[1];
      const base64Body = match[3];
      const buffer = Buffer.from(base64Body, 'base64');
      if (buffer.byteLength > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'La imagen excede el límite de 5MB.' });
      }

      const extMap: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
      };
      const ext = extMap[mime] || '.png';
      const safeName = `mockup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
      const targetPath = path.join(UPLOAD_DIR, safeName);
      fs.writeFileSync(targetPath, buffer);

      return res.json({
        url: `/uploads/mockups/${safeName}`,
        storagePath: `uploads/mockups/${safeName}`,
        fileType: mime,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error al guardar la imagen.' });
    }
  });

  // Parse XLSX, CSV, or DOCX files into tabular preview rows for admin & bulk import
  app.post('/api/import/parse', adminLimiter, requireAdmin, jsonBody, async (req, res) => {
    try {
      const { fileName, base64 } = req.body as { fileName?: string; base64?: string };
      if (!fileName || !base64) {
        return res.status(400).json({ error: 'Archivo requerido para analizar.' });
      }
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.byteLength > 10 * 1024 * 1024) {
        return res.status(413).json({ error: 'El archivo supera el límite de 10MB.' });
      }

      const lower = fileName.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) {
        const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
          return res.status(400).json({ error: 'El archivo no contiene hojas válidas.' });
        }
        const sheet = workbook.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: '',
          raw: false,
        });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        return res.json({ format: lower.endsWith('.csv') ? 'csv' : 'xlsx', headers, rows });
      }

      if (lower.endsWith('.docx')) {
        const result = await mammoth.convertToHtml({ buffer });
        const html = result.value || '';
        const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)];
        if (tableMatches.length === 0) {
          return res.status(400).json({
            error: 'No se detectaron tablas estructuradas en el documento Word (.docx).',
          });
        }
        const firstTableHtml = tableMatches[0][0];
        const rowMatches = [...firstTableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
        const matrix = rowMatches.map((m) => {
          const cells = [...m[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)];
          return cells.map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
        });
        if (matrix.length < 2) {
          return res.status(400).json({ error: 'La tabla extraída no contiene filas de datos.' });
        }
        const headers = matrix[0].map((h, i) => h || `Columna_${i + 1}`);
        const rows = matrix.slice(1).map((vals) => {
          const obj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            obj[h] = vals[idx] || '';
          });
          return obj;
        });
        return res.json({ format: 'docx', headers, rows });
      }

      return res.status(400).json({
        error: 'Formato no soportado. Sube archivos .xlsx, .csv o .docx.',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Error al procesar el archivo.' });
    }
  });

  // Google Sheets: Create independent spreadsheet for a contract.
  // X-Firebase-Token: ID token del admin. Authorization: token OAuth de Google que se reenvía.
  app.post('/api/sheets/create-spreadsheet', adminLimiter, requireAdminFirebaseHeader, jsonBody, async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Autorización de Google Sheets requerida. Inicia sesión con Google y concede permisos.',
      });
    }

    try {
      const { contractTitle, contractCode, availableSizes } = req.body as {
        contractTitle: string;
        contractCode: string;
        availableSizes: string[];
      };

      const sizes = Array.isArray(availableSizes) && availableSizes.length > 0
        ? availableSizes
        : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

      const tabNames = ['TODOS LOS REGISTROS', ...sizes, 'RESUMEN'];
      const sheets = tabNames.map((title) => ({
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      }));

      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: `MEGO FORCE · ${contractCode} · ${contractTitle}`,
          },
          sheets,
        }),
      });

      const payload = await createRes.json();
      if (!createRes.ok) {
        return res.status(createRes.status).json({
          error: payload?.error?.message || 'Google Sheets rechazó la creación de la hoja.',
        });
      }

      return res.json({
        spreadsheetId: payload.spreadsheetId,
        spreadsheetUrl: payload.spreadsheetUrl,
        tabs: tabNames,
      });
    } catch (err: any) {
      return res.status(502).json({
        error: err?.message || 'Error de conexión con Google Sheets API.',
      });
    }
  });

  // Google Sheets: Synchronize chronological, per-size, and summary tabs.
  // X-Firebase-Token: ID token del admin. Authorization: token OAuth de Google que se reenvía.
  app.post('/api/sheets/sync-contract', adminLimiter, requireAdminFirebaseHeader, jsonBody, async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token de Google Sheets ausente o expirado. Reconecta tu cuenta Google.',
      });
    }

    try {
      const { spreadsheetId, contractTitle, contractCode, availableSizes, registrations } = req.body as {
        spreadsheetId: string;
        contractTitle: string;
        contractCode: string;
        availableSizes: string[];
        registrations: Registration[];
      };

      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Falta spreadsheetId para sincronizar.' });
      }

      const sizes = Array.isArray(availableSizes) && availableSizes.length > 0
        ? availableSizes
        : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`,
        { headers: { Authorization: authHeader } }
      );
      const metaJson = await metaRes.json();
      if (!metaRes.ok) {
        return res.status(metaRes.status).json({
          error: metaJson?.error?.message || 'No se pudo acceder a la hoja de cálculo.',
        });
      }

      const existingTabs = new Set<string>(
        (metaJson.sheets || []).map((s: any) => s?.properties?.title).filter(Boolean)
      );

      const requiredTabs = ['TODOS LOS REGISTROS', ...sizes, 'RESUMEN'];
      const missingTabs = requiredTabs.filter((t) => !existingTabs.has(t));

      if (missingTabs.length > 0) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: missingTabs.map((title) => ({
                addSheet: {
                  properties: { title, gridProperties: { frozenRowCount: 1 } },
                },
              })),
            }),
          }
        );
      }

      const headersRow = [
        'Número',
        'Nombre y apellido',
        'Cédula',
        'Talla',
        'Seudónimo',
        'Teléfono',
        'Instagram',
        'Modalidad de pago',
        'Estado de verificación',
        'Tipo de registro',
        'Fecha',
        'Hora',
        'Código de registro',
      ];

      const mapRegToRow = (reg: Registration, index: number) => {
        const dt = new Date(reg.registrationTimestamp || reg.createdAt || Date.now());
        const dateStr = isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
        const timeStr = isNaN(dt.getTime()) ? '' : dt.toISOString().slice(11, 19);
        const verifLabel =
          reg.paymentVerificationStatus === 'verified'
            ? 'VERIFICADO'
            : reg.paymentVerificationStatus === 'rejected'
              ? 'RECHAZADO'
              : 'PENDIENTE';
        const modeLabel =
          reg.registrationMode === 'bulk' || reg.source === 'bulk_representative'
            ? 'MASIVO'
            : 'INDIVIDUAL';
        return [
          index + 1,
          reg.fullName,
          `'${reg.identificationNumber}`,
          reg.size,
          reg.nickname || '-',
          `'${reg.phone}`,
          reg.instagram || '-',
          reg.paymentSelection,
          verifLabel,
          modeLabel,
          dateStr,
          timeStr,
          reg.registrationCode,
        ];
      };

      const activeRegs = sortRegistrationsChronologically(
        (registrations || []).filter((r) => r.registrationStatus !== 'cancelled')
      );
      const groups = groupRegistrationsBySize(activeRegs, sizes);
      const summary = calculateProductionSummary(activeRegs, sizes);

      const valueRanges: { range: string; values: (string | number)[][] }[] = [];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ranges: requiredTabs.map((t) => `'${t}'!A1:Z2000`),
          }),
        }
      );

      valueRanges.push({
        range: `'TODOS LOS REGISTROS'!A1`,
        values: [headersRow, ...activeRegs.map((r, i) => mapRegToRow(r, i))],
      });

      for (const grp of groups) {
        if (!requiredTabs.includes(grp.size)) continue;
        valueRanges.push({
          range: `'${grp.size}'!A1`,
          values: [headersRow, ...grp.registrations.map((r, i) => mapRegToRow(r, i))],
        });
      }

      valueRanges.push({
        range: `'RESUMEN'!A1`,
        values: [
          ['MEGO FORCE — RESUMEN DE PRODUCCIÓN', contractCode, contractTitle],
          ['Última sincronización', new Date().toISOString(), ''],
          ['Total Prendas / Participantes', summary.totalGarments, '100%'],
          ['Pagos Completos Declarados', summary.fullPaymentsDeclared, ''],
          ['Pagos Parciales Declarados', summary.partialPaymentsDeclared, ''],
          ['Pagos Verificados Admin', summary.verifiedPayments, ''],
          ['Pagos Pendientes Verificación', summary.pendingVerifications, ''],
          [],
          ['TALLA', 'CANTIDAD PARA FABRICACIÓN', 'PORCENTAJE'],
          ...summary.groups.map((g) => [g.size, g.count, `${g.percentage}%`]),
        ],
      });

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: valueRanges,
          }),
        }
      );

      const updateJson = await updateRes.json();
      if (!updateRes.ok) {
        return res.status(updateRes.status).json({
          error: updateJson?.error?.message || 'Error al escribir filas en Google Sheets.',
        });
      }

      return res.json({
        synced: true,
        totalRows: activeRegs.length,
        tabsUpdated: requiredTabs.length,
        syncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(502).json({
        error: err?.message || 'Fallo de comunicación con Google Sheets API.',
      });
    }
  });

  // Cualquier /api desconocida responde JSON 404 (nunca index.html)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  if (options.spaDistPath) {
    mountSpa(app, options.spaDistPath);
  }

  app.use(jsonErrorHandler);

  return app;
}

/** Sirve el build de Vite: assets con hash en caché 1 año, index.html sin caché. */
function mountSpa(app: express.Express, distPath: string) {
  const indexPath = path.join(distPath, 'index.html');
  app.use(
    express.static(distPath, {
      index: false,
      dotfiles: 'ignore',
      setHeaders: (res, filePath) => {
        const rel = '/' + path.relative(distPath, filePath).split(path.sep).join('/');
        if (path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', INDEX_HTML_CACHE_CONTROL);
        } else if (isHashedAssetPath(rel)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    })
  );
  // SPA fallback (en el host público /admin* ya respondió 404 antes de llegar aquí)
  app.get('*', (_req, res, next) => {
    res.setHeader('Cache-Control', INDEX_HTML_CACHE_CONTROL);
    res.sendFile(indexPath, (err) => {
      if (err) next(err);
    });
  });
}

const jsonErrorHandler: express.ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Los datos enviados superan el límite de 15 MB.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido.' });
  }
  const status = Number(err?.status || err?.statusCode) || 500;
  if (status === 404) {
    return res.status(404).type('text/plain').send('No encontrado');
  }
  if (status >= 500) {
    console.error('[server] error no controlado:', err);
  }
  return res
    .status(status)
    .json({ error: status >= 500 ? 'Error interno del servidor.' : String(err?.message || 'Solicitud inválida.') });
};

export async function startServer() {
  // `npm start` ejecuta dist-server/server.js: siempre producción, aunque falte
  // NODE_ENV (funciona igual en Windows, Linux y Docker, sin cross-env).
  if (IS_BUNDLED_SERVER && process.env.NODE_ENV !== 'production') {
    if (process.env.NODE_ENV) {
      console.warn(
        `[server] NODE_ENV=${process.env.NODE_ENV} ignorado: el build compilado siempre corre en producción.`
      );
    }
    process.env.NODE_ENV = 'production';
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const app = createApp({
    spaDistPath: isProduction ? path.resolve(process.cwd(), 'dist') : undefined,
    csp: isProduction && !envFlag(process.env.CSP_DISABLED),
    cspReportOnly: envFlag(process.env.CSP_REPORT_ONLY),
  });

  // Periodic background scheduler heartbeat
  const timer = setInterval(() => {
    lastSchedulerCheckAt = new Date().toISOString();
  }, 60_000);
  timer.unref?.();

  let vite: { close: () => Promise<void> } | null = null;
  if (!isProduction) {
    // Vite solo existe en desarrollo: en la imagen de producción no está instalado.
    const { createServer: createViteServer } = await import('vite');
    const devServer = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(devServer.middlewares);
    vite = devServer;
  }

  const server: http.Server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MEGO FORCE server listening on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} recibido: cerrando conexiones...`);
    clearInterval(timer);
    const forceExit = setTimeout(() => {
      console.error('[server] cierre forzado tras 10 s');
      process.exit(1);
    }, 10_000);
    forceExit.unref();
    server.close(async (err) => {
      try {
        await vite?.close();
      } catch {
        // sin importancia al salir
      }
      process.exit(err ? 1 : 0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('[server] no se pudo arrancar:', err);
    process.exit(1);
  });
}
