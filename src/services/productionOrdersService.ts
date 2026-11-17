import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { setDoc, updateDoc } from './firestoreSafe';
import { db } from '../config/firebase';
import type {
  Contract,
  ProductionOrder,
  ProductionOrderStatus,
  ProductionOrderVersionEntry,
  Registration,
} from '../types/mego';
import { generateEntityId } from '../utils/normalizers';
import {
  buildProductionOrderSnapshot,
  detectOrderParticipantChanges,
  generateProductionOrderCode,
} from '../utils/productionOrders';
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

function mapDocToOrder(id: string, data: Record<string, any>): ProductionOrder {
  return {
    orderId: data.orderId || id,
    orderCode: data.orderCode || '',
    contractId: data.contractId || '',
    contractCode: data.contractCode || '',
    contractTitle: data.contractTitle || '',
    organizationName: data.organizationName || '',
    garmentType: data.garmentType || '',
    status: (data.status as ProductionOrderStatus) || 'draft',
    version: typeof data.version === 'number' ? data.version : 1,
    isFrozen: Boolean(data.isFrozen),
    totalGarments: typeof data.totalGarments === 'number' ? data.totalGarments : 0,
    availableSizes: Array.isArray(data.availableSizes) ? data.availableSizes : [],
    sizeSummary: data.sizeSummary || {},
    snapshotItems: Array.isArray(data.snapshotItems) ? data.snapshotItems : [],
    observations: data.observations || '',
    responsibleUid: data.responsibleUid || '',
    responsibleName: data.responsibleName || '',
    approvedByEmail: data.approvedByEmail || '',
    approvedAt: data.approvedAt || '',
    versionHistory: Array.isArray(data.versionHistory) ? data.versionHistory : [],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export function subscribeProductionOrders(
  callback: (orders: ProductionOrder[]) => void
): () => void {
  const path = 'productionOrders';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      callback(snap.docs.map((d) => mapDocToOrder(d.id, d.data())));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeProductionOrderById(
  orderId: string,
  callback: (order: ProductionOrder | null) => void
): () => void {
  const path = `productionOrders/${orderId}`;
  return onSnapshot(
    doc(db, 'productionOrders', orderId),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(mapDocToOrder(snap.id, snap.data()));
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function createProductionOrderFromContract(
  contract: Contract,
  registrations: readonly Registration[],
  observations: string,
  adminUser: { uid: string; email: string; displayName?: string }
): Promise<ProductionOrder> {
  const snapshot = buildProductionOrderSnapshot(contract, registrations);
  if (snapshot.totalGarments === 0) {
    throw new Error('No hay participantes confirmados en este contrato para generar una orden.');
  }

  const orderId = generateEntityId('ord');
  const orderCode = generateProductionOrderCode(contract.contractCode, 1);
  const nowIso = new Date().toISOString();

  const initialHistory: ProductionOrderVersionEntry = {
    version: 1,
    createdAt: nowIso,
    createdByEmail: adminUser.email,
    action: 'created',
    changesSummary: `Orden inicial generada con ${snapshot.totalGarments} prenda(s).`,
    totalGarments: snapshot.totalGarments,
    snapshotHash: snapshot.snapshotHash,
  };

  const payload = {
    orderId,
    orderCode,
    contractId: contract.contractId,
    contractCode: contract.contractCode,
    contractTitle: contract.title,
    organizationName: contract.organizationName,
    garmentType: contract.garmentType,
    status: 'draft' as ProductionOrderStatus,
    version: 1,
    isFrozen: false,
    totalGarments: snapshot.totalGarments,
    availableSizes: snapshot.availableSizes,
    sizeSummary: snapshot.sizeSummary,
    snapshotItems: snapshot.snapshotItems,
    observations: observations.trim().slice(0, 2000),
    responsibleUid: adminUser.uid,
    responsibleName: adminUser.displayName || adminUser.email,
    approvedByEmail: '',
    approvedAt: '',
    versionHistory: [initialHistory],
  };

  try {
    await setDoc(doc(db, 'productionOrders', orderId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'CREAR_ORDEN_PRODUCCION',
      entityType: 'production_order',
      entityId: orderId,
      changedFields: [
        { field: 'orderCode', oldValue: '', newValue: orderCode },
        { field: 'totalGarments', oldValue: '0', newValue: String(snapshot.totalGarments) },
      ],
    });

    return { ...payload, createdAt: nowIso, updatedAt: nowIso };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `productionOrders/${orderId}`);
  }
}

export async function approveAndFreezeProductionOrder(
  order: ProductionOrder,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const path = `productionOrders/${order.orderId}`;
  const nowIso = new Date().toISOString();

  const lastHash =
    order.versionHistory[order.versionHistory.length - 1]?.snapshotHash || '';
  const nextEntry: ProductionOrderVersionEntry = {
    version: order.version,
    createdAt: nowIso,
    createdByEmail: adminUser.email,
    action: 'approved',
    changesSummary: `Orden aprobada y congelada de forma inmutable (${order.totalGarments} prendas).`,
    totalGarments: order.totalGarments,
    snapshotHash: lastHash,
  };

  try {
    await updateDoc(doc(db, 'productionOrders', order.orderId), {
      status: 'approved',
      isFrozen: true,
      approvedByEmail: adminUser.email,
      approvedAt: nowIso,
      versionHistory: [...order.versionHistory, nextEntry].slice(-100),
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'APROBAR_CONGELAR_ORDEN',
      entityType: 'production_order',
      entityId: order.orderId,
      changedFields: [
        { field: 'status', oldValue: order.status, newValue: 'approved' },
        { field: 'isFrozen', oldValue: String(order.isFrozen), newValue: 'true' },
      ],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateProductionOrderProgress(
  order: ProductionOrder,
  updates: { status?: ProductionOrderStatus; observations?: string },
  adminUser: { uid: string; email: string }
): Promise<void> {
  const path = `productionOrders/${order.orderId}`;
  const nextStatus = updates.status ?? order.status;

  if (nextStatus === 'approved' && !order.isFrozen) {
    await approveAndFreezeProductionOrder(order, adminUser);
    return;
  }

  const nowIso = new Date().toISOString();
  const lastHash =
    order.versionHistory[order.versionHistory.length - 1]?.snapshotHash || '';
  const history =
    nextStatus !== order.status
      ? [
          ...order.versionHistory,
          {
            version: order.version,
            createdAt: nowIso,
            createdByEmail: adminUser.email,
            action: 'status_updated' as const,
            changesSummary: `Estado cambiado de "${order.status}" a "${nextStatus}".`,
            totalGarments: order.totalGarments,
            snapshotHash: lastHash,
          },
        ].slice(-100)
      : order.versionHistory;

  try {
    await updateDoc(doc(db, 'productionOrders', order.orderId), {
      status: nextStatus,
      observations: (updates.observations ?? order.observations).slice(0, 2000),
      versionHistory: history,
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'ACTUALIZAR_ESTADO_ORDEN',
      entityType: 'production_order',
      entityId: order.orderId,
      changedFields: [
        { field: 'status', oldValue: order.status, newValue: nextStatus },
      ],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createNewVersionOfProductionOrder(
  previousOrder: ProductionOrder,
  contract: Contract,
  registrations: readonly Registration[],
  changeNotes: string,
  adminUser: { uid: string; email: string; displayName?: string }
): Promise<ProductionOrder> {
  const snapshot = buildProductionOrderSnapshot(contract, registrations);
  const diff = detectOrderParticipantChanges(previousOrder, registrations);
  const nextVersion = previousOrder.version + 1;
  const orderId = generateEntityId('ord');
  const orderCode = generateProductionOrderCode(contract.contractCode, nextVersion);
  const nowIso = new Date().toISOString();

  const summary = changeNotes.trim() || diff.summaryText;
  const newEntry: ProductionOrderVersionEntry = {
    version: nextVersion,
    createdAt: nowIso,
    createdByEmail: adminUser.email,
    action: 'new_version',
    changesSummary: `Nueva versión v${nextVersion} basada en ${previousOrder.orderCode}: ${summary}`,
    totalGarments: snapshot.totalGarments,
    snapshotHash: snapshot.snapshotHash,
  };

  const payload = {
    orderId,
    orderCode,
    contractId: contract.contractId,
    contractCode: contract.contractCode,
    contractTitle: contract.title,
    organizationName: contract.organizationName,
    garmentType: contract.garmentType,
    status: 'draft' as ProductionOrderStatus,
    version: nextVersion,
    isFrozen: false,
    totalGarments: snapshot.totalGarments,
    availableSizes: snapshot.availableSizes,
    sizeSummary: snapshot.sizeSummary,
    snapshotItems: snapshot.snapshotItems,
    observations: previousOrder.observations || '',
    responsibleUid: adminUser.uid,
    responsibleName: adminUser.displayName || adminUser.email,
    approvedByEmail: '',
    approvedAt: '',
    versionHistory: [...previousOrder.versionHistory, newEntry].slice(-100),
  };

  try {
    await setDoc(doc(db, 'productionOrders', orderId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'NUEVA_VERSION_ORDEN',
      entityType: 'production_order',
      entityId: orderId,
      changedFields: [
        { field: 'previousOrderId', oldValue: previousOrder.orderId, newValue: orderId },
        { field: 'version', oldValue: String(previousOrder.version), newValue: String(nextVersion) },
        { field: 'changes', oldValue: '', newValue: summary.slice(0, 150) },
      ],
    });

    return { ...payload, createdAt: nowIso, updatedAt: nowIso };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `productionOrders/${orderId}`);
  }
}
