import type {
  Contract,
  ProductionOrder,
  ProductionOrderItem,
  ProductionOrderStatus,
  Registration,
} from '../types/mego';
import { sortRegistrationsChronologically } from './sizeEngine';

export const PRODUCTION_ORDER_STATUS_META: Record<
  ProductionOrderStatus,
  { label: string; colorClass: string }
> = {
  draft: { label: 'Borrador', colorClass: 'text-[#888888]' },
  in_review: { label: 'En revisión', colorClass: 'text-[#FBBF24]' },
  approved: { label: 'Aprobada (Congelada)', colorClass: 'text-[#38BDF8]' },
  in_production: { label: 'En fabricación', colorClass: 'text-[#ED1010]' },
  completed: { label: 'Fabricación terminada', colorClass: 'text-[#4ADE80]' },
  delivered: { label: 'Entregada', colorClass: 'text-white' },
};

export function generateProductionOrderCode(contractCode: string, version = 1): string {
  const cleanCode = (contractCode || 'MF')
    .toUpperCase()
    .replace(/[^A-Z0-9\-]/g, '')
    .slice(0, 18);
  const rand = Math.floor(100 + Math.random() * 899);
  return `OP-${cleanCode}-V${version}-${rand}`;
}

export function buildCustomizationNotes(reg: Registration): string {
  const notes: string[] = [];
  if (reg.nickname) notes.push(`Seudónimo: ${reg.nickname}`);
  if (reg.customFields && Object.keys(reg.customFields).length > 0) {
    for (const [k, v] of Object.entries(reg.customFields)) {
      if (v === undefined || v === null || v === '') continue;
      const valStr = Array.isArray(v) ? v.join(', ') : String(v);
      notes.push(`${k}: ${valStr}`);
    }
  }
  return notes.join(' · ') || 'Sin observaciones adicionales';
}

export function computeSnapshotDigest(items: readonly ProductionOrderItem[]): string {
  const canonical = items
    .map(
      (it) =>
        `${it.registrationId}|${it.fullName}|${it.size}|${it.nickname}|${it.customizationNotes}`
    )
    .sort()
    .join('\n');

  // Fast deterministic FNV-1a 64-bit style hex fingerprint (pure sync, works anywhere)
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0')
  );
}

export function buildProductionOrderSnapshot(
  contract: Pick<Contract, 'contractId' | 'contractCode' | 'title' | 'organizationName' | 'garmentType' | 'availableSizes'>,
  registrations: readonly Registration[]
): {
  snapshotItems: ProductionOrderItem[];
  sizeSummary: Record<string, number>;
  availableSizes: string[];
  totalGarments: number;
  snapshotHash: string;
} {
  const confirmed = sortRegistrationsChronologically(
    registrations.filter(
      (r) => r.contractId === contract.contractId && r.registrationStatus !== 'cancelled'
    )
  );

  const configuredSizes = contract.availableSizes?.length
    ? [...contract.availableSizes]
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  const sizeSummary: Record<string, number> = {};
  for (const s of configuredSizes) {
    sizeSummary[s] = 0;
  }

  const snapshotItems: ProductionOrderItem[] = confirmed.map((reg) => {
    const sizeKey = (reg.size || 'SIN TALLA').trim().toUpperCase();
    if (!(sizeKey in sizeSummary)) {
      sizeSummary[sizeKey] = 0;
      configuredSizes.push(sizeKey);
    }
    sizeSummary[sizeKey] += 1;

    return {
      registrationId: reg.registrationId,
      registrationCode: reg.registrationCode,
      fullName: reg.fullName,
      size: sizeKey,
      nickname: reg.nickname || '',
      garmentType: contract.garmentType,
      customizationNotes: buildCustomizationNotes(reg),
      paymentSelection: reg.paymentSelection,
      paymentVerificationStatus: reg.paymentVerificationStatus,
      registrationMode: reg.registrationMode || (reg.source === 'bulk_representative' ? 'bulk' : 'individual'),
    };
  });

  return {
    snapshotItems,
    sizeSummary,
    availableSizes: configuredSizes,
    totalGarments: snapshotItems.length,
    snapshotHash: computeSnapshotDigest(snapshotItems),
  };
}

export interface OrderParticipantDiff {
  hasChanges: boolean;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  summaryText: string;
}

/**
 * Compares a frozen/approved production order snapshot against current confirmed participants
 * without modifying the approved order.
 */
export function detectOrderParticipantChanges(
  order: Pick<ProductionOrder, 'contractId' | 'snapshotItems'>,
  currentRegistrations: readonly Registration[]
): OrderParticipantDiff {
  const active = currentRegistrations.filter(
    (r) => r.contractId === order.contractId && r.registrationStatus !== 'cancelled'
  );

  const oldMap = new Map(order.snapshotItems.map((it) => [it.registrationId, it]));
  const newMap = new Map(active.map((r) => [r.registrationId, r]));

  let addedCount = 0;
  let removedCount = 0;
  let modifiedCount = 0;

  for (const [id, reg] of newMap.entries()) {
    const prev = oldMap.get(id);
    if (!prev) {
      addedCount++;
    } else if (
      prev.size !== (reg.size || '').trim().toUpperCase() ||
      prev.nickname !== (reg.nickname || '') ||
      prev.fullName !== reg.fullName
    ) {
      modifiedCount++;
    }
  }

  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) {
      removedCount++;
    }
  }

  const parts: string[] = [];
  if (addedCount > 0) parts.push(`+${addedCount} participante(s) nuevo(s)`);
  if (removedCount > 0) parts.push(`-${removedCount} retirado(s)`);
  if (modifiedCount > 0) parts.push(`${modifiedCount} cambio(s) de talla/personalización`);

  return {
    hasChanges: addedCount > 0 || removedCount > 0 || modifiedCount > 0,
    addedCount,
    removedCount,
    modifiedCount,
    summaryText: parts.join(' · ') || 'Sin cambios respecto a los participantes actuales',
  };
}
