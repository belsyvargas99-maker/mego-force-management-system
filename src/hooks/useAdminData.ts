import { useEffect, useRef, useState } from 'react';
import type { RegistrationFilters } from '../components/FilterPanel';
import { auth } from '../config/firebase';
import { subscribeBulkSubmissions } from '../services/bulkRegistrationService';
import {
  reconcileContractSchedulesAdmin,
  subscribeContracts,
} from '../services/contractsService';
import { subscribeProductionOrders } from '../services/productionOrdersService';
import { subscribeAllRegistrations } from '../services/registrationsService';
import { subscribeGlobalSettings } from '../services/settingsService';
import { subscribeSyncJobs } from '../services/sheetsSyncService';
import type {
  BulkSubmissionRecord,
  Contract,
  GlobalSettings,
  ProductionOrder,
  Registration,
  SyncJob,
} from '../types/mego';
import { DEFAULT_GLOBAL_SETTINGS } from '../utils/defaultForm';

export function useAdminData() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [bulkSubmissions, setBulkSubmissions] = useState<BulkSubmissionRecord[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const lastReconcileRef = useRef(0);

  useEffect(() => {
    let loadedContracts = false;
    let loadedRegs = false;
    const checkDone = () => {
      if (loadedContracts && loadedRegs) setLoading(false);
    };

    const u1 = subscribeContracts((data) => {
      setContracts(data);
      loadedContracts = true;
      checkDone();

      const now = Date.now();
      const user = auth.currentUser;
      if (user && user.email && now - lastReconcileRef.current > 45_000) {
        lastReconcileRef.current = now;
        void reconcileContractSchedulesAdmin(data, {
          uid: user.uid,
          email: user.email,
        });
      }
    });
    const u2 = subscribeAllRegistrations((data) => {
      setRegistrations(data);
      loadedRegs = true;
      checkDone();
    });
    const u3 = subscribeSyncJobs(setSyncJobs);
    const u4 = subscribeGlobalSettings(setSettings);
    const u5 = subscribeProductionOrders(setProductionOrders);
    const u6 = subscribeBulkSubmissions(setBulkSubmissions);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, []);

  return {
    contracts,
    registrations,
    productionOrders,
    bulkSubmissions,
    syncJobs,
    settings,
    loading,
  };
}

export function filterRegistrations(
  registrations: Registration[],
  filters: RegistrationFilters
): Registration[] {
  const q = filters.search.trim().toLowerCase();
  return registrations.filter((r) => {
    if (r.registrationStatus === 'cancelled') return false;
    if (filters.contractId !== 'all' && r.contractId !== filters.contractId) return false;
    if (filters.size !== 'all' && r.size !== filters.size) return false;
    if (filters.paymentSelection !== 'all' && r.paymentSelection !== filters.paymentSelection) {
      return false;
    }
    if (
      filters.paymentVerificationStatus !== 'all' &&
      r.paymentVerificationStatus !== filters.paymentVerificationStatus
    ) {
      return false;
    }
    if (filters.registrationMode && filters.registrationMode !== 'all') {
      const mode = r.registrationMode || (r.source === 'bulk_representative' ? 'bulk' : 'individual');
      if (mode !== filters.registrationMode) return false;
    }
    const isoDay = (r.registrationTimestamp || r.createdAt || '').slice(0, 10);
    if (filters.dateFrom && isoDay < filters.dateFrom) return false;
    if (filters.dateTo && isoDay > filters.dateTo) return false;

    if (q) {
      const hay = `${r.fullName} ${r.identificationNumber} ${r.nickname} ${r.phone} ${r.registrationCode}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
