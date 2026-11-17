import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { setDoc, updateDoc, writeBatch } from './firestoreSafe';
import { db } from '../config/firebase';
import type { BulkSubmissionRecord, PublicContract } from '../types/mego';
import type { BulkRowDraft } from '../utils/bulkValidation';
import { chunkItems } from '../utils/bulkValidation';
import {
  computeIdentificationHash,
  generateEntityId,
  generateRegistrationCode,
  maskIdentification,
  normalizeIdentificationKey,
} from '../utils/normalizers';
import { handleFirestoreError, OperationType } from './firestoreErrors';

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function detectExistingLocksForBulkRows(
  contractId: string,
  rows: readonly BulkRowDraft[]
): Promise<Set<string>> {
  const duplicateKeys = new Set<string>();
  const candidates = rows
    .map((r) => normalizeIdentificationKey(r.identificationNumber))
    .filter((k) => k.length >= 3);

  const uniqueKeys = Array.from(new Set(candidates));
  const chunks = chunkItems(uniqueKeys, 20);

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (idKey) => {
        try {
          const hash = await computeIdentificationHash(contractId, idKey);
          const snap = await getDoc(doc(db, 'registrationLocks', `${contractId}_${hash}`));
          if (snap.exists()) {
            duplicateKeys.add(idKey);
          }
        } catch {
          // ignore network check failure and rely on transaction/batch check
        }
      })
    );
  }

  return duplicateKeys;
}

export interface SubmitBulkInput {
  contract: PublicContract;
  bulkToken: string;
  representativeName: string;
  representativeContact: string;
  rows: BulkRowDraft[];
  idempotencyKey: string;
  onProgress?: (processed: number, total: number) => void;
}

export async function submitBulkOrganizationRegistrations(
  input: SubmitBulkInput
): Promise<BulkSubmissionRecord> {
  const { contract, bulkToken, representativeName, representativeContact, rows, idempotencyKey } =
    input;

  const submissionId = `${contract.contractId}_${idempotencyKey}`;
  const submissionRef = doc(db, 'bulkSubmissions', submissionId);

  let resumedCodes: string[] = [];
  let isRetryAfterPartialDrop = false;

  // 1. Idempotency guard: if already completed or partial, return stored receipt; if processing, resume cleanly
  try {
    const existingSnap = await getDoc(submissionRef);
    if (existingSnap.exists()) {
      const d = existingSnap.data();
      if (d.status === 'completed' || d.status === 'partial') {
        return {
          submissionId: d.submissionId,
          idempotencyKey: d.idempotencyKey,
          contractId: d.contractId,
          publicToken: d.publicToken,
          bulkToken: d.bulkToken,
          representativeName: d.representativeName,
          representativeContact: d.representativeContact || '',
          organizationName: d.organizationName,
          totalEntered: d.totalEntered,
          totalValid: d.totalValid,
          totalRejected: d.totalRejected,
          totalDuplicates: d.totalDuplicates || 0,
          totalSaved: d.totalSaved,
          pendingSyncCount: d.pendingSyncCount,
          registrationCodes: d.registrationCodes || [],
          rejectedReasons: d.rejectedReasons || [],
          status: d.status,
          createdAt: toIso(d.createdAt),
          updatedAt: toIso(d.updatedAt),
        };
      }
      if (d.status === 'processing') {
        isRetryAfterPartialDrop = true;
        resumedCodes = Array.isArray(d.registrationCodes) ? d.registrationCodes : [];
      }
    }
  } catch {
    // proceed to validation
  }

  // 2. Server-side validation, schedule window verification, token verification & SHA-256 hashing
  const valRes = await fetch('/api/public/validate-bulk-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractId: contract.contractId,
      publicToken: contract.publicToken,
      bulkToken,
      representativeName: representativeName.trim(),
      representativeContact: representativeContact.trim(),
      privacyAccepted: true,
      rows,
    }),
  });

  const valJson = await valRes.json();
  if (!valRes.ok) {
    throw new Error(
      valJson?.error || 'No se pudo validar el lote masivo en el servidor.'
    );
  }

  const serverValidRows = (valJson.validRows || []) as {
    rowId: string;
    rowIndex: number;
    fullName: string;
    identificationNumber: string;
    identificationKey: string;
    identificationHash: string;
    size: string;
    nickname: string;
    phone: string;
    instagram: string;
    paymentSelection: 'PAGO COMPLETO' | 'PAGO PARCIAL';
    garmentItems?: { garment: string; size: string; nickname?: string }[];
  }[];

  const serverErrorRows = (valJson.errorRows || []) as {
    rowId: string;
    rowIndex: number;
    isDuplicateInBatch?: boolean;
    errors: Record<string, string>;
  }[];

  let totalDuplicates = Number(valJson.duplicatesInBatch || 0);
  const rejectedReasons: string[] = serverErrorRows.map(
    (e) => `Fila ${e.rowIndex + 1}: ${Object.values(e.errors).join(', ')}`
  );

  // 3. Filter out cédulas already locked in Firestore for this contract (and recognize already-saved rows from an interrupted retry)
  const toSave: typeof serverValidRows = [];
  const existingChunks = chunkItems(serverValidRows, 25);
  let alreadySavedOnThisSession = 0;

  for (const checkChunk of existingChunks) {
    await Promise.all(
      checkChunk.map(async (row) => {
        const lockSnap = await getDoc(
          doc(db, 'registrationLocks', `${contract.contractId}_${row.identificationHash}`)
        );
        if (lockSnap.exists()) {
          const lockCode = String(lockSnap.data()?.registrationCode || '');
          if (isRetryAfterPartialDrop && resumedCodes.includes(lockCode)) {
            alreadySavedOnThisSession++;
          } else {
            totalDuplicates++;
            rejectedReasons.push(
              `Fila ${row.rowIndex + 1} (${row.fullName}): Cédula ya registrada previamente en este contrato.`
            );
          }
        } else {
          toSave.push(row);
        }
      })
    );
  }

  if (toSave.length === 0 && alreadySavedOnThisSession === 0) {
    throw new Error(
      rejectedReasons[0] ||
        'Ninguna fila es válida o todas las cédulas ya estaban registradas en este contrato.'
    );
  }

  // 4. Create or reuse idempotent processing receipt
  if (!isRetryAfterPartialDrop) {
    await setDoc(submissionRef, {
      submissionId,
      idempotencyKey,
      contractId: contract.contractId,
      publicToken: contract.publicToken,
      bulkToken,
      representativeName: representativeName.trim(),
      representativeContact: representativeContact.trim(),
      organizationName: contract.organizationName,
      totalEntered: rows.length,
      totalValid: serverValidRows.length,
      totalRejected: rejectedReasons.length,
      totalDuplicates,
      totalSaved: 0,
      pendingSyncCount: 0,
      registrationCodes: [],
      rejectedReasons: rejectedReasons.slice(0, 200),
      status: 'processing',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 5. Write chunked batches (max 80 participants per batch -> <= 325 Firestore ops, safe < 500)
  const chunks = chunkItems(toSave, 80);
  const savedCodes: string[] = [...resumedCodes];
  let savedCount = alreadySavedOnThisSession;

  const pubRef = doc(db, 'publicContracts', contract.publicToken);

  for (const chunk of chunks) {
    const freshPub = await getDoc(pubRef);
    const currentTotal =
      freshPub.exists() && typeof freshPub.data().totalParticipants === 'number'
        ? freshPub.data().totalParticipants
        : contract.totalParticipants || 0;

    const batch = writeBatch(db);
    const chunkCodes: string[] = [];

    for (const item of chunk) {
      const registrationId = generateEntityId('reg');
      const registrationCode = generateRegistrationCode('MF');
      const jobId = generateEntityId('job');
      const idLockKey = `${contract.contractId}_${item.identificationHash}`;
      const codeLockKey = `${contract.contractId}_${registrationCode}`;

      batch.set(doc(db, 'registrations', registrationId), {
        registrationId,
        registrationCode,
        contractId: contract.contractId,
        publicToken: contract.publicToken,
        fullName: item.fullName,
        identificationNumber: item.identificationNumber,
        identificationHash: item.identificationHash,
        size: item.size,
        nickname: item.nickname,
        phone: item.phone,
        instagram: item.instagram,
        paymentSelection: item.paymentSelection,
        paymentVerificationStatus: 'pending',
        customFields: {},
        ...(item.garmentItems && item.garmentItems.length > 0
          ? { garmentItems: item.garmentItems }
          : {}),
        privacyAccepted: true,
        registrationTimestamp: serverTimestamp(),
        registrationStatus: 'confirmed',
        registrationMode: 'bulk',
        bulkSubmissionId: submissionId,
        representativeName: representativeName.trim(),
        source: 'bulk_representative',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const lockData = {
        contractId: contract.contractId,
        identificationHash: item.identificationHash,
        registrationId,
        registrationCode,
        maskedId: maskIdentification(item.identificationNumber),
        displayName: item.fullName,
        size: item.size,
        nickname: item.nickname,
        paymentSelection: item.paymentSelection,
        paymentVerificationStatus: 'pending',
        createdAt: serverTimestamp(),
      };

      batch.set(doc(db, 'registrationLocks', idLockKey), lockData);
      batch.set(doc(db, 'registrationLocks', codeLockKey), lockData);

      batch.set(doc(db, 'syncJobs', jobId), {
        jobId,
        contractId: contract.contractId,
        registrationId,
        destination: 'google_sheets',
        status: 'pending',
        attempts: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      chunkCodes.push(registrationCode);
    }

    batch.update(pubRef, {
      totalParticipants: currentTotal + chunk.length,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    savedCodes.push(...chunkCodes);
    savedCount += chunk.length;
    // Persist checkpoint after every chunk so network drops can resume seamlessly without duplicating
    await updateDoc(submissionRef, {
      totalSaved: savedCount,
      registrationCodes: savedCodes.slice(0, 500),
      updatedAt: serverTimestamp(),
    });
    input.onProgress?.(savedCount, toSave.length + alreadySavedOnThisSession);
  }

  const finalStatus: BulkSubmissionRecord['status'] =
    rejectedReasons.length > 0 ? 'partial' : 'completed';

  await updateDoc(submissionRef, {
    totalSaved: savedCount,
    totalRejected: rejectedReasons.length,
    totalDuplicates,
    pendingSyncCount: savedCount,
    registrationCodes: savedCodes.slice(0, 500),
    rejectedReasons: rejectedReasons.slice(0, 200),
    status: finalStatus,
    updatedAt: serverTimestamp(),
  });

  const now = new Date().toISOString();
  return {
    submissionId,
    idempotencyKey,
    contractId: contract.contractId,
    publicToken: contract.publicToken,
    bulkToken,
    representativeName: representativeName.trim(),
    representativeContact: representativeContact.trim(),
    organizationName: contract.organizationName,
    totalEntered: rows.length,
    totalValid: serverValidRows.length,
    totalRejected: rejectedReasons.length,
    totalDuplicates,
    totalSaved: savedCount,
    pendingSyncCount: savedCount,
    registrationCodes: savedCodes,
    rejectedReasons,
    status: finalStatus,
    createdAt: now,
    updatedAt: now,
  };
}

export function subscribeBulkSubmissions(
  callback: (records: BulkSubmissionRecord[]) => void
): () => void {
  const path = 'bulkSubmissions';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      callback(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            submissionId: data.submissionId || d.id,
            idempotencyKey: data.idempotencyKey || '',
            contractId: data.contractId || '',
            publicToken: data.publicToken || '',
            bulkToken: data.bulkToken || '',
            representativeName: data.representativeName || '',
            representativeContact: data.representativeContact || '',
            organizationName: data.organizationName || '',
            totalEntered: data.totalEntered || 0,
            totalValid: data.totalValid || 0,
            totalRejected: data.totalRejected || 0,
            totalDuplicates: data.totalDuplicates || 0,
            totalSaved: data.totalSaved || 0,
            pendingSyncCount: data.pendingSyncCount || 0,
            registrationCodes: Array.isArray(data.registrationCodes) ? data.registrationCodes : [],
            rejectedReasons: Array.isArray(data.rejectedReasons) ? data.rejectedReasons : [],
            status: data.status || 'completed',
            createdAt: toIso(data.createdAt),
            updatedAt: toIso(data.updatedAt),
          };
        })
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}
