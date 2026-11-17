import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, type ServerPublicContractState } from './server';
import { AdminAuthError } from './backend/adminAuth';

let server: http.Server;
let baseUrl = '';

// Las rutas de admin exigen Firebase ID token: aquí se inyecta un verificador falso.
const ADMIN_TOKEN = 'test-admin-token';
const ADMIN_AUTH = { Authorization: `Bearer ${ADMIN_TOKEN}` };

const MOCK_CONTRACTS = new Map<string, ServerPublicContractState>([
  [
    'MF-2026-TOKEN123',
    {
      contractId: 'ctr_test_1',
      publicToken: 'MF-2026-TOKEN123',
      bulkToken: 'BLK-2026-TITANES',
      status: 'active',
      openDate: '2020-01-01',
      openTime: '00:00',
      closeDate: '2099-12-31',
      closeTime: '23:59',
      timezone: 'America/Caracas',
      individualRegistrationEnabled: true,
      bulkRegistrationEnabled: true,
      availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    },
  ],
  [
    'MF-EXPIRED-TOKEN99',
    {
      contractId: 'ctr_expired_1',
      publicToken: 'MF-EXPIRED-TOKEN99',
      status: 'active',
      openDate: '2020-01-01',
      openTime: '00:00',
      closeDate: '2021-01-01',
      closeTime: '12:00',
      timezone: 'America/Caracas',
      closedMessage: 'El plazo oficial venció el 01/01/2021.',
      individualRegistrationEnabled: true,
      bulkRegistrationEnabled: false,
      availableSizes: ['S', 'M', 'L'],
    },
  ],
  [
    'MF-BULKONLY-TOKEN7',
    {
      contractId: 'ctr_bulkonly_1',
      publicToken: 'MF-BULKONLY-TOKEN7',
      bulkToken: 'BLK-ONLY-999888',
      status: 'active',
      openDate: '2020-01-01',
      openTime: '00:00',
      closeDate: '2099-12-31',
      closeTime: '23:59',
      timezone: 'America/Caracas',
      individualRegistrationEnabled: false,
      bulkRegistrationEnabled: true,
      bulkLinkExpiresAt: '2021-02-01',
      availableSizes: ['S', 'M', 'L'],
    },
  ],
]);

before(async () => {
  const app = createApp({
    resolvePublicContract: async (token) => MOCK_CONTRACTS.get(token) || null,
    verifyIdToken: async (token) => {
      if (token === ADMIN_TOKEN) return { uid: 'uid_admin', email: 'admin@test.local' };
      throw new AdminAuthError(401, 'Token inválido.');
    },
    isAdminUser: async (user) => user.email === 'admin@test.local',
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
});

describe('MEGO FORCE Express API routes', () => {
  it('GET /api/health returns ok status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'mego-force-api');
  });

  it('POST /api/public/validate-registration normalizes ID preserving leading zeros and hashes cédula', async () => {
    const res = await fetch(`${baseUrl}/api/public/validate-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: 'ctr_test_1',
        publicToken: 'MF-2026-TOKEN123',
        fullName: '  Carlos   Mendoza  ',
        identificationNumber: '001-234567-8',
        size: 'm',
        nickname: '  EL RAYO ',
        phone: '+58 412-555 0199',
        instagram: 'carlos_run',
        paymentSelection: 'PAGO COMPLETO',
        privacyAccepted: true,
        customFields: {},
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, true);
    assert.equal(body.normalized.fullName, 'Carlos Mendoza');
    assert.equal(body.normalized.identificationNumber, '001-234567-8');
    assert.equal(body.normalized.size, 'M');
    assert.equal(body.normalized.instagram, '@carlos_run');
    assert.equal(body.normalized.nickname, 'EL RAYO');
    assert.match(body.normalized.identificationHash, /^[a-f0-9]{64}$/);
  });

  it('POST /api/public/validate-registration blocks expired contract server-side (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/public/validate-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: 'ctr_expired_1',
        publicToken: 'MF-EXPIRED-TOKEN99',
        fullName: 'Carlos Mendoza',
        identificationNumber: '12345678',
        size: 'M',
        phone: '+584125550199',
        paymentSelection: 'PAGO COMPLETO',
        privacyAccepted: true,
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.reasonCode, 'EXPIRED');
    assert.equal(body.effectiveStatus, 'auto_closed');
    assert.match(body.error, /venció/);
  });

  it('POST /api/public/validate-registration blocks individual registration when modality is disabled (HTTP 403)', async () => {
    const res = await fetch(`${baseUrl}/api/public/validate-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: 'ctr_bulkonly_1',
        publicToken: 'MF-BULKONLY-TOKEN7',
        fullName: 'Ana Pérez',
        identificationNumber: '12345678',
        size: 'M',
        phone: '+584125550199',
        paymentSelection: 'PAGO COMPLETO',
        privacyAccepted: true,
      }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.reasonCode, 'MODE_DISABLED');
  });

  it('GET /api/public/contract-window detects revoked bulkToken and expired links', async () => {
    const revokedRes = await fetch(
      `${baseUrl}/api/public/contract-window/MF-2026-TOKEN123?mode=bulk&bulkToken=OLD_REVOKED_TOK`
    );
    assert.equal(revokedRes.status, 200);
    const revokedBody = await revokedRes.json();
    assert.equal(revokedBody.allowed, false);
    assert.equal(revokedBody.linkReasonCode, 'TOKEN_REVOKED');

    const expRes = await fetch(
      `${baseUrl}/api/public/contract-window/MF-BULKONLY-TOKEN7?mode=bulk&bulkToken=BLK-ONLY-999888`
    );
    assert.equal(expRes.status, 200);
    const expBody = await expRes.json();
    assert.equal(expBody.allowed, false);
    assert.equal(expBody.linkReasonCode, 'LINK_EXPIRED');
  });

  it('POST /api/public/validate-bulk-batch validates 120 rows, detects duplicates, and blocks revoked bulkToken', async () => {
    // 1. Revoked token rejected with 403
    const badTokRes = await fetch(`${baseUrl}/api/public/validate-bulk-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: 'ctr_test_1',
        publicToken: 'MF-2026-TOKEN123',
        bulkToken: 'BLK-REVOKED-OLD',
        representativeName: 'Ana Directora',
        representativeContact: '04141112233',
        rows: [
          {
            rowId: 'r1',
            fullName: 'Luis Torres',
            identificationNumber: '00445566',
            size: 'M',
            phone: '04121234567',
            paymentSelection: 'PAGO COMPLETO',
          },
        ],
      }),
    });
    assert.equal(badTokRes.status, 403);
    const badTokBody = await badTokRes.json();
    assert.equal(badTokBody.reasonCode, 'TOKEN_REVOKED');

    // 2. Large 120-row batch with 2 colliding duplicate rows + 1 error row
    const bulkRows = Array.from({ length: 118 }, (_, i) => ({
      rowId: `r_${i + 1}`,
      fullName: `Participante ${i + 1}`,
      identificationNumber: `0088${String(i + 1).padStart(4, '0')}`,
      size: 'm',
      nickname: `ATLETA${i + 1}`,
      phone: `0412999${String(i + 1).padStart(4, '0')}`,
      instagram: `ig_${i + 1}`,
      paymentSelection: i % 2 === 0 ? ('PAGO COMPLETO' as const) : ('PAGO PARCIAL' as const),
    }));
    bulkRows.push(
      {
        rowId: 'dup_1',
        fullName: 'Luis Torres',
        identificationNumber: '00880001', // collides with r_1!
        size: 'l',
        nickname: 'TORRES',
        phone: '04121234567',
        instagram: 'ltorres',
        paymentSelection: 'PAGO COMPLETO',
      },
      {
        rowId: 'bad_1',
        fullName: 'Bad Row',
        identificationNumber: '1',
        size: 'M',
        nickname: '',
        phone: '12',
        instagram: '',
        paymentSelection: 'PAGO PARCIAL',
      }
    );

    const res = await fetch(`${baseUrl}/api/public/validate-bulk-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: 'ctr_test_1',
        publicToken: 'MF-2026-TOKEN123',
        bulkToken: 'BLK-2026-TITANES',
        representativeName: 'Ana Directora',
        representativeContact: '04141112233',
        rows: bulkRows,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.validRows.length, 117);
    assert.equal(body.errorRows.length, 3);
    assert.equal(body.duplicatesInBatch, 2);
    assert.match(body.validRows[0].identificationHash, /^[a-f0-9]{64}$/);
  });

  it('POST /api/contracts/reconcile-schedules detects expired and ready-to-open contracts', async () => {
    const res = await fetch(`${baseUrl}/api/contracts/reconcile-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ADMIN_AUTH },
      body: JSON.stringify({
        contracts: [
          {
            contractId: 'c_exp',
            status: 'active',
            closeDate: '2022-01-01',
            closeTime: '10:00',
            timezone: 'America/Caracas',
          },
          {
            contractId: 'c_open',
            status: 'scheduled',
            openDate: '2022-01-01',
            openTime: '10:00',
            closeDate: '2099-01-01',
            closeTime: '10:00',
            timezone: 'America/Caracas',
          },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.transitions.length, 2);
    assert.equal(body.transitions[0].nextStatus, 'auto_closed');
    assert.equal(body.transitions[1].nextStatus, 'active');
  });

  it('POST /api/public/validate-registration rejects unaccepted privacy policy', async () => {
    const res = await fetch(`${baseUrl}/api/public/validate-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: 'ctr_test_1',
        publicToken: 'MF-2026-TOKEN123',
        fullName: 'Ana Pérez',
        identificationNumber: '12345678',
        size: 'S',
        phone: '04141234567',
        paymentSelection: 'PAGO PARCIAL',
        privacyAccepted: false,
      }),
    });

    assert.equal(res.status, 400);
  });

  it('POST /api/sheets/create-spreadsheet requires OAuth Bearer authorization', async () => {
    const res = await fetch(`${baseUrl}/api/sheets/create-spreadsheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractTitle: 'Test',
        contractCode: 'MF-001',
        availableSizes: ['S', 'M'],
      }),
    });

    assert.equal(res.status, 401);
  });
});

