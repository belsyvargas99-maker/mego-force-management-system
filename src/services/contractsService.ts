import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { writeBatch } from './firestoreSafe';
import { db, getAdminAuthHeaders } from '../config/firebase';
import type {
  Contract,
  ContractStatus,
  PublicContract,
  ScheduleChangeEntry,
} from '../types/mego';
import { createDefaultFormConfig, DEFAULT_AVAILABLE_SIZES } from '../utils/defaultForm';
import { generateEntityId, generatePublicToken } from '../utils/normalizers';
import { buildDuplicatedContractDraft } from '../utils/sizeEngine';
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

function mapDocToContract(id: string, data: Record<string, any>): Contract {
  return {
    contractId: data.contractId || id,
    contractCode: data.contractCode || '',
    organizationName: data.organizationName || '',
    title: data.title || '',
    description: data.description || '',
    garmentType: data.garmentType || '',
    garmentFeatures: Array.isArray(data.garmentFeatures) ? data.garmentFeatures : [],
    status: (data.status as ContractStatus) || 'draft',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    openDate: data.openDate || '',
    openTime: data.openTime || '00:00',
    closeDate: data.closeDate || '',
    closeTime: data.closeTime || '23:59',
    timezone: data.timezone || 'America/Caracas',
    closedMessage: data.closedMessage || '',
    closedAt: data.closedAt || '',
    closeReason: data.closeReason || '',
    scheduleHistory: Array.isArray(data.scheduleHistory) ? data.scheduleHistory : [],
    bulkRegistrationEnabled: Boolean(data.bulkRegistrationEnabled),
    individualRegistrationEnabled:
      data.individualRegistrationEnabled === undefined
        ? true
        : Boolean(data.individualRegistrationEnabled),
    individualLinkExpiresAt: data.individualLinkExpiresAt || '',
    bulkLinkExpiresAt: data.bulkLinkExpiresAt || '',
    currency: data.currency || 'USD',
    unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : undefined,
    additionalGarments: Array.isArray(data.additionalGarments) ? data.additionalGarments : [],
    bulkToken: data.bulkToken || '',
    publicToken: data.publicToken || '',
    availableSizes: Array.isArray(data.availableSizes)
      ? data.availableSizes
      : [...DEFAULT_AVAILABLE_SIZES],
    mockupImages: Array.isArray(data.mockupImages) ? data.mockupImages : [],
    formConfig: data.formConfig || createDefaultFormConfig(),
    sheetsConfig: data.sheetsConfig || { enabled: false, autoRetry: true },
    totalParticipants: typeof data.totalParticipants === 'number' ? data.totalParticipants : 0,
    sizeCounts: data.sizeCounts || {},
    createdBy: data.createdBy || '',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

function buildPublicProjection(
  contract: Omit<Contract, 'createdAt' | 'updatedAt' | 'createdBy'>
) {
  return {
    publicToken: contract.publicToken,
    contractId: contract.contractId,
    contractCode: contract.contractCode,
    organizationName: contract.organizationName,
    title: contract.title,
    description: contract.description || '',
    garmentType: contract.garmentType,
    garmentFeatures: contract.garmentFeatures || [],
    status: contract.status,
    startDate: contract.startDate || '',
    endDate: contract.endDate || '',
    openDate: contract.openDate || '',
    openTime: contract.openTime || '00:00',
    closeDate: contract.closeDate || '',
    closeTime: contract.closeTime || '23:59',
    timezone: contract.timezone || 'America/Caracas',
    closedMessage: contract.closedMessage || '',
    bulkRegistrationEnabled: Boolean(contract.bulkRegistrationEnabled),
    individualRegistrationEnabled:
      contract.individualRegistrationEnabled === undefined
        ? true
        : Boolean(contract.individualRegistrationEnabled),
    individualLinkExpiresAt: contract.individualLinkExpiresAt || '',
    bulkLinkExpiresAt: contract.bulkLinkExpiresAt || '',
    currency: contract.currency || 'USD',
    ...(typeof contract.unitPrice === 'number' ? { unitPrice: contract.unitPrice } : {}),
    additionalGarments: contract.additionalGarments || [],
    bulkToken: contract.bulkToken || '',
    availableSizes: contract.availableSizes,
    mockupImages: contract.mockupImages,
    formConfig: contract.formConfig,
    totalParticipants: contract.totalParticipants || 0,
    sizeCounts: contract.sizeCounts || {},
    updatedAt: serverTimestamp(),
  };
}

export function subscribeContracts(callback: (contracts: Contract[]) => void): () => void {
  const path = 'contracts';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      callback(snap.docs.map((d) => mapDocToContract(d.id, d.data())));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeContractById(
  contractId: string,
  callback: (contract: Contract | null) => void
): () => void {
  const path = `contracts/${contractId}`;
  return onSnapshot(
    doc(db, 'contracts', contractId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(mapDocToContract(snap.id, snap.data()));
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function getContractById(contractId: string): Promise<Contract | null> {
  const path = `contracts/${contractId}`;
  try {
    const snap = await getDoc(doc(db, 'contracts', contractId));
    if (!snap.exists()) return null;
    return mapDocToContract(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getPublicContractByToken(
  publicToken: string
): Promise<PublicContract | null> {
  const cleanToken = publicToken.trim();
  if (!/^[a-zA-Z0-9_\-]{8,64}$/.test(cleanToken)) {
    return null;
  }
  const path = `publicContracts/${cleanToken}`;
  try {
    const snap = await getDoc(doc(db, 'publicContracts', cleanToken));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      publicToken: data.publicToken || cleanToken,
      contractId: data.contractId || '',
      contractCode: data.contractCode || '',
      organizationName: data.organizationName || '',
      title: data.title || '',
      description: data.description || '',
      garmentType: data.garmentType || '',
      garmentFeatures: Array.isArray(data.garmentFeatures) ? data.garmentFeatures : [],
      status: (data.status as ContractStatus) || 'draft',
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      openDate: data.openDate || '',
      openTime: data.openTime || '00:00',
      closeDate: data.closeDate || '',
      closeTime: data.closeTime || '23:59',
      timezone: data.timezone || 'America/Caracas',
      closedMessage: data.closedMessage || '',
      bulkRegistrationEnabled: Boolean(data.bulkRegistrationEnabled),
      individualRegistrationEnabled:
        data.individualRegistrationEnabled === undefined
          ? true
          : Boolean(data.individualRegistrationEnabled),
      individualLinkExpiresAt: data.individualLinkExpiresAt || '',
      bulkLinkExpiresAt: data.bulkLinkExpiresAt || '',
      currency: data.currency || 'USD',
      unitPrice: typeof data.unitPrice === 'number' ? data.unitPrice : undefined,
      additionalGarments: Array.isArray(data.additionalGarments) ? data.additionalGarments : [],
      bulkToken: data.bulkToken || '',
      availableSizes: Array.isArray(data.availableSizes)
        ? data.availableSizes
        : [...DEFAULT_AVAILABLE_SIZES],
      mockupImages: Array.isArray(data.mockupImages) ? data.mockupImages : [],
      formConfig: data.formConfig || createDefaultFormConfig(),
      totalParticipants: typeof data.totalParticipants === 'number' ? data.totalParticipants : 0,
      sizeCounts: data.sizeCounts || {},
      updatedAt: toIso(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getPublicContractByBulkToken(
  bulkToken: string
): Promise<PublicContract | null> {
  const clean = bulkToken.trim();
  if (!/^[a-zA-Z0-9_\-]{8,64}$/.test(clean)) {
    return null;
  }
  const linkPath = `publicBulkContracts/${clean}`;
  try {
    const linkSnap = await getDoc(doc(db, 'publicBulkContracts', clean));
    if (!linkSnap.exists()) return null;
    const linkData = linkSnap.data();
    if (!linkData.enabled || !linkData.publicToken) {
      return null;
    }
    return getPublicContractByToken(linkData.publicToken);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, linkPath);
  }
}

export async function createContract(
  input: Omit<
    Contract,
    'contractId' | 'publicToken' | 'totalParticipants' | 'createdBy' | 'createdAt' | 'updatedAt'
  >,
  adminUser: { uid: string; email: string }
): Promise<Contract> {
  const contractId = generateEntityId('ctr');
  const publicToken = generatePublicToken(12);
  const bulkToken = input.bulkToken || generatePublicToken(14);
  const path = `contracts/${contractId}`;

  const initialHistory: ScheduleChangeEntry[] =
    input.openDate || input.closeDate
      ? [
          {
            changedAt: new Date().toISOString(),
            changedBy: adminUser.email,
            action: 'scheduled',
            previousStatus: 'draft',
            newStatus: input.status,
            newWindow: `${input.openDate || 'Inmediato'} ${input.openTime || '00:00'} → ${
              input.closeDate || 'Sin límite'
            } ${input.closeTime || '23:59'} (${input.timezone || 'America/Caracas'})`,
            reason: 'Programación inicial del contrato',
          },
        ]
      : [];

  const basePayload = {
    contractId,
    contractCode: input.contractCode.trim().toUpperCase(),
    organizationName: input.organizationName.trim(),
    title: input.title.trim(),
    description: (input.description || '').trim(),
    garmentType: input.garmentType.trim(),
    garmentFeatures: input.garmentFeatures || [],
    status: input.status,
    startDate: input.startDate || input.openDate || '',
    endDate: input.endDate || input.closeDate || '',
    openDate: input.openDate || '',
    openTime: input.openTime || '00:00',
    closeDate: input.closeDate || '',
    closeTime: input.closeTime || '23:59',
    timezone: input.timezone || 'America/Caracas',
    closedMessage: (input.closedMessage || '').trim(),
    closedAt: '',
    closeReason: '',
    scheduleHistory: initialHistory,
    bulkRegistrationEnabled: Boolean(input.bulkRegistrationEnabled),
    individualRegistrationEnabled:
      input.individualRegistrationEnabled === undefined
        ? true
        : Boolean(input.individualRegistrationEnabled),
    individualLinkExpiresAt: input.individualLinkExpiresAt || '',
    bulkLinkExpiresAt: input.bulkLinkExpiresAt || '',
    currency: input.currency || 'USD',
    ...(typeof input.unitPrice === 'number' ? { unitPrice: input.unitPrice } : {}),
    additionalGarments: Array.isArray(input.additionalGarments) ? input.additionalGarments : [],
    bulkToken,
    publicToken,
    availableSizes:
      input.availableSizes && input.availableSizes.length > 0
        ? input.availableSizes
        : [...DEFAULT_AVAILABLE_SIZES],
    mockupImages: input.mockupImages || [],
    formConfig: input.formConfig || createDefaultFormConfig(),
    sheetsConfig: input.sheetsConfig || { enabled: false, autoRetry: true },
    totalParticipants: 0,
    sizeCounts: {},
    createdBy: adminUser.uid,
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'contracts', contractId), {
      ...basePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'publicContracts', publicToken), buildPublicProjection(basePayload));
    batch.set(doc(db, 'publicBulkContracts', bulkToken), {
      bulkToken,
      publicToken,
      contractId,
      enabled: Boolean(basePayload.bulkRegistrationEnabled),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'CREAR_CONTRATO',
      entityType: 'contract',
      entityId: contractId,
      changedFields: [
        { field: 'title', oldValue: '', newValue: basePayload.title },
        { field: 'contractCode', oldValue: '', newValue: basePayload.contractCode },
      ],
    });

    const now = new Date().toISOString();
    return { ...basePayload, createdAt: now, updatedAt: now };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateContract(
  contractId: string,
  updates: Partial<Omit<Contract, 'contractId' | 'createdBy' | 'createdAt' | 'updatedAt'>>,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const path = `contracts/${contractId}`;
  try {
    const current = await getContractById(contractId);
    if (!current) {
      throw new Error('Contrato no encontrado.');
    }

    const bulkToken = updates.bulkToken ?? current.bulkToken ?? generatePublicToken(14);
    const bulkEnabled =
      updates.bulkRegistrationEnabled ?? current.bulkRegistrationEnabled ?? false;

    const merged = {
      contractId: current.contractId,
      contractCode: (updates.contractCode ?? current.contractCode).trim(),
      organizationName: (updates.organizationName ?? current.organizationName).trim(),
      title: (updates.title ?? current.title).trim(),
      description: (updates.description ?? current.description).trim(),
      garmentType: (updates.garmentType ?? current.garmentType).trim(),
      garmentFeatures: updates.garmentFeatures ?? current.garmentFeatures,
      status: updates.status ?? current.status,
      startDate: updates.startDate ?? current.startDate ?? '',
      endDate: updates.endDate ?? current.endDate ?? '',
      openDate: updates.openDate ?? current.openDate ?? '',
      openTime: updates.openTime ?? current.openTime ?? '00:00',
      closeDate: updates.closeDate ?? current.closeDate ?? '',
      closeTime: updates.closeTime ?? current.closeTime ?? '23:59',
      timezone: updates.timezone ?? current.timezone ?? 'America/Caracas',
      closedMessage: updates.closedMessage ?? current.closedMessage ?? '',
      closedAt: updates.closedAt ?? current.closedAt ?? '',
      closeReason: updates.closeReason ?? current.closeReason ?? '',
      scheduleHistory: (updates.scheduleHistory ?? current.scheduleHistory ?? []).slice(-40),
      bulkRegistrationEnabled: bulkEnabled,
      individualRegistrationEnabled:
        updates.individualRegistrationEnabled ??
        (current.individualRegistrationEnabled === undefined
          ? true
          : current.individualRegistrationEnabled),
      individualLinkExpiresAt:
        updates.individualLinkExpiresAt ?? current.individualLinkExpiresAt ?? '',
      bulkLinkExpiresAt: updates.bulkLinkExpiresAt ?? current.bulkLinkExpiresAt ?? '',
      currency: updates.currency ?? current.currency ?? 'USD',
      ...(typeof (updates.unitPrice ?? current.unitPrice) === 'number'
        ? { unitPrice: updates.unitPrice ?? current.unitPrice }
        : {}),
      additionalGarments: updates.additionalGarments ?? current.additionalGarments ?? [],
      bulkToken,
      publicToken: updates.publicToken ?? current.publicToken,
      availableSizes: updates.availableSizes ?? current.availableSizes,
      mockupImages: updates.mockupImages ?? current.mockupImages,
      formConfig: updates.formConfig ?? current.formConfig,
      sheetsConfig:
        updates.sheetsConfig ?? current.sheetsConfig ?? { enabled: false, autoRetry: true },
      totalParticipants: updates.totalParticipants ?? current.totalParticipants,
      sizeCounts: updates.sizeCounts ?? current.sizeCounts ?? {},
    };

    const batch = writeBatch(db);
    batch.update(doc(db, 'contracts', contractId), {
      ...merged,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'publicContracts', merged.publicToken), buildPublicProjection(merged));
    if (bulkToken) {
      batch.set(doc(db, 'publicBulkContracts', bulkToken), {
        bulkToken,
        publicToken: merged.publicToken,
        contractId: merged.contractId,
        enabled: Boolean(bulkEnabled),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'ACTUALIZAR_CONTRATO',
      entityType: 'contract',
      entityId: contractId,
      changedFields: Object.keys(updates).map((k) => ({
        field: k,
        oldValue: JSON.stringify((current as any)[k] ?? '').slice(0, 120),
        newValue: JSON.stringify((updates as any)[k] ?? '').slice(0, 120),
      })),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Cryptographically regenerates or revokes an individual or bulk registration link.
 * Deletes the superseded public lookup projection so revoked tokens stop working immediately.
 */
export async function rotateOrRevokeContractLink(
  contract: Contract,
  mode: 'individual' | 'bulk',
  action: 'regenerate' | 'revoke',
  adminUser: { uid: string; email: string }
): Promise<{ nextToken: string }> {
  const path = `contracts/${contract.contractId}`;
  try {
    const newToken = generatePublicToken(mode === 'bulk' ? 16 : 14);
    const batch = writeBatch(db);

    if (mode === 'individual') {
      const oldPublicToken = contract.publicToken;
      const nextEnabled = action === 'revoke' ? false : contract.individualRegistrationEnabled ?? true;
      const updatedContractPayload = {
        ...contract,
        publicToken: newToken,
        individualRegistrationEnabled: nextEnabled,
      };
      batch.update(doc(db, 'contracts', contract.contractId), {
        publicToken: newToken,
        individualRegistrationEnabled: nextEnabled,
        updatedAt: serverTimestamp(),
      });
      if (oldPublicToken) {
        batch.delete(doc(db, 'publicContracts', oldPublicToken));
      }
      batch.set(doc(db, 'publicContracts', newToken), buildPublicProjection(updatedContractPayload));
      if (contract.bulkToken) {
        batch.set(doc(db, 'publicBulkContracts', contract.bulkToken), {
          bulkToken: contract.bulkToken,
          publicToken: newToken,
          contractId: contract.contractId,
          enabled: Boolean(contract.bulkRegistrationEnabled),
          updatedAt: serverTimestamp(),
        });
      }
    } else {
      const oldBulkToken = contract.bulkToken;
      const nextBulkEnabled = action === 'revoke' ? false : contract.bulkRegistrationEnabled ?? true;
      batch.update(doc(db, 'contracts', contract.contractId), {
        bulkToken: newToken,
        bulkRegistrationEnabled: nextBulkEnabled,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'publicContracts', contract.publicToken), {
        bulkToken: newToken,
        bulkRegistrationEnabled: nextBulkEnabled,
        updatedAt: serverTimestamp(),
      });
      if (oldBulkToken) {
        batch.delete(doc(db, 'publicBulkContracts', oldBulkToken));
      }
      batch.set(doc(db, 'publicBulkContracts', newToken), {
        bulkToken: newToken,
        publicToken: contract.publicToken,
        contractId: contract.contractId,
        enabled: Boolean(nextBulkEnabled),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: `${action === 'revoke' ? 'REVOCAR' : 'REGENERAR'}_ENLACE_${mode.toUpperCase()}`,
      entityType: 'contract',
      entityId: contract.contractId,
      changedFields: [
        {
          field: mode === 'individual' ? 'publicToken' : 'bulkToken',
          oldValue: (mode === 'individual' ? contract.publicToken : contract.bulkToken || '').slice(0, 12),
          newValue: newToken.slice(0, 12),
        },
      ],
    });

    return { nextToken: newToken };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reopenOrExtendContractSchedule(
  contract: Contract,
  params: {
    status: ContractStatus;
    openDate?: string;
    openTime?: string;
    closeDate?: string;
    closeTime?: string;
    timezone?: string;
    closedMessage?: string;
    action: ScheduleChangeEntry['action'];
    reason: string;
  },
  adminUser: { uid: string; email: string }
): Promise<void> {
  const prevWindow = `${contract.openDate || 'Inmediato'} ${contract.openTime || '00:00'} → ${
    contract.closeDate || 'Sin cierre'
  } ${contract.closeTime || '23:59'}`;
  const nextOpenDate = params.openDate ?? contract.openDate ?? '';
  const nextOpenTime = params.openTime ?? contract.openTime ?? '00:00';
  const nextCloseDate = params.closeDate ?? contract.closeDate ?? '';
  const nextCloseTime = params.closeTime ?? contract.closeTime ?? '23:59';
  const nextTz = params.timezone ?? contract.timezone ?? 'America/Caracas';
  const nextWindow = `${nextOpenDate || 'Inmediato'} ${nextOpenTime} → ${
    nextCloseDate || 'Sin cierre'
  } ${nextCloseTime} (${nextTz})`;

  const entry: ScheduleChangeEntry = {
    changedAt: new Date().toISOString(),
    changedBy: adminUser.email,
    action: params.action,
    previousStatus: contract.status,
    newStatus: params.status,
    previousWindow: prevWindow,
    newWindow: nextWindow,
    reason: params.reason.trim() || 'Actualización administrativa de calendario',
  };

  const nextHistory = [...(contract.scheduleHistory || []), entry].slice(-40);
  const isClosing = params.status === 'closed' || params.status === 'auto_closed';

  await updateContract(
    contract.contractId,
    {
      status: params.status,
      openDate: nextOpenDate,
      openTime: nextOpenTime,
      closeDate: nextCloseDate,
      closeTime: nextCloseTime,
      timezone: nextTz,
      closedMessage: params.closedMessage ?? contract.closedMessage ?? '',
      closedAt: isClosing ? new Date().toISOString() : '',
      closeReason: isClosing ? entry.reason : '',
      scheduleHistory: nextHistory,
    },
    adminUser
  );

  await recordAuditLog({
    userId: adminUser.uid,
    userEmail: adminUser.email,
    action: `CALENDARIO_${params.action.toUpperCase()}`,
    entityType: 'schedule',
    entityId: contract.contractId,
    changedFields: [
      { field: 'status', oldValue: contract.status, newValue: params.status },
      { field: 'window', oldValue: prevWindow, newValue: nextWindow },
      { field: 'reason', oldValue: '', newValue: entry.reason },
    ],
  });
}

export async function reconcileContractSchedulesAdmin(
  contracts: readonly Contract[],
  adminUser: { uid: string; email: string }
): Promise<number> {
  const candidates = contracts.filter(
    (c) => c.status === 'scheduled' || c.status === 'active'
  );
  if (candidates.length === 0) return 0;

  try {
    const authHeaders = await getAdminAuthHeaders();
    const res = await fetch('/api/contracts/reconcile-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        contracts: candidates.map((c) => ({
          contractId: c.contractId,
          status: c.status,
          openDate: c.openDate,
          openTime: c.openTime,
          closeDate: c.closeDate,
          closeTime: c.closeTime,
          timezone: c.timezone,
          closedMessage: c.closedMessage,
        })),
      }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const transitions = Array.isArray(data?.transitions) ? data.transitions : [];

    for (const tr of transitions) {
      const target = candidates.find((c) => c.contractId === tr.contractId);
      if (!target) continue;
      await reopenOrExtendContractSchedule(
        target,
        {
          status: tr.nextStatus,
          action: tr.nextStatus === 'auto_closed' ? 'auto_closed' : 'auto_opened',
          reason:
            tr.closeReason ||
            (tr.nextStatus === 'auto_closed'
              ? 'Cierre automático por vencimiento de fecha y hora programada'
              : 'Apertura automática por inicio de ventana programada'),
        },
        adminUser
      );
    }
    return transitions.length;
  } catch {
    return 0;
  }
}

export async function duplicateContract(
  source: Contract,
  adminUser: { uid: string; email: string }
): Promise<Contract> {
  const newId = generateEntityId('ctr');
  const newToken = generatePublicToken(12);
  const newBulkToken = generatePublicToken(14);
  const nowIso = new Date().toISOString();
  const draft = buildDuplicatedContractDraft(source, newId, newToken, adminUser.uid, nowIso);
  draft.bulkToken = newBulkToken;
  const path = `contracts/${newId}`;

  try {
    const batch = writeBatch(db);
    const { createdAt: _c, updatedAt: _u, ...rest } = draft;
    batch.set(doc(db, 'contracts', newId), {
      ...rest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'publicContracts', newToken), buildPublicProjection(rest));
    batch.set(doc(db, 'publicBulkContracts', newBulkToken), {
      bulkToken: newBulkToken,
      publicToken: newToken,
      contractId: newId,
      enabled: Boolean(rest.bulkRegistrationEnabled),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'DUPLICAR_CONTRATO',
      entityType: 'contract',
      entityId: newId,
      changedFields: [{ field: 'sourceContractId', oldValue: source.contractId, newValue: newId }],
    });

    return draft;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteContract(
  contract: Contract,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const path = `contracts/${contract.contractId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'contracts', contract.contractId));
    if (contract.publicToken) {
      batch.delete(doc(db, 'publicContracts', contract.publicToken));
    }
    if (contract.bulkToken) {
      batch.delete(doc(db, 'publicBulkContracts', contract.bulkToken));
    }
    await batch.commit();

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'ELIMINAR_CONTRATO',
      entityType: 'contract',
      entityId: contract.contractId,
      changedFields: [{ field: 'title', oldValue: contract.title, newValue: 'deleted' }],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedSampleContractForAdmin(adminUser: {
  uid: string;
  email: string;
}): Promise<Contract> {
  const formConfig = createDefaultFormConfig(
    'Registro Oficial · Uniforme Temporada 2026',
    'Completa tu talla, seudónimo y datos de contacto para producción MEGO FORCE',
    '1. Verifica la tabla de tallas antes de elegir.\n2. Conserva los ceros iniciales de tu cédula.\n3. Solo se permite un registro por participante.'
  );

  const frontJerseySvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#111111"/><stop offset="100%" stop-color="#080808"/>
        </linearGradient>
        <linearGradient id="redSlash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ED1010"/><stop offset="100%" stop-color="#9E0808"/>
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#bg)"/>
      <g stroke="#222222" stroke-width="1" opacity="0.5">
        <line x1="0" y1="150" x2="800" y2="150"/><line x1="0" y1="300" x2="800" y2="300"/><line x1="0" y1="450" x2="800" y2="450"/>
        <line x1="200" y1="0" x2="200" y2="600"/><line x1="400" y1="0" x2="400" y2="600"/><line x1="600" y1="0" x2="600" y2="600"/>
      </g>
      <path d="M270 110 L330 85 Q400 118 470 85 L530 110 L620 190 L570 250 L520 210 L520 500 L280 500 L280 210 L230 250 L180 190 Z" fill="#181818" stroke="#383838" stroke-width="3"/>
      <path d="M280 260 L520 195 L520 245 L280 310 Z" fill="url(#redSlash)"/>
      <path d="M280 322 L520 257 L520 272 L280 337 Z" fill="#FFFFFF" opacity="0.9"/>
      <path d="M330 85 Q400 132 470 85" fill="none" stroke="#ED1010" stroke-width="6"/>
      <text x="400" y="200" text-anchor="middle" fill="#FFFFFF" font-family="Arial Black, sans-serif" font-size="22" letter-spacing="4">MEGO FORCE</text>
      <text x="400" y="405" text-anchor="middle" fill="#FFFFFF" font-family="Arial Black, sans-serif" font-size="76">10</text>
      <text x="400" y="548" text-anchor="middle" fill="#888888" font-family="monospace" font-size="14" letter-spacing="3">VISTA FRONTAL · KIT PRO SUBLIMADO</text>
    </svg>`
  )}`;

  const backJerseySvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#0C0C0C"/>
      <path d="M270 110 L345 92 Q400 105 455 92 L530 110 L620 190 L570 250 L520 210 L520 500 L280 500 L280 210 L230 250 L180 190 Z" fill="#161616" stroke="#383838" stroke-width="3"/>
      <rect x="280" y="138" width="240" height="36" fill="#ED1010" opacity="0.9"/>
      <text x="400" y="164" text-anchor="middle" fill="#FFFFFF" font-family="Arial Black, sans-serif" font-size="22" letter-spacing="4">SEUDÓNIMO</text>
      <text x="400" y="340" text-anchor="middle" fill="#FFFFFF" font-family="Arial Black, sans-serif" font-size="124">10</text>
      <text x="400" y="460" text-anchor="middle" fill="#888888" font-family="monospace" font-size="13" letter-spacing="3">MEGO FORCE ATHLETICS</text>
      <text x="400" y="548" text-anchor="middle" fill="#888888" font-family="monospace" font-size="14" letter-spacing="3">VISTA POSTERIOR · PERSONALIZACIÓN LÁSER</text>
    </svg>`
  )}`;

  const today = new Date().toISOString().slice(0, 10);
  const closeDt = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  return createContract(
    {
      contractCode: 'MF-2026-TITANES',
      organizationName: 'Club Deportivo Titanes Pro',
      title: 'Uniforme Oficial Torneo Apertura 2026',
      description:
        'Equipación oficial competitiva confeccionada en microfibra Dry-Tech de 165g con sublimación HD permanente, cuello anatómico reforzado y personalización individual.',
      garmentType: 'Jersey Competitivo + Short Pro',
      garmentFeatures: [
        'Tela microperforada Dry-Tech transpirable 165g/m²',
        'Sublimación HD resistente a lavados industriales',
        'Costuras planas flatlock anti-fricción',
        'Personalización de seudónimo incluida',
      ],
      status: 'active',
      startDate: today,
      endDate: closeDt,
      openDate: today,
      openTime: '00:00',
      closeDate: closeDt,
      closeTime: '23:59',
      timezone: 'America/Caracas',
      closedMessage:
        'El período oficial de registro para este contrato ha finalizado. Contacta a tu coordinador organizacional.',
      bulkRegistrationEnabled: true,
      availableSizes: [...DEFAULT_AVAILABLE_SIZES],
      mockupImages: [
        {
          id: 'mk_front',
          url: frontJerseySvg,
          caption: 'Diseño Oficial — Vista Frontal',
          isPrimary: true,
          order: 0,
        },
        {
          id: 'mk_back',
          url: backJerseySvg,
          caption: 'Personalización Posterior — Seudónimo',
          isPrimary: false,
          order: 1,
        },
      ],
      formConfig,
      sheetsConfig: {
        enabled: false,
        autoRetry: true,
      },
      sizeCounts: {},
    },
    adminUser
  );
}
