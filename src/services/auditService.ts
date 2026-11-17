import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { setDoc } from './firestoreSafe';
import { db } from '../config/firebase';
import type { AuditChange, AuditLog } from '../types/mego';
import { generateEntityId } from '../utils/normalizers';
import { handleFirestoreError, OperationType } from './firestoreErrors';

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function recordAuditLog(params: {
  userId: string;
  userEmail: string;
  action: string;
  entityType: AuditLog['entityType'];
  entityId: string;
  changedFields: AuditChange[];
}): Promise<void> {
  const logId = generateEntityId('log');
  const path = `auditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      logId,
      userId: params.userId,
      userEmail: params.userEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      changedFields: params.changedFields.slice(0, 50),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeAuditLogs(
  callback: (logs: AuditLog[]) => void,
  entityId?: string
): () => void {
  const path = 'auditLogs';
  const q = entityId
    ? query(collection(db, path), where('entityId', '==', entityId), limit(150))
    : query(collection(db, path), orderBy('createdAt', 'desc'), limit(150));

  return onSnapshot(
    q,
    (snap) => {
      const items: AuditLog[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            logId: data.logId || d.id,
            userId: data.userId || '',
            userEmail: data.userEmail || '',
            action: data.action || '',
            entityType: data.entityType || 'contract',
            entityId: data.entityId || '',
            changedFields: Array.isArray(data.changedFields) ? data.changedFields : [],
            createdAt: toIso(data.createdAt),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100);
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}
