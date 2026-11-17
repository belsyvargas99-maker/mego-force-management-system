import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, getGoogleAccessToken, getSheetsRequestHeaders } from '../config/firebase';
import type { Contract, Registration, SyncJob, SyncJobStatus } from '../types/mego';
import { generateEntityId } from '../utils/normalizers';
import { recordAuditLog } from './auditService';
import { updateContract } from './contractsService';
import { handleFirestoreError, OperationType } from './firestoreErrors';

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export function subscribeSyncJobs(callback: (jobs: SyncJob[]) => void): () => void {
  const path = 'syncJobs';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => {
      callback(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            jobId: data.jobId || d.id,
            contractId: data.contractId || '',
            registrationId: data.registrationId || '',
            destination: 'google_sheets',
            status: (data.status as SyncJobStatus) || 'pending',
            attempts: typeof data.attempts === 'number' ? data.attempts : 0,
            lastAttemptAt: data.lastAttemptAt ? toIso(data.lastAttemptAt) : undefined,
            errorMessage: data.errorMessage || '',
            createdAt: toIso(data.createdAt),
            updatedAt: toIso(data.updatedAt),
          };
        })
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createSpreadsheetForContract(
  contract: Contract,
  adminUser: { uid: string; email: string }
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = getGoogleAccessToken();
  if (!token) {
    throw new Error(
      'Debes autorizar Google Sheets iniciando sesión nuevamente con tu cuenta Google.'
    );
  }

  const res = await fetch('/api/sheets/create-spreadsheet', {
    method: 'POST',
    headers: await getSheetsRequestHeaders(token),
    body: JSON.stringify({
      contractTitle: contract.title,
      contractCode: contract.contractCode,
      availableSizes: contract.availableSizes,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'No se pudo crear la hoja de Google Sheets.');
  }

  await updateContract(
    contract.contractId,
    {
      sheetsConfig: {
        enabled: true,
        autoRetry: true,
        spreadsheetId: data.spreadsheetId,
        spreadsheetUrl: data.spreadsheetUrl,
        lastSyncStatus: 'pending',
      },
    },
    adminUser
  );

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

export async function syncContractToGoogleSheets(
  contract: Contract,
  registrations: Registration[],
  adminUser: { uid: string; email: string },
  existingJob?: SyncJob
): Promise<{ synced: boolean; totalRows?: number; errorMessage?: string }> {
  const spreadsheetId = contract.sheetsConfig?.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Este contrato aún no tiene una hoja de cálculo de Google Sheets vinculada.');
  }

  const jobId = existingJob?.jobId || generateEntityId('job');
  const nextAttempt = (existingJob?.attempts || 0) + 1;
  const token = getGoogleAccessToken();

  // Upsert / mark job as retrying
  const jobRef = doc(db, 'syncJobs', jobId);
  if (!existingJob) {
    await setDoc(jobRef, {
      jobId,
      contractId: contract.contractId,
      destination: 'google_sheets',
      status: 'retrying',
      attempts: nextAttempt,
      lastAttemptAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(jobRef, {
      status: 'retrying',
      attempts: nextAttempt,
      lastAttemptAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (!token) {
    const errMsg =
      'Token OAuth de Google Sheets no disponible en esta sesión. Reconecta con Google para sincronizar.';
    await updateDoc(jobRef, {
      status: 'error',
      errorMessage: errMsg,
      updatedAt: serverTimestamp(),
    });
    await updateContract(
      contract.contractId,
      {
        sheetsConfig: {
          ...(contract.sheetsConfig || { enabled: true, autoRetry: true }),
          lastSyncStatus: 'error',
          lastError: errMsg,
        },
      },
      adminUser
    );
    return { synced: false, errorMessage: errMsg };
  }

  try {
    const res = await fetch('/api/sheets/sync-contract', {
      method: 'POST',
      headers: await getSheetsRequestHeaders(token),
      body: JSON.stringify({
        spreadsheetId,
        contractTitle: contract.title,
        contractCode: contract.contractCode,
        availableSizes: contract.availableSizes,
        registrations,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error || 'Google Sheets API devolvió un error.');
    }

    const syncedAt = json.syncedAt || new Date().toISOString();
    await updateDoc(jobRef, {
      status: 'synced',
      errorMessage: '',
      updatedAt: serverTimestamp(),
    });

    await updateContract(
      contract.contractId,
      {
        sheetsConfig: {
          ...(contract.sheetsConfig || { enabled: true, autoRetry: true }),
          enabled: true,
          lastSyncAt: syncedAt,
          lastSyncStatus: 'synced',
          lastError: '',
        },
      },
      adminUser
    );

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'SINCRONIZAR_GOOGLE_SHEETS',
      entityType: 'sync',
      entityId: contract.contractId,
      changedFields: [{ field: 'syncedRows', oldValue: '0', newValue: String(json.totalRows || 0) }],
    });

    return { synced: true, totalRows: json.totalRows };
  } catch (err: any) {
    const errMsg = err?.message || 'Error al sincronizar con Google Sheets.';
    await updateDoc(jobRef, {
      status: 'error',
      errorMessage: errMsg.slice(0, 600),
      updatedAt: serverTimestamp(),
    });
    await updateContract(
      contract.contractId,
      {
        sheetsConfig: {
          ...(contract.sheetsConfig || { enabled: true, autoRetry: true }),
          lastSyncStatus: 'error',
          lastError: errMsg.slice(0, 300),
        },
      },
      adminUser
    );
    return { synced: false, errorMessage: errMsg };
  }
}
