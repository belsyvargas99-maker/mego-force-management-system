import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIdentificationDisplay,
  normalizeIdentificationKey,
  maskIdentification,
  normalizePhone,
  normalizeInstagram,
  computeIdentificationHash,
  generatePublicToken,
  generateRegistrationCode,
} from './normalizers';
import {
  sortRegistrationsChronologically,
  groupRegistrationsBySize,
  calculateProductionSummary,
  calculateDashboardMetrics,
  buildDuplicatedContractDraft,
} from './sizeEngine';
import {
  computeLocalTimestampUtcMs,
  evaluateContractWindow,
  evaluatePublicLinkAvailability,
} from './contractSchedule';
import {
  buildProductionOrderSnapshot,
  detectOrderParticipantChanges,
  generateProductionOrderCode,
} from './productionOrders';
import {
  autoDetectColumnMapping,
  chunkItems,
  mapRawRowsToBulkDrafts,
  validateBulkRows,
} from './bulkValidation';
import { createDefaultFormConfig } from './defaultForm';
import type { Contract, ProductionOrder, Registration } from '../types/mego';

function makeReg(overrides: Partial<Registration>): Registration {
  return {
    registrationId: 'reg_1',
    registrationCode: 'MF-26-ABC123',
    contractId: 'c_1',
    publicToken: 'tok123456789',
    fullName: 'Jugador Demo',
    identificationNumber: '00123456',
    identificationHash: 'hash123',
    size: 'M',
    nickname: 'DEMO',
    phone: '+584120001122',
    instagram: '@demo',
    paymentSelection: 'PAGO COMPLETO',
    paymentVerificationStatus: 'pending',
    privacyAccepted: true,
    registrationTimestamp: '2026-11-16T10:00:00.000Z',
    registrationStatus: 'confirmed',
    registrationMode: 'individual',
    source: 'public_form',
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:00:00.000Z',
    ...overrides,
  };
}

test('normalizers preserve leading zeros on cedula and phone and format instagram', () => {
  assert.equal(normalizeIdentificationDisplay(' 001234567 '), '001234567');
  assert.equal(normalizeIdentificationKey('00.123-456'), '00123456');
  assert.equal(maskIdentification('0012345678'), '••••••5678');
  assert.equal(normalizePhone('+58 0412-0098765'), '+5804120098765');
  assert.equal(normalizePhone('0412 009 8765'), '04120098765');
  assert.equal(normalizeInstagram('MegoAthlete'), '@megoathlete');
  assert.equal(normalizeInstagram('@@MegoAthlete'), '@megoathlete');
  assert.equal(normalizeInstagram('   '), '');
});

test('hash determinism detects duplicates regardless of spacing or punctuation', async () => {
  const h1 = await computeIdentificationHash('contract_a', '00123-456');
  const h2 = await computeIdentificationHash('contract_a', '00123456');
  const h3 = await computeIdentificationHash('contract_b', '00123456');
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.equal(generatePublicToken(12).length, 12);
  assert.match(generateRegistrationCode(), /^MF-\d{2}-[A-Z0-9]{6}$/);
});

test('sizeEngine groups automatically by configured sizes while keeping chronological order', () => {
  const regs: Registration[] = [
    makeReg({ registrationId: 'r3', size: 'L', registrationTimestamp: '2026-11-16T12:00:00.000Z', paymentSelection: 'PAGO PARCIAL', paymentVerificationStatus: 'pending' }),
    makeReg({ registrationId: 'r1', size: 'M', registrationTimestamp: '2026-11-16T08:00:00.000Z', paymentSelection: 'PAGO COMPLETO', paymentVerificationStatus: 'verified' }),
    makeReg({ registrationId: 'r2', size: 'M', registrationTimestamp: '2026-11-16T09:00:00.000Z', paymentSelection: 'PAGO COMPLETO', paymentVerificationStatus: 'pending' }),
    makeReg({ registrationId: 'r4', size: '4XL', registrationTimestamp: '2026-11-16T13:00:00.000Z', nickname: '', paymentSelection: 'PAGO PARCIAL', paymentVerificationStatus: 'rejected' }),
  ];

  const chrono = sortRegistrationsChronologically(regs);
  assert.deepEqual(chrono.map((r) => r.registrationId), ['r1', 'r2', 'r3', 'r4']);

  const groups = groupRegistrationsBySize(regs, ['XS', 'S', 'M', 'L', 'XL']);
  const mGroup = groups.find((g) => g.size === 'M');
  const customGroup = groups.find((g) => g.size === '4XL');
  assert.equal(mGroup?.count, 2);
  assert.equal(mGroup?.percentage, 50);
  assert.deepEqual(mGroup?.registrations.map((r) => r.registrationId), ['r1', 'r2']);
  assert.equal(customGroup?.count, 1);

  const summary = calculateProductionSummary(regs, ['XS', 'S', 'M', 'L', 'XL']);
  assert.equal(summary.totalGarments, 4);
  assert.equal(summary.verifiedPayments, 1);
  assert.equal(summary.pendingVerifications, 2);
  assert.equal(summary.rejectedPayments, 1);
  assert.equal(summary.fullPaymentsDeclared, 2);
  assert.equal(summary.partialPaymentsDeclared, 2);
  assert.equal(summary.customNicknamesCount, 3);
});

test('dashboard metrics and contract duplication preserve config without cloning participants', () => {
  const c1: Contract = {
    contractId: 'c_1',
    contractCode: 'MF-2026-01',
    organizationName: 'Club Titanes',
    title: 'Uniforme Oficial Titanes',
    description: 'Kit completo',
    garmentType: 'Jersey Sublimado Pro',
    garmentFeatures: ['Tela Dry-Fit'],
    status: 'active',
    publicToken: 'tok_alpha_1234',
    availableSizes: ['S', 'M', 'L'],
    mockupImages: [{ id: 'm1', url: '/img.png', caption: 'Frente', isPrimary: true, order: 0 }],
    formConfig: createDefaultFormConfig(),
    totalParticipants: 2,
    createdBy: 'admin_1',
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T08:00:00.000Z',
  };

  const regs = [
    makeReg({ registrationId: 'r1', contractId: 'c_1', size: 'S', paymentSelection: 'PAGO COMPLETO', paymentVerificationStatus: 'verified' }),
    makeReg({ registrationId: 'r2', contractId: 'c_1', size: 'L', paymentSelection: 'PAGO PARCIAL', paymentVerificationStatus: 'pending' }),
  ];

  const metrics = calculateDashboardMetrics([c1], regs, ['S', 'M', 'L']);
  assert.equal(metrics.activeContracts, 1);
  assert.equal(metrics.totalParticipants, 2);
  assert.equal(metrics.verifiedPayments, 1);
  assert.equal(metrics.pendingVerificationPayments, 1);

  const dup = buildDuplicatedContractDraft(c1, 'c_2', 'tok_beta_5678', 'admin_1', '2026-11-16T14:00:00.000Z');
  assert.equal(dup.contractId, 'c_2');
  assert.equal(dup.totalParticipants, 0);
  assert.equal(dup.status, 'draft');
  assert.equal(dup.mockupImages.length, 1);
  assert.equal(dup.formConfig.fields.length, c1.formConfig.fields.length);
});

test('contractSchedule evaluates scheduled opening, open window, automatic closing, and manual reopen', () => {
  const tz = 'America/Caracas'; // UTC-4
  const openMs = computeLocalTimestampUtcMs('2026-11-20', '08:00', tz)!;
  const closeMs = computeLocalTimestampUtcMs('2026-11-25', '18:00', tz)!;
  assert.ok(openMs < closeMs);

  // Before opening
  const beforeRes = evaluateContractWindow(
    {
      status: 'scheduled',
      openDate: '2026-11-20',
      openTime: '08:00',
      closeDate: '2026-11-25',
      closeTime: '18:00',
      timezone: tz,
    },
    openMs - 60_000
  );
  assert.equal(beforeRes.effectiveStatus, 'scheduled');
  assert.equal(beforeRes.isAcceptingRegistrations, false);
  assert.equal(beforeRes.reasonCode, 'NOT_YET_OPEN');

  // Inside window -> automatically opens
  const insideRes = evaluateContractWindow(
    {
      status: 'scheduled',
      openDate: '2026-11-20',
      openTime: '08:00',
      closeDate: '2026-11-25',
      closeTime: '18:00',
      timezone: tz,
    },
    openMs + 60_000
  );
  assert.equal(insideRes.effectiveStatus, 'active');
  assert.equal(insideRes.isAcceptingRegistrations, true);

  // After close -> automatically closes with custom message
  const expiredRes = evaluateContractWindow(
    {
      status: 'active',
      openDate: '2026-11-20',
      openTime: '08:00',
      closeDate: '2026-11-25',
      closeTime: '18:00',
      timezone: tz,
      closedMessage: 'Inscripciones cerradas por fecha límite.',
    },
    closeMs + 1000
  );
  assert.equal(expiredRes.effectiveStatus, 'auto_closed');
  assert.equal(expiredRes.isAcceptingRegistrations, false);
  assert.equal(expiredRes.reasonCode, 'EXPIRED');
  assert.equal(expiredRes.visitorMessage, 'Inscripciones cerradas por fecha límite.');

  // Extended / reopened deadline works immediately
  const reopenedRes = evaluateContractWindow(
    {
      status: 'active',
      openDate: '2026-11-20',
      openTime: '08:00',
      closeDate: '2026-11-30',
      closeTime: '23:59',
      timezone: tz,
    },
    closeMs + 1000
  );
  assert.equal(reopenedRes.effectiveStatus, 'active');
  assert.equal(reopenedRes.isAcceptingRegistrations, true);
});

test('productionOrders snapshots remain immutable after approval and detect subsequent participant changes', () => {
  const contract: Contract = {
    contractId: 'c_1',
    contractCode: 'MF-2026-01',
    organizationName: 'Club Titanes',
    title: 'Kit Competitivo',
    description: '',
    garmentType: 'Jersey Dry-Tech',
    garmentFeatures: [],
    status: 'active',
    publicToken: 'tok_alpha_1234',
    availableSizes: ['XS', 'S', 'M', 'L'],
    mockupImages: [],
    formConfig: createDefaultFormConfig(),
    totalParticipants: 2,
    createdBy: 'admin_1',
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T08:00:00.000Z',
  };

  const initialRegs = [
    makeReg({ registrationId: 'r1', size: 'S', nickname: 'RAYO' }),
    makeReg({ registrationId: 'r2', size: 'M', nickname: 'TIGRE' }),
  ];

  const snap1 = buildProductionOrderSnapshot(contract, initialRegs);
  assert.equal(snap1.totalGarments, 2);
  assert.equal(snap1.sizeSummary['S'], 1);
  assert.equal(snap1.sizeSummary['M'], 1);
  assert.match(generateProductionOrderCode(contract.contractCode, 1), /^OP-MF-2026-01-V1-\d{3}$/);

  const approvedOrder: ProductionOrder = {
    orderId: 'ord_1',
    orderCode: 'OP-MF-2026-01-V1-101',
    contractId: 'c_1',
    contractCode: 'MF-2026-01',
    contractTitle: 'Kit Competitivo',
    organizationName: 'Club Titanes',
    garmentType: 'Jersey Dry-Tech',
    status: 'approved',
    version: 1,
    isFrozen: true,
    totalGarments: snap1.totalGarments,
    availableSizes: snap1.availableSizes,
    sizeSummary: snap1.sizeSummary,
    snapshotItems: snap1.snapshotItems,
    observations: 'Aprobado para corte',
    responsibleUid: 'admin_1',
    responsibleName: 'Admin',
    versionHistory: [],
    createdAt: '2026-11-16T10:00:00.000Z',
    updatedAt: '2026-11-16T10:00:00.000Z',
  };

  // Subsequent participant change (1 added, 1 changed size)
  const updatedRegs = [
    makeReg({ registrationId: 'r1', size: 'L', nickname: 'RAYO' }),
    makeReg({ registrationId: 'r2', size: 'M', nickname: 'TIGRE' }),
    makeReg({ registrationId: 'r3', size: 'XS', nickname: 'NUEVO' }),
  ];

  // Approved v1 snapshot remains completely untouched
  assert.equal(approvedOrder.snapshotItems.length, 2);
  assert.equal(approvedOrder.snapshotItems[0].size, 'S');

  const diff = detectOrderParticipantChanges(approvedOrder, updatedRegs);
  assert.equal(diff.hasChanges, true);
  assert.equal(diff.addedCount, 1);
  assert.equal(diff.modifiedCount, 1);
  assert.equal(diff.removedCount, 0);
});

test('bulkValidation flags duplicates, preserves leading zeros, isolates error rows, and chunks batches safely', () => {
  const rows = [
    {
      rowId: 'r1',
      fullName: 'María López',
      identificationNumber: '00123456',
      size: 'm',
      nickname: 'MARI',
      phone: '+58 412 1112233',
      instagram: 'marialopez',
      paymentSelection: 'PAGO COMPLETO' as const,
    },
    {
      rowId: 'r2',
      fullName: 'Pedro Gómez',
      identificationNumber: '00.123-456', // duplicate of r1 after key normalization!
      size: 'L',
      nickname: 'PEDRO',
      phone: '04149998877',
      instagram: '',
      paymentSelection: 'PAGO PARCIAL' as const,
    },
    {
      rowId: 'r3',
      fullName: 'X',
      identificationNumber: '99887766',
      size: 'INVALID_SIZE',
      nickname: '',
      phone: '123',
      instagram: '',
      paymentSelection: 'PAGO COMPLETO' as const,
    },
  ];

  const existingKeys = new Set<string>(['55443322']);
  const { validRows, errorRows, results } = validateBulkRows(rows, ['XS', 'S', 'M', 'L'], existingKeys);

  assert.equal(validRows.length, 0); // r1 and r2 both collide inside batch!
  assert.equal(errorRows.length, 3);
  assert.equal(results[0].isDuplicateInBatch, true);
  assert.equal(results[1].isDuplicateInBatch, true);
  assert.equal(results[0].normalized.identificationNumber, '00123456');
  assert.equal(results[0].normalized.instagram, '@marialopez');
  assert.ok(results[2].errors.fullName);
  assert.ok(results[2].errors.size);
  assert.ok(results[2].errors.phone);

  // Deduplicated valid check + batch chunking
  const cleanBatch = [rows[0], { ...rows[1], identificationNumber: '77665544' }];
  const cleanCheck = validateBulkRows(cleanBatch, ['XS', 'S', 'M', 'L'], existingKeys);
  assert.equal(cleanCheck.validRows.length, 2);
  assert.equal(cleanCheck.errorRows.length, 0);

  const chunks = chunkItems(Array.from({ length: 175 }, (_, i) => i), 80);
  assert.deepEqual(
    chunks.map((c) => c.length),
    [80, 80, 15]
  );
});

test('Version 2.1 evaluatePublicLinkAvailability independently gates individual and bulk portals and link expirations', () => {
  const now = Date.parse('2026-11-16T15:00:00.000Z');
  const baseContract = {
    status: 'active' as const,
    openDate: '2026-11-01',
    openTime: '00:00',
    closeDate: '2026-12-31',
    closeTime: '23:59',
    timezone: 'America/Caracas',
    individualRegistrationEnabled: false,
    bulkRegistrationEnabled: true,
    individualLinkExpiresAt: '',
    bulkLinkExpiresAt: '2026-12-01',
  };

  // Individual disabled while bulk is enabled
  const indivDisabled = evaluatePublicLinkAvailability(baseContract, 'individual', now);
  assert.equal(indivDisabled.allowed, false);
  assert.equal(indivDisabled.reasonCode, 'MODE_DISABLED');

  const bulkAllowed = evaluatePublicLinkAvailability(baseContract, 'bulk', now);
  assert.equal(bulkAllowed.allowed, true);
  assert.equal(bulkAllowed.reasonCode, 'ALLOWED');

  // Expired bulk link blocked even while contract window is open
  const expiredBulk = evaluatePublicLinkAvailability(
    { ...baseContract, bulkLinkExpiresAt: '2026-11-10' },
    'bulk',
    now
  );
  assert.equal(expiredBulk.allowed, false);
  assert.equal(expiredBulk.reasonCode, 'LINK_EXPIRED');
});

test('autoDetectColumnMapping + mapRawRowsToBulkDrafts handles differing spreadsheet headers and 120-row chunking', () => {
  const headers = ['Atleta', 'Documento CI', 'Medida', 'Apodo', 'WhatsApp', 'IG', 'Abono'];
  const mapping = autoDetectColumnMapping(headers);
  assert.equal(mapping.fullName, 'Atleta');
  assert.equal(mapping.identificationNumber, 'Documento CI');
  assert.equal(mapping.size, 'Medida');
  assert.equal(mapping.nickname, 'Apodo');
  assert.equal(mapping.phone, 'WhatsApp');
  assert.equal(mapping.instagram, 'IG');
  assert.equal(mapping.paymentSelection, 'Abono');

  const rawRows = Array.from({ length: 120 }, (_, i) => ({
    Atleta: `Participante ${i + 1}`,
    'Documento CI': `0099${String(i + 1).padStart(4, '0')}`,
    Medida: i % 2 === 0 ? 'm' : 'L',
    Apodo: `JUG${i + 1}`,
    WhatsApp: `0414100${String(i + 1).padStart(4, '0')}`,
    IG: `user_${i + 1}`,
    Abono: i % 3 === 0 ? 'PAGO PARCIAL' : 'PAGO COMPLETO',
  }));

  const drafts = mapRawRowsToBulkDrafts(rawRows, mapping, 'M');
  assert.equal(drafts.length, 120);
  const { validRows, errorRows } = validateBulkRows(drafts, ['S', 'M', 'L']);
  assert.equal(validRows.length, 120);
  assert.equal(errorRows.length, 0);

  const chunks = chunkItems(validRows, 80);
  assert.deepEqual(
    chunks.map((c) => c.length),
    [80, 40]
  );
});

