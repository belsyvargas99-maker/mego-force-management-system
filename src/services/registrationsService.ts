import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { runTransaction, writeBatch } from './firestoreSafe';
import { db } from '../config/firebase';
import type {
  AuditChange,
  Contract,
  PaymentSelection,
  PaymentVerificationStatus,
  Registration,
  RegistrationLock,
  RegistrationMode,
  RegistrationStatus,
} from '../types/mego';
import {
  computeIdentificationHash,
  generateEntityId,
  generateRegistrationCode,
  maskIdentification,
  normalizeIdentificationDisplay,
  normalizeInstagram,
  normalizeNickname,
  normalizePhone,
} from '../utils/normalizers';
import { recordAuditLog } from './auditService';
import { handleFirestoreError, OperationType } from './firestoreErrors';

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapDocToRegistration(id: string, data: Record<string, any>): Registration {
  return {
    registrationId: data.registrationId || id,
    registrationCode: data.registrationCode || '',
    contractId: data.contractId || '',
    publicToken: data.publicToken || '',
    fullName: data.fullName || '',
    identificationNumber: data.identificationNumber || '',
    identificationHash: data.identificationHash || '',
    size: data.size || '',
    nickname: data.nickname || '',
    phone: data.phone || '',
    instagram: data.instagram || '',
    paymentSelection: (data.paymentSelection as PaymentSelection) || 'PAGO COMPLETO',
    paymentVerificationStatus:
      (data.paymentVerificationStatus as PaymentVerificationStatus) || 'pending',
    paymentAmount: typeof data.paymentAmount === 'number' ? data.paymentAmount : undefined,
    paymentNotes: data.paymentNotes || '',
    customFields: data.customFields || {},
    privacyAccepted: data.privacyAccepted === true,
    registrationTimestamp: toIso(data.registrationTimestamp || data.createdAt),
    registrationStatus: (data.registrationStatus as RegistrationStatus) || 'confirmed',
    registrationMode:
      (data.registrationMode as RegistrationMode) ||
      (data.source === 'bulk_representative' ? 'bulk' : 'individual'),
    bulkSubmissionId: data.bulkSubmissionId || '',
    representativeName: data.representativeName || '',
    source: data.source || 'public_form',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export interface SubmitPublicRegistrationInput {
  contractId: string;
  publicToken: string;
  fullName: string;
  identificationNumber: string;
  size: string;
  nickname: string;
  phone: string;
  instagram: string;
  paymentSelection: PaymentSelection;
  privacyAccepted: boolean;
  customFields?: Record<string, string | string[] | boolean | number>;
  garmentItems?: { garment: string; size: string; nickname?: string }[];
}

export async function submitPublicRegistration(
  input: SubmitPublicRegistrationInput
): Promise<RegistrationLock> {
  // 1. Server-side validation & normalization
  const valRes = await fetch('/api/public/validate-registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const valJson = await valRes.json();
  if (!valRes.ok) {
    throw new Error(valJson?.error || 'Verifica los datos ingresados en el formulario.');
  }

  const norm = valJson.normalized as {
    contractId: string;
    publicToken: string;
    fullName: string;
    identificationNumber: string;
    identificationHash: string;
    size: string;
    nickname: string;
    phone: string;
    instagram: string;
    paymentSelection: PaymentSelection;
    privacyAccepted: boolean;
    customFields: Record<string, string | string[] | boolean | number>;
  };

  const registrationId = generateEntityId('reg');
  const registrationCode = generateRegistrationCode('MF');
  const jobId = generateEntityId('job');
  const idLockKey = `${norm.contractId}_${norm.identificationHash}`;
  const codeLockKey = `${norm.contractId}_${registrationCode}`;

  const publicContractRef = doc(db, 'publicContracts', norm.publicToken);
  const idLockRef = doc(db, 'registrationLocks', idLockKey);
  const codeLockRef = doc(db, 'registrationLocks', codeLockKey);
  const regRef = doc(db, 'registrations', registrationId);
  const syncJobRef = doc(db, 'syncJobs', jobId);

  const lockPayload: Omit<RegistrationLock, 'createdAt'> = {
    contractId: norm.contractId,
    identificationHash: norm.identificationHash,
    registrationId,
    registrationCode,
    maskedId: maskIdentification(norm.identificationNumber),
    displayName: norm.fullName,
    size: norm.size,
    nickname: norm.nickname,
    paymentSelection: norm.paymentSelection,
    paymentVerificationStatus: 'pending',
  };

  try {
    await runTransaction(db, async (tx) => {
      const [pubSnap, lockSnap] = await Promise.all([
        tx.get(publicContractRef),
        tx.get(idLockRef),
      ]);

      if (!pubSnap.exists()) {
        throw new Error('Este contrato no existe o fue retirado.');
      }
      const pubData = pubSnap.data();
      if (pubData.status !== 'active') {
        throw new Error('Los registros para este contrato se encuentran cerrados o pausados.');
      }
      if (pubData.individualRegistrationEnabled === false) {
        throw new Error('El portal de registro individual fue deshabilitado para este contrato.');
      }
      if (lockSnap.exists()) {
        throw new Error(
          'Ya existe un registro confirmado con este número de cédula para este contrato.'
        );
      }

      tx.set(regRef, {
        registrationId,
        registrationCode,
        contractId: norm.contractId,
        publicToken: norm.publicToken,
        fullName: norm.fullName,
        identificationNumber: norm.identificationNumber,
        identificationHash: norm.identificationHash,
        size: norm.size,
        nickname: norm.nickname,
        phone: norm.phone,
        instagram: norm.instagram,
        paymentSelection: norm.paymentSelection,
        paymentVerificationStatus: 'pending',
        customFields: norm.customFields || {},
        ...(input.garmentItems && input.garmentItems.length > 0
          ? { garmentItems: input.garmentItems }
          : {}),
        privacyAccepted: true,
        registrationTimestamp: serverTimestamp(),
        registrationStatus: 'confirmed',
        registrationMode: 'individual',
        source: 'public_form',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(idLockRef, {
        ...lockPayload,
        createdAt: serverTimestamp(),
      });

      tx.set(codeLockRef, {
        ...lockPayload,
        createdAt: serverTimestamp(),
      });

      tx.set(syncJobRef, {
        jobId,
        contractId: norm.contractId,
        registrationId,
        destination: 'google_sheets',
        status: 'pending',
        attempts: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const currentTotal = typeof pubData.totalParticipants === 'number' ? pubData.totalParticipants : 0;
      tx.update(publicContractRef, {
        totalParticipants: currentTotal + 1,
        updatedAt: serverTimestamp(),
      });
    });

    return {
      ...lockPayload,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('cédula') ||
      error.message.includes('cerrados') ||
      error.message.includes('existe')
    )) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `registrations/${registrationId}`);
  }
}

export async function lookupPublicConfirmation(
  contractId: string,
  queryValue: string
): Promise<RegistrationLock | null> {
  const clean = queryValue.trim();
  if (!clean) return null;

  // Try code lookup first if formatted like MF-XX-XXXXXX
  if (/^MF-/i.test(clean)) {
    const codeKey = `${contractId}_${clean.toUpperCase()}`;
    try {
      const snap = await getDoc(doc(db, 'registrationLocks', codeKey));
      if (snap.exists()) {
        const d = snap.data();
        return {
          contractId: d.contractId,
          identificationHash: d.identificationHash,
          registrationId: d.registrationId,
          registrationCode: d.registrationCode,
          maskedId: d.maskedId,
          displayName: d.displayName,
          size: d.size,
          nickname: d.nickname || '',
          paymentSelection: d.paymentSelection,
          paymentVerificationStatus: d.paymentVerificationStatus,
          createdAt: toIso(d.createdAt),
        };
      }
    } catch {
      // fall through
    }
  }

  // Try cédula hash lookup
  const idHash = await computeIdentificationHash(contractId, clean);
  const hashKey = `${contractId}_${idHash}`;
  try {
    const snap = await getDoc(doc(db, 'registrationLocks', hashKey));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      contractId: d.contractId,
      identificationHash: d.identificationHash,
      registrationId: d.registrationId,
      registrationCode: d.registrationCode,
      maskedId: d.maskedId,
      displayName: d.displayName,
      size: d.size,
      nickname: d.nickname || '',
      paymentSelection: d.paymentSelection,
      paymentVerificationStatus: d.paymentVerificationStatus,
      createdAt: toIso(d.createdAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `registrationLocks/${hashKey}`);
  }
}

export function subscribeAllRegistrations(
  callback: (registrations: Registration[]) => void
): () => void {
  const path = 'registrations';
  return onSnapshot(
    query(collection(db, path), orderBy('registrationTimestamp', 'asc')),
    (snap) => {
      callback(snap.docs.map((d) => mapDocToRegistration(d.id, d.data())));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeContractRegistrations(
  contractId: string,
  callback: (registrations: Registration[]) => void
): () => void {
  const path = 'registrations';
  return onSnapshot(
    query(collection(db, path), where('contractId', '==', contractId)),
    (snap) => {
      const list = snap.docs
        .map((d) => mapDocToRegistration(d.id, d.data()))
        .sort(
          (a, b) =>
            new Date(a.registrationTimestamp).getTime() -
            new Date(b.registrationTimestamp).getTime()
        );
      callback(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function updateRegistrationAdmin(
  existingReg: Registration,
  updates: Partial<{
    fullName: string;
    identificationNumber: string;
    size: string;
    nickname: string;
    phone: string;
    instagram: string;
    paymentSelection: PaymentSelection;
    paymentVerificationStatus: PaymentVerificationStatus;
    paymentAmount: number;
    paymentNotes: string;
    registrationStatus: RegistrationStatus;
  }>,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const path = `registrations/${existingReg.registrationId}`;
  try {
    const cleanUpdates: Record<string, any> = {};
    const changedFields: AuditChange[] = [];

    if (updates.fullName !== undefined && updates.fullName.trim() !== existingReg.fullName) {
      cleanUpdates.fullName = updates.fullName.trim();
      changedFields.push({
        field: 'fullName',
        oldValue: existingReg.fullName,
        newValue: cleanUpdates.fullName,
      });
    }
    if (
      updates.identificationNumber !== undefined &&
      normalizeIdentificationDisplay(updates.identificationNumber) !== existingReg.identificationNumber
    ) {
      const nextId = normalizeIdentificationDisplay(updates.identificationNumber);
      cleanUpdates.identificationNumber = nextId;
      cleanUpdates.identificationHash = await computeIdentificationHash(existingReg.contractId, nextId);
      changedFields.push({
        field: 'identificationNumber',
        oldValue: maskIdentification(existingReg.identificationNumber),
        newValue: maskIdentification(nextId),
      });
    }
    if (updates.size !== undefined && updates.size.trim().toUpperCase() !== existingReg.size) {
      cleanUpdates.size = updates.size.trim().toUpperCase();
      changedFields.push({
        field: 'size',
        oldValue: existingReg.size,
        newValue: cleanUpdates.size,
      });
    }
    if (updates.nickname !== undefined) {
      const nextNick = normalizeNickname(updates.nickname, 60);
      if (nextNick !== existingReg.nickname) {
        cleanUpdates.nickname = nextNick;
        changedFields.push({
          field: 'nickname',
          oldValue: existingReg.nickname,
          newValue: nextNick,
        });
      }
    }
    if (updates.phone !== undefined) {
      const nextPhone = normalizePhone(updates.phone);
      if (nextPhone !== existingReg.phone) {
        cleanUpdates.phone = nextPhone;
        changedFields.push({
          field: 'phone',
          oldValue: existingReg.phone,
          newValue: nextPhone,
        });
      }
    }
    if (updates.instagram !== undefined) {
      const nextIg = normalizeInstagram(updates.instagram);
      if (nextIg !== existingReg.instagram) {
        cleanUpdates.instagram = nextIg;
        changedFields.push({
          field: 'instagram',
          oldValue: existingReg.instagram,
          newValue: nextIg,
        });
      }
    }
    if (
      updates.paymentSelection !== undefined &&
      updates.paymentSelection !== existingReg.paymentSelection
    ) {
      cleanUpdates.paymentSelection = updates.paymentSelection;
      changedFields.push({
        field: 'paymentSelection',
        oldValue: existingReg.paymentSelection,
        newValue: updates.paymentSelection,
      });
    }
    if (
      updates.paymentVerificationStatus !== undefined &&
      updates.paymentVerificationStatus !== existingReg.paymentVerificationStatus
    ) {
      cleanUpdates.paymentVerificationStatus = updates.paymentVerificationStatus;
      changedFields.push({
        field: 'paymentVerificationStatus',
        oldValue: existingReg.paymentVerificationStatus,
        newValue: updates.paymentVerificationStatus,
      });
    }
    if (updates.paymentAmount !== undefined && updates.paymentAmount !== existingReg.paymentAmount) {
      cleanUpdates.paymentAmount = updates.paymentAmount;
      changedFields.push({
        field: 'paymentAmount',
        oldValue: String(existingReg.paymentAmount ?? ''),
        newValue: String(updates.paymentAmount),
      });
    }
    if (updates.paymentNotes !== undefined && updates.paymentNotes !== existingReg.paymentNotes) {
      cleanUpdates.paymentNotes = updates.paymentNotes.slice(0, 500);
      changedFields.push({
        field: 'paymentNotes',
        oldValue: existingReg.paymentNotes || '',
        newValue: cleanUpdates.paymentNotes,
      });
    }
    if (
      updates.registrationStatus !== undefined &&
      updates.registrationStatus !== existingReg.registrationStatus
    ) {
      cleanUpdates.registrationStatus = updates.registrationStatus;
      changedFields.push({
        field: 'registrationStatus',
        oldValue: existingReg.registrationStatus,
        newValue: updates.registrationStatus,
      });
    }

    if (changedFields.length === 0) return;

    const batch = writeBatch(db);
    batch.update(doc(db, 'registrations', existingReg.registrationId), {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
    });

    // Keep public lookup locks synced (only allowed fields)
    const lockPatch = {
      displayName: cleanUpdates.fullName ?? existingReg.fullName,
      size: cleanUpdates.size ?? existingReg.size,
      nickname: cleanUpdates.nickname ?? existingReg.nickname,
      paymentSelection: cleanUpdates.paymentSelection ?? existingReg.paymentSelection,
      paymentVerificationStatus:
        cleanUpdates.paymentVerificationStatus ?? existingReg.paymentVerificationStatus,
    };

    const idLockRef = doc(
      db,
      'registrationLocks',
      `${existingReg.contractId}_${existingReg.identificationHash}`
    );
    const codeLockRef = doc(
      db,
      'registrationLocks',
      `${existingReg.contractId}_${existingReg.registrationCode}`
    );
    const [idLockSnap, codeLockSnap] = await Promise.all([getDoc(idLockRef), getDoc(codeLockRef)]);
    if (idLockSnap.exists()) batch.update(idLockRef, lockPatch);
    if (codeLockSnap.exists()) batch.update(codeLockRef, lockPatch);

    // Enqueue sync job on registration edit
    const jobId = generateEntityId('job');
    batch.set(doc(db, 'syncJobs', jobId), {
      jobId,
      contractId: existingReg.contractId,
      registrationId: existingReg.registrationId,
      destination: 'google_sheets',
      status: 'pending',
      attempts: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'EDITAR_PARTICIPANTE',
      entityType: 'registration',
      entityId: existingReg.registrationId,
      changedFields,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRegistrationAdmin(
  reg: Registration,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const path = `registrations/${reg.registrationId}`;
  try {
    await deleteDoc(doc(db, 'registrations', reg.registrationId));
    try {
      await deleteDoc(doc(db, 'registrationLocks', `${reg.contractId}_${reg.identificationHash}`));
      await deleteDoc(doc(db, 'registrationLocks', `${reg.contractId}_${reg.registrationCode}`));
    } catch {
      // Lock may not exist on legacy imports
    }

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'ELIMINAR_PARTICIPANTE',
      entityType: 'registration',
      entityId: reg.registrationId,
      changedFields: [
        { field: 'fullName', oldValue: reg.fullName, newValue: 'deleted' },
        { field: 'size', oldValue: reg.size, newValue: 'deleted' },
      ],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface ImportRowCandidate {
  fullName: string;
  identificationNumber: string;
  size: string;
  nickname: string;
  phone: string;
  instagram: string;
  paymentSelection: PaymentSelection;
}

export interface ImportReport {
  imported: number;
  duplicates: number;
  rejected: number;
  errors: string[];
}

export async function bulkImportRegistrationsAdmin(
  contract: Contract,
  rows: ImportRowCandidate[],
  existingHashes: Set<string>,
  adminUser: { uid: string; email: string }
): Promise<ImportReport> {
  const report: ImportReport = { imported: 0, duplicates: 0, rejected: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idDisplay = normalizeIdentificationDisplay(row.identificationNumber);
    const phone = normalizePhone(row.phone);

    if (!row.fullName.trim() || idDisplay.length < 3 || !row.size.trim() || phone.length < 5) {
      report.rejected++;
      report.errors.push(`Fila ${i + 1}: Campos obligatorios incompletos.`);
      continue;
    }

    const idHash = await computeIdentificationHash(contract.contractId, idDisplay);
    if (existingHashes.has(idHash)) {
      report.duplicates++;
      continue;
    }

    const registrationId = generateEntityId('reg');
    const registrationCode = generateRegistrationCode('MF');
    const idLockKey = `${contract.contractId}_${idHash}`;
    const codeLockKey = `${contract.contractId}_${registrationCode}`;

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'registrations', registrationId), {
        registrationId,
        registrationCode,
        contractId: contract.contractId,
        publicToken: contract.publicToken,
        fullName: row.fullName.trim(),
        identificationNumber: idDisplay,
        identificationHash: idHash,
        size: row.size.trim().toUpperCase(),
        nickname: normalizeNickname(row.nickname || '', 60),
        phone,
        instagram: normalizeInstagram(row.instagram || ''),
        paymentSelection:
          row.paymentSelection === 'PAGO PARCIAL' ? 'PAGO PARCIAL' : 'PAGO COMPLETO',
        paymentVerificationStatus: 'pending',
        customFields: {},
        privacyAccepted: true,
        registrationTimestamp: serverTimestamp(),
        registrationStatus: 'confirmed',
        registrationMode: 'bulk',
        source: 'excel_import',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const lockData = {
        contractId: contract.contractId,
        identificationHash: idHash,
        registrationId,
        registrationCode,
        maskedId: maskIdentification(idDisplay),
        displayName: row.fullName.trim(),
        size: row.size.trim().toUpperCase(),
        nickname: normalizeNickname(row.nickname || '', 60),
        paymentSelection:
          row.paymentSelection === 'PAGO PARCIAL' ? 'PAGO PARCIAL' : 'PAGO COMPLETO',
        paymentVerificationStatus: 'pending',
        createdAt: serverTimestamp(),
      };

      batch.set(doc(db, 'registrationLocks', idLockKey), lockData);
      batch.set(doc(db, 'registrationLocks', codeLockKey), lockData);
      await batch.commit();

      existingHashes.add(idHash);
      report.imported++;
    } catch (err: any) {
      report.rejected++;
      report.errors.push(`Fila ${i + 1}: ${err?.message || 'Error al guardar'}`);
    }
  }

  await recordAuditLog({
    userId: adminUser.uid,
    userEmail: adminUser.email,
    action: 'IMPORTAR_PARTICIPANTES',
    entityType: 'import',
    entityId: contract.contractId,
    changedFields: [
      { field: 'imported', oldValue: '0', newValue: String(report.imported) },
      { field: 'duplicates', oldValue: '0', newValue: String(report.duplicates) },
      { field: 'rejected', oldValue: '0', newValue: String(report.rejected) },
    ],
  });

  return report;
}
