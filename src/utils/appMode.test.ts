import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicUrl,
  canAccessAdmin,
  canAccessPublicPortal,
  isAdminPath,
  isApiPath,
  isLocalDevHost,
  isPublicApiPath,
  normalizeHostname,
  resolveAppMode,
} from './appMode';

const HOSTS = {
  publicHost: 'mego-registro.systemagencygarciavargas.tech',
  adminHost: 'mego-admin.systemagencygarciavargas.tech',
};

describe('resolveAppMode (modo por host)', () => {
  it('host admin -> admin', () => {
    assert.equal(resolveAppMode('mego-admin.systemagencygarciavargas.tech', HOSTS), 'admin');
  });

  it('host público -> public', () => {
    assert.equal(resolveAppMode('mego-registro.systemagencygarciavargas.tech', HOSTS), 'public');
  });

  it('ignora mayúsculas, puerto y punto final', () => {
    assert.equal(resolveAppMode('MEGO-ADMIN.systemagencygarciavargas.tech:443', HOSTS), 'admin');
    assert.equal(resolveAppMode('mego-registro.systemagencygarciavargas.tech.', HOSTS), 'public');
  });

  it('localhost sin modo forzado -> all', () => {
    assert.equal(resolveAppMode('localhost', HOSTS), 'all');
    assert.equal(resolveAppMode('127.0.0.1', HOSTS), 'all');
    assert.equal(resolveAppMode('app.localhost', HOSTS), 'all');
  });

  it('el modo forzado (APP_MODE) gana sobre localhost pero no sobre los hosts configurados', () => {
    assert.equal(resolveAppMode('localhost', { ...HOSTS, fallbackMode: 'public' }), 'public');
    assert.equal(
      resolveAppMode('mego-admin.systemagencygarciavargas.tech', { ...HOSTS, fallbackMode: 'public' }),
      'admin'
    );
  });

  it('host desconocido -> public (nunca expone el panel)', () => {
    assert.equal(resolveAppMode('2.24.202.165', HOSTS), 'public');
    assert.equal(resolveAppMode('evil.example.com', HOSTS), 'public');
    assert.equal(resolveAppMode('mego-admin.systemagencygarciavargas.tech.evil.com', HOSTS), 'public');
    assert.equal(resolveAppMode('', HOSTS), 'public');
  });

  it('modo forzado inválido se ignora', () => {
    assert.equal(resolveAppMode('evil.example.com', { ...HOSTS, fallbackMode: 'root' }), 'public');
  });

  it('permisos por modo', () => {
    assert.equal(canAccessAdmin('public'), false);
    assert.equal(canAccessAdmin('admin'), true);
    assert.equal(canAccessAdmin('all'), true);
    assert.equal(canAccessPublicPortal('admin'), false);
    assert.equal(canAccessPublicPortal('public'), true);
  });
});

describe('helpers de rutas y hosts', () => {
  it('isPublicApiPath solo deja /api/public/* y /api/health', () => {
    assert.equal(isPublicApiPath('/api/health'), true);
    assert.equal(isPublicApiPath('/api/public/validate-registration'), true);
    assert.equal(isPublicApiPath('/api/uploads/mockup'), false);
    assert.equal(isPublicApiPath('/api/import/parse'), false);
    assert.equal(isPublicApiPath('/api/contracts/reconcile-schedules'), false);
    assert.equal(isPublicApiPath('/api/publicity'), false);
    assert.equal(isPublicApiPath('/api/health/extra'), false);
  });

  it('isApiPath e isPublicApiPath no distinguen mayúsculas (igual que Express)', () => {
    assert.equal(isApiPath('/api'), true);
    assert.equal(isApiPath('/API/sheets/create-spreadsheet'), true);
    assert.equal(isApiPath('/Api/uploads/mockup'), true);
    assert.equal(isApiPath('/apis'), false);
    assert.equal(isApiPath('/registro/abc'), false);
    assert.equal(isPublicApiPath('/API/health'), true);
    assert.equal(isPublicApiPath('/Api/Public/contract-window/x'), true);
    assert.equal(isPublicApiPath('/API/sheets/sync-contract'), false);
    assert.equal(isPublicApiPath('/API/uploads/mockup'), false);
  });

  it('isAdminPath no confunde /administracion', () => {
    assert.equal(isAdminPath('/admin'), true);
    assert.equal(isAdminPath('/admin/'), true);
    assert.equal(isAdminPath('/Admin/dashboard'), true);
    assert.equal(isAdminPath('/administracion'), false);
    assert.equal(isAdminPath('/registro/abc'), false);
  });

  it('normalizeHostname e isLocalDevHost', () => {
    assert.equal(normalizeHostname('https://Mego-Admin.example.com/ruta'), 'mego-admin.example.com');
    assert.equal(normalizeHostname('[::1]:3000'), '::1');
    assert.equal(isLocalDevHost('[::1]:3000'), true);
    assert.equal(isLocalDevHost('localhost.evil.com'), false);
  });

  it('buildPublicUrl apunta siempre al host público en producción', () => {
    assert.equal(
      buildPublicUrl('/registro/TOKEN123', {
        hostname: 'mego-admin.systemagencygarciavargas.tech',
        origin: 'https://mego-admin.systemagencygarciavargas.tech',
        publicHost: HOSTS.publicHost,
      }),
      'https://mego-registro.systemagencygarciavargas.tech/registro/TOKEN123'
    );
    assert.equal(
      buildPublicUrl('registro/TOKEN123', {
        hostname: 'localhost',
        origin: 'http://localhost:3000',
        publicHost: HOSTS.publicHost,
      }),
      'http://localhost:3000/registro/TOKEN123'
    );
  });
});
