import type {
  Contract,
  DashboardMetrics,
  ProductionSummary,
  Registration,
  SizeGroup,
} from '../types/mego';

export const STANDARD_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/**
 * Returns a chronologically sorted copy of registrations (oldest first).
 * Never mutates the original array.
 */
export function sortRegistrationsChronologically(
  registrations: readonly Registration[]
): Registration[] {
  return [...registrations].sort((a, b) => {
    const ta = Date.parse(a.registrationTimestamp || a.createdAt || '') || 0;
    const tb = Date.parse(b.registrationTimestamp || b.createdAt || '') || 0;
    if (ta !== tb) return ta - tb;
    return a.registrationId.localeCompare(b.registrationId);
  });
}

/**
 * Groups registrations automatically by configured size order without mutating records,
 * preserving chronological order inside every size bucket and appending any custom sizes.
 */
export function groupRegistrationsBySize(
  registrations: readonly Registration[],
  configuredSizes: readonly string[] = STANDARD_SIZE_ORDER
): SizeGroup[] {
  const activeRecords = registrations.filter((r) => r.registrationStatus !== 'cancelled');
  const chronological = sortRegistrationsChronologically(activeRecords);
  const total = chronological.length;

  const bucketMap = new Map<string, Registration[]>();
  for (const size of configuredSizes) {
    bucketMap.set(size, []);
  }

  for (const reg of chronological) {
    const sizeKey = (reg.size || 'SIN TALLA').trim().toUpperCase();
    if (!bucketMap.has(sizeKey)) {
      bucketMap.set(sizeKey, []);
    }
    bucketMap.get(sizeKey)!.push(reg);
  }

  const orderedKeys: string[] = [...configuredSizes];
  for (const key of bucketMap.keys()) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  return orderedKeys.map((size) => {
    const list = bucketMap.get(size) || [];
    const count = list.length;
    const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    return {
      size,
      count,
      percentage,
      registrations: list,
    };
  });
}

export function calculateProductionSummary(
  registrations: readonly Registration[],
  configuredSizes: readonly string[] = STANDARD_SIZE_ORDER
): ProductionSummary {
  const activeRecords = registrations.filter((r) => r.registrationStatus !== 'cancelled');
  const groups = groupRegistrationsBySize(activeRecords, configuredSizes);

  let pendingVerifications = 0;
  let verifiedPayments = 0;
  let rejectedPayments = 0;
  let fullPaymentsDeclared = 0;
  let partialPaymentsDeclared = 0;
  let customNicknamesCount = 0;

  for (const reg of activeRecords) {
    if (reg.paymentVerificationStatus === 'pending') pendingVerifications++;
    else if (reg.paymentVerificationStatus === 'verified') verifiedPayments++;
    else if (reg.paymentVerificationStatus === 'rejected') rejectedPayments++;

    if (reg.paymentSelection === 'PAGO COMPLETO') fullPaymentsDeclared++;
    else if (reg.paymentSelection === 'PAGO PARCIAL') partialPaymentsDeclared++;

    if (reg.nickname && reg.nickname.trim().length > 0) customNicknamesCount++;
  }

  return {
    totalGarments: activeRecords.length,
    pendingVerifications,
    verifiedPayments,
    rejectedPayments,
    fullPaymentsDeclared,
    partialPaymentsDeclared,
    customNicknamesCount,
    groups,
  };
}

export function calculateDashboardMetrics(
  contracts: readonly Contract[],
  registrations: readonly Registration[],
  configuredSizes: readonly string[] = STANDARD_SIZE_ORDER
): DashboardMetrics {
  const activeContracts = contracts.filter((c) => c.status === 'active').length;
  const activeRegs = registrations.filter((r) => r.registrationStatus !== 'cancelled');
  const prod = calculateProductionSummary(activeRegs, configuredSizes);

  const dateCounts = new Map<string, number>();
  const contractCounts = new Map<string, number>();

  for (const reg of sortRegistrationsChronologically(activeRegs)) {
    const iso = reg.registrationTimestamp || reg.createdAt || '';
    const day = iso ? iso.slice(0, 10) : 'Sin fecha';
    dateCounts.set(day, (dateCounts.get(day) || 0) + 1);
    contractCounts.set(reg.contractId, (contractCounts.get(reg.contractId) || 0) + 1);
  }

  const contractMap = new Map(contracts.map((c) => [c.contractId, c.title]));
  const byContract = Array.from(contractCounts.entries())
    .map(([contractId, count]) => ({
      contractId,
      title: contractMap.get(contractId) || contractId,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const byDate = Array.from(dateCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    activeContracts,
    totalContracts: contracts.length,
    totalParticipants: activeRegs.length,
    totalGarments: prod.totalGarments,
    fullPaymentsDeclared: prod.fullPaymentsDeclared,
    partialPaymentsDeclared: prod.partialPaymentsDeclared,
    verifiedPayments: prod.verifiedPayments,
    pendingVerificationPayments: prod.pendingVerifications,
    rejectedPayments: prod.rejectedPayments,
    bySize: prod.groups.map((g) => ({
      size: g.size,
      count: g.count,
      percentage: g.percentage,
    })),
    byDate,
    byContract,
    byPaymentModality: [
      { name: 'Pago Completo', value: prod.fullPaymentsDeclared },
      { name: 'Pago Parcial', value: prod.partialPaymentsDeclared },
    ],
  };
}

/**
 * Pure contract duplication logic: copies form config, sizes, and mockups,
 * resets participants and generates a brand-new random publicToken.
 */
export function buildDuplicatedContractDraft(
  source: Contract,
  newContractId: string,
  newPublicToken: string,
  createdBy: string,
  nowIso: string
): Contract {
  return {
    contractId: newContractId,
    contractCode: `${source.contractCode}-COPIA`,
    organizationName: source.organizationName,
    title: `${source.title} (Copia)`,
    description: source.description,
    garmentType: source.garmentType,
    garmentFeatures: [...(source.garmentFeatures || [])],
    status: 'draft',
    startDate: source.startDate || '',
    endDate: source.endDate || '',
    openDate: source.openDate || '',
    openTime: source.openTime || '00:00',
    closeDate: source.closeDate || '',
    closeTime: source.closeTime || '23:59',
    timezone: source.timezone || 'America/Caracas',
    closedMessage: source.closedMessage || '',
    scheduleHistory: [],
    bulkRegistrationEnabled: Boolean(source.bulkRegistrationEnabled),
    publicToken: newPublicToken,
    availableSizes: [...(source.availableSizes || STANDARD_SIZE_ORDER)],
    mockupImages: (source.mockupImages || []).map((img) => ({ ...img })),
    formConfig: {
      ...source.formConfig,
      fields: (source.formConfig?.fields || []).map((f) => ({
        ...f,
        options: f.options ? [...f.options] : undefined,
      })),
    },
    sheetsConfig: {
      enabled: false,
      autoRetry: true,
    },
    totalParticipants: 0,
    sizeCounts: {},
    createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
