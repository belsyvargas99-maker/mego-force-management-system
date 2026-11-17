import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApp, type ServerPublicContractState } from './server';
import {
  AdminAuthError,
  createAdminResolver,
  createFirebaseIdTokenVerifier,
  type VerifiedFirebaseUser,
} from './backend/adminAuth';

/**
 * Separación por host (portal público vs. panel), autenticación de admin,
 * cabeceras de seguridad, caché del build y verificación real del ID token.
 */

const PUBLIC_HOST = 'mego-registro.systemagencygarciavargas.tech';
const ADMIN_HOST = 'mego-admin.systemagencygarciavargas.tech';
const ADMIN_TOKEN = 'test-admin-token';
const NON_ADMIN_TOKEN = 'test-user-token';
const ADMIN_AUTH = { Authorization: `Bearer ${ADMIN_TOKEN}` };

const CONTRACT: ServerPublicContractState = {
  contractId: 'ctr_test_1',
  publicToken: 'MF-2026-TOKEN123',
  status: 'active',
  openDate: '2020-01-01',
  openTime: '00:00',
  closeDate: '2099-12-31',
  closeTime: '23:59',
  timezone: 'America/Caracas',
  individualRegistrationEnabled: true,
  bulkRegistrationEnabled: false,
  availableSizes: ['S', 'M', 'L'],
};

let server: http.Server;
let baseUrl = '';
let distDir = '';

async function fakeVerifyIdToken(token: string): Promise<VerifiedFirebaseUser> {
  if (token === ADMIN_TOKEN) return { uid: 'uid_admin', email: 'admin@test.local' };
  if (token === NON_ADMIN_TOKEN) return { uid: 'uid_user', email: 'user@test.local' };
  throw new AdminAuthError(401, 'Token inválido.');
}

before(async () => {
  // Build falso de Vite para probar caché y SPA fallback
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mego-dist-'));
  fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><div id="root">MEGO_SPA</div>');
  fs.writeFileSync(path.join(distDir, 'assets', 'index-AbCd1234.js'), 'console.log(1);');

  const app = createApp({
    resolvePublicContract: async (token) => (token === CONTRACT.publicToken ? CONTRACT : null),
    verifyIdToken: fakeVerifyIdToken,
    isAdminUser: async (user) => user.email === 'admin@test.local',
    hostConfig: { publicHost: PUBLIC_HOST, adminHost: ADMIN_HOST },
    spaDistPath: distDir,
    csp: true,
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const addr = server.address();
  if (addr && typeof addr === 'object') {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (distDir) fs.rmSync(distDir, { recursive: true, force: true });
});

/** Traefik reenvía el Host original en X-Forwarded-Host (trust proxy = 1). */
function onHost(host: string, extra: Record<string, string> = {}): Record<string, string> {
  return { 'X-Forwarded-Host': host, ...extra };
}

const ADMIN_API_CALLS: { path: string; body: unknown }[] = [
  { path: '/api/uploads/mockup', body: { fileName: 'a.png', dataUrl: 'data:image/png;base64,AAAA' } },
  { path: '/api/import/parse', body: { fileName: 'a.csv', base64: 'YSxi' } },
  { path: '/api/contracts/reconcile-schedules', body: { contracts: [] } },
];

describe('Host público: panel y APIs internas bloqueadas', () => {
  for (const p of ['/admin', '/admin/', '/admin/login', '/admin/dashboard', '/ADMIN/contracts']) {
    it(`GET ${p} en el host público -> 404`, async () => {
      const res = await fetch(`${baseUrl}${p}`, { headers: onHost(PUBLIC_HOST), redirect: 'manual' });
      assert.equal(res.status, 404);
      assert.doesNotMatch(await res.text(), /MEGO_SPA/);
    });
  }

  it('GET /admin/dashboard en el host admin -> SPA (200)', async () => {
    const res = await fetch(`${baseUrl}/admin/dashboard`, { headers: onHost(ADMIN_HOST) });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /MEGO_SPA/);
  });

  it('GET /registro/:token en el host público -> SPA (200)', async () => {
    const res = await fetch(`${baseUrl}/registro/MF-2026-TOKEN123`, { headers: onHost(PUBLIC_HOST) });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /MEGO_SPA/);
  });

  for (const call of ADMIN_API_CALLS) {
    it(`POST ${call.path} desde el host público -> bloqueada (404) aunque traiga token de admin`, async () => {
      const res = await fetch(`${baseUrl}${call.path}`, {
        method: 'POST',
        headers: onHost(PUBLIC_HOST, { 'Content-Type': 'application/json', ...ADMIN_AUTH }),
        body: JSON.stringify(call.body),
      });
      assert.equal(res.status, 404);
    });
  }

  it('POST /api/sheets/* desde el host público -> bloqueada (404)', async () => {
    for (const p of ['/api/sheets/create-spreadsheet', '/api/sheets/sync-contract']) {
      const res = await fetch(`${baseUrl}${p}`, {
        method: 'POST',
        headers: onHost(PUBLIC_HOST, { 'Content-Type': 'application/json', Authorization: 'Bearer x' }),
        body: '{}',
      });
      assert.equal(res.status, 404, p);
    }
  });

  it('un host desconocido se trata como público', async () => {
    const res = await fetch(`${baseUrl}/api/import/parse`, {
      method: 'POST',
      headers: onHost('2.24.202.165', { 'Content-Type': 'application/json', ...ADMIN_AUTH }),
      body: '{}',
    });
    assert.equal(res.status, 404);
  });

  it('/api/health y /api/public/* siguen funcionando en el host público', async () => {
    const health = await fetch(`${baseUrl}/api/health`, { headers: onHost(PUBLIC_HOST) });
    assert.equal(health.status, 200);
    const win = await fetch(`${baseUrl}/api/public/contract-window/MF-2026-TOKEN123?mode=individual`, {
      headers: onHost(PUBLIC_HOST),
    });
    assert.equal(win.status, 200);
    assert.equal((await win.json()).allowed, true);
  });
});

describe('APIs de admin exigen Firebase ID token de un administrador', () => {
  for (const call of ADMIN_API_CALLS) {
    it(`POST ${call.path} sin token -> 401`, async () => {
      const res = await fetch(`${baseUrl}${call.path}`, {
        method: 'POST',
        headers: onHost(ADMIN_HOST, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(call.body),
      });
      assert.equal(res.status, 401);
    });

    it(`POST ${call.path} con token inválido -> 401`, async () => {
      const res = await fetch(`${baseUrl}${call.path}`, {
        method: 'POST',
        headers: onHost(ADMIN_HOST, { 'Content-Type': 'application/json', Authorization: 'Bearer basura' }),
        body: JSON.stringify(call.body),
      });
      assert.equal(res.status, 401);
    });

    it(`POST ${call.path} con usuario que no es admin -> 403`, async () => {
      const res = await fetch(`${baseUrl}${call.path}`, {
        method: 'POST',
        headers: onHost(ADMIN_HOST, {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NON_ADMIN_TOKEN}`,
        }),
        body: JSON.stringify(call.body),
      });
      assert.equal(res.status, 403);
    });
  }

  it('POST /api/import/parse con admin analiza un CSV', async () => {
    const csv = Buffer.from('Nombre,Talla\nAna,M\nLuis,L\n', 'utf8').toString('base64');
    const res = await fetch(`${baseUrl}/api/import/parse`, {
      method: 'POST',
      headers: onHost(ADMIN_HOST, { 'Content-Type': 'application/json', ...ADMIN_AUTH }),
      body: JSON.stringify({ fileName: 'lista.csv', base64: csv }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.headers, ['Nombre', 'Talla']);
    assert.equal(body.rows.length, 2);
  });
});

describe('Cabeceras de seguridad y caché', () => {
  it('manda cabeceras de seguridad y una CSP compatible con Firebase Auth', async () => {
    const res = await fetch(`${baseUrl}/`, { headers: onHost(PUBLIC_HOST) });
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
    assert.equal(res.headers.get('x-powered-by'), null);
    const csp = res.headers.get('content-security-policy') || '';
    assert.match(csp, /script-src 'self' https:\/\/apis\.google\.com/);
    assert.match(csp, /frame-src [^;]*firebaseapp\.com/);
    assert.match(csp, /connect-src [^;]*https:\/\/\*\.googleapis\.com/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  });

  it('HSTS solo cuando la petición llegó por HTTPS (X-Forwarded-Proto)', async () => {
    const plain = await fetch(`${baseUrl}/api/health`);
    assert.equal(plain.headers.get('strict-transport-security'), null);
    const secure = await fetch(`${baseUrl}/api/health`, { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.match(secure.headers.get('strict-transport-security') || '', /max-age=31536000/);
  });

  it('index.html sin caché y assets con hash con caché larga', async () => {
    const index = await fetch(`${baseUrl}/`, { headers: onHost(ADMIN_HOST) });
    assert.equal(index.status, 200);
    assert.match(index.headers.get('cache-control') || '', /no-store/);

    const asset = await fetch(`${baseUrl}/assets/index-AbCd1234.js`, { headers: onHost(PUBLIC_HOST) });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control') || '', /max-age=31536000.*immutable/);
  });

  it('una /api desconocida responde JSON 404, no index.html', async () => {
    const res = await fetch(`${baseUrl}/api/no-existe`, { headers: onHost(ADMIN_HOST) });
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
  });

  it('/uploads inexistente -> 404 (no cae al SPA)', async () => {
    const res = await fetch(`${baseUrl}/uploads/mockups/no-existe.png`, { headers: onHost(PUBLIC_HOST) });
    assert.equal(res.status, 404);
    assert.doesNotMatch(await res.text(), /MEGO_SPA/);
  });

  it('JSON mal formado -> 400 con mensaje JSON', async () => {
    const res = await fetch(`${baseUrl}/api/public/validate-registration`, {
      method: 'POST',
      headers: onHost(PUBLIC_HOST, { 'Content-Type': 'application/json' }),
      body: '{mal',
    });
    assert.equal(res.status, 400);
    assert.ok((await res.json()).error);
  });
});

describe('createFirebaseIdTokenVerifier (firma RS256 con crypto nativo)', () => {
  const PROJECT = 'gen-lang-client-0551519025';
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherPrivateKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const nowSec = Math.floor(Date.now() / 1000);

  function signToken(
    claims: Record<string, unknown>,
    opts: { kid?: string; alg?: string; key?: crypto.KeyObject } = {}
  ): string {
    const header = { alg: opts.alg || 'RS256', kid: opts.kid || 'kid-1', typ: 'JWT' };
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const signingInput = `${enc(header)}.${enc(claims)}`;
    const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), opts.key || privateKey);
    return `${signingInput}.${sig.toString('base64url')}`;
  }

  const goodClaims = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: 'uid_123',
    iat: nowSec - 10,
    exp: nowSec + 3600,
    auth_time: nowSec - 10,
    email: 'belsyvargas99@gmail.com',
    email_verified: true,
  };

  let certFetches = 0;
  const verify = createFirebaseIdTokenVerifier({
    projectId: PROJECT,
    fetchCerts: async () => {
      certFetches += 1;
      return { certs: { 'kid-1': publicPem }, expiresAt: Date.now() + 60_000 };
    },
  });

  it('acepta un token válido', async () => {
    const user = await verify(signToken(goodClaims));
    assert.equal(user.uid, 'uid_123');
    assert.equal(user.email, 'belsyvargas99@gmail.com');
  });

  it('reutiliza los certificados en caché', async () => {
    const fetchesBefore = certFetches;
    await verify(signToken(goodClaims));
    assert.equal(certFetches, fetchesBefore);
  });

  const forgedPayload = () => {
    const [h, , s] = signToken(goodClaims).split('.');
    const forged = Buffer.from(JSON.stringify({ ...goodClaims, email: 'x@evil.com' })).toString(
      'base64url'
    );
    return `${h}.${forged}.${s}`;
  };

  const rejectCases: [string, () => string, number][] = [
    ['aud de otro proyecto', () => signToken({ ...goodClaims, aud: 'otro-proyecto' }), 401],
    ['iss incorrecto', () => signToken({ ...goodClaims, iss: 'https://evil.example.com' }), 401],
    ['token expirado', () => signToken({ ...goodClaims, exp: nowSec - 3600 }), 401],
    ['iat en el futuro', () => signToken({ ...goodClaims, iat: nowSec + 3600 }), 401],
    ['sub vacío', () => signToken({ ...goodClaims, sub: '' }), 401],
    ['email no verificado', () => signToken({ ...goodClaims, email_verified: false }), 403],
    ['alg distinto de RS256', () => signToken(goodClaims, { alg: 'HS256' }), 401],
    ['kid desconocido', () => signToken(goodClaims, { kid: 'kid-x' }), 401],
    ['firmado con otra clave', () => signToken(goodClaims, { key: otherPrivateKey }), 401],
    ['payload alterado', forgedPayload, 401],
    ['no es un JWT', () => 'abc.def', 401],
  ];

  for (const [label, makeToken, status] of rejectCases) {
    it(`rechaza: ${label}`, async () => {
      await assert.rejects(verify(makeToken()), (err: unknown) => {
        assert.ok(err instanceof AdminAuthError);
        assert.equal(err.status, status);
        return true;
      });
    });
  }
});

describe('createAdminResolver', () => {
  const user = (email: string): VerifiedFirebaseUser => ({ uid: 'u', email });
  const jsonResponse = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('un correo de ADMIN_EMAILS es admin sin consultar Firestore', async () => {
    let calls = 0;
    const resolver = createAdminResolver({
      adminEmails: ['belsyvargas99@gmail.com'],
      projectId: 'p',
      databaseId: 'd',
      fetchImpl: (async () => {
        calls += 1;
        return jsonResponse({}, 404);
      }) as typeof fetch,
    });
    assert.equal(await resolver(user('Belsyvargas99@gmail.com'), 't'), true);
    assert.equal(calls, 0);
  });

  it('authorizedAdmins/{email} activo -> admin, leído con el token del usuario y en caché', async () => {
    const seen: { url: string; auth: string }[] = [];
    const resolver = createAdminResolver({
      adminEmails: ['jefe@example.com'],
      projectId: 'gen-lang-client-0551519025',
      databaseId: 'ai-studio-3597d09b-0266-4bf3-9b3e-a6dc952c1277',
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        const headers = (init?.headers || {}) as Record<string, string>;
        seen.push({ url: String(url), auth: String(headers.Authorization || '') });
        return jsonResponse({ fields: { active: { booleanValue: true } } }, 200);
      }) as typeof fetch,
    });
    assert.equal(await resolver(user('operador@example.com'), 'ID_TOKEN_X'), true);
    assert.equal(await resolver(user('operador@example.com'), 'ID_TOKEN_X'), true);
    assert.equal(seen.length, 1);
    assert.match(
      seen[0].url,
      /projects\/gen-lang-client-0551519025\/databases\/ai-studio-3597d09b-0266-4bf3-9b3e-a6dc952c1277\/documents\/authorizedAdmins\/operador%40example\.com$/
    );
    assert.equal(seen[0].auth, 'Bearer ID_TOKEN_X');
  });

  it('documento inactivo, inexistente o sin permiso -> no es admin', async () => {
    const responses = [
      () => jsonResponse({ fields: { active: { booleanValue: false } } }, 200),
      () => jsonResponse({}, 404),
      () => jsonResponse({}, 403),
    ];
    for (const makeResponse of responses) {
      const resolver = createAdminResolver({
        adminEmails: [],
        projectId: 'p',
        databaseId: 'd',
        fetchImpl: (async () => makeResponse()) as typeof fetch,
      });
      assert.equal(await resolver(user('nadie@example.com'), 't'), false);
    }
  });

  it('Firestore caído -> error 503 (nunca concede acceso)', async () => {
    const resolver = createAdminResolver({
      adminEmails: [],
      projectId: 'p',
      databaseId: 'd',
      fetchImpl: (async () => jsonResponse({}, 500)) as typeof fetch,
    });
    await assert.rejects(resolver(user('nadie@example.com'), 't'), (err: unknown) => {
      assert.ok(err instanceof AdminAuthError);
      assert.equal(err.status, 503);
      return true;
    });
  });
});
