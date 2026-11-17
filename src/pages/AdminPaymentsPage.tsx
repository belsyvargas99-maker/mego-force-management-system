import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, XCircle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { RegistrationDetails } from '../components/RegistrationDetails';
import { SearchBar } from '../components/SearchBar';
import { StatsCard } from '../components/StatsCard';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import { updateRegistrationAdmin } from '../services/registrationsService';
import type { PaymentVerificationStatus, Registration } from '../types/mego';
import { calculateProductionSummary } from '../utils/sizeEngine';

export function AdminPaymentsPage() {
  const { user } = useAuth();
  const { contracts, registrations, settings, loading } = useAdminData();

  const [contractFilter, setContractFilter] = useState('all');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [verifFilter, setVerifFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Registration | null>(null);

  const contractMap = useMemo(
    () => new Map(contracts.map((c) => [c.contractId, c])),
    [contracts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (r.registrationStatus === 'cancelled') return false;
      if (contractFilter !== 'all' && r.contractId !== contractFilter) return false;
      if (modalityFilter !== 'all' && r.paymentSelection !== modalityFilter) return false;
      if (verifFilter !== 'all' && r.paymentVerificationStatus !== verifFilter) return false;
      if (q) {
        const hay = `${r.fullName} ${r.identificationNumber} ${r.registrationCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [registrations, contractFilter, modalityFilter, verifFilter, search]);

  const stats = useMemo(
    () => calculateProductionSummary(filtered, settings.defaultSizes),
    [filtered, settings.defaultSizes]
  );

  const adminInfo = {
    uid: user?.uid || 'admin',
    email: user?.email || 'admin@megoforce.com',
  };

  const setStatus = async (reg: Registration, next: PaymentVerificationStatus) => {
    try {
      await updateRegistrationAdmin(reg, { paymentVerificationStatus: next }, adminInfo);
      toast.success(`Verificación actualizada a ${next.toUpperCase()}.`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar estado.');
    }
  };

  return (
    <AdminLayout title="Control de Pagos" breadcrumb="Modalidad Declarada vs. Verificación Administrativa">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard label="Pago Completo Declarado" value={stats.fullPaymentsDeclared} />
          <StatsCard label="Pago Parcial Declarado" value={stats.partialPaymentsDeclared} />
          <StatsCard label="Verificados Admin" value={stats.verifiedPayments} accent="green" />
          <StatsCard label="Pendientes Revisión" value={stats.pendingVerifications} accent="amber" />
          <StatsCard label="Rechazados" value={stats.rejectedPayments} accent="red" />
        </div>

        <div className="bg-[#141414] border border-[#292929] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar participante o código..."
          />
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            aria-label="Filtrar por contrato"
            className="h-10 px-3 bg-[#080808] border border-[#292929] rounded-md text-sm text-white"
          >
            <option value="all">Todos los contratos</option>
            {contracts.map((c) => (
              <option key={c.contractId} value={c.contractId}>
                {c.contractCode} · {c.title}
              </option>
            ))}
          </select>
          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            aria-label="Filtrar por modalidad declarada"
            className="h-10 px-3 bg-[#080808] border border-[#292929] rounded-md text-sm text-white"
          >
            <option value="all">Todas las modalidades</option>
            <option value="PAGO COMPLETO">Pago Completo</option>
            <option value="PAGO PARCIAL">Pago Parcial</option>
          </select>
          <select
            value={verifFilter}
            onChange={(e) => setVerifFilter(e.target.value)}
            aria-label="Filtrar por verificación administrativa"
            className="h-10 px-3 bg-[#080808] border border-[#292929] rounded-md text-sm text-white"
          >
            <option value="all">Cualquier estado admin</option>
            <option value="pending">Pendiente</option>
            <option value="verified">Verificado</option>
            <option value="rejected">Rechazado</option>
          </select>
        </div>

        {loading ? (
          <LoadingState label="Cargando estado de pagos..." rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin pagos para mostrar"
            description="Los registros de participantes aparecerán aquí para su verificación manual."
            icon={<CreditCard className="w-6 h-6" />}
          />
        ) : (
          <div className="bg-[#141414] border border-[#292929] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0E0E0E] border-b border-[#292929] text-xs uppercase text-[#888888]">
                    <th className="p-3.5">Participante</th>
                    <th className="p-3.5">Contrato</th>
                    <th className="p-3.5">Talla</th>
                    <th className="p-3.5">Declarado vs Verificación</th>
                    <th className="p-3.5">Monto / Notas</th>
                    <th className="p-3.5 text-right">Verificación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {filtered.map((r) => (
                    <tr key={r.registrationId} className="hover:bg-[#191919]">
                      <td className="p-3.5">
                        <p className="font-medium text-white">{r.fullName}</p>
                        <p className="font-mono text-xs text-[#888888]">{r.identificationNumber}</p>
                      </td>
                      <td className="p-3.5 text-xs text-[#B5B5B5]">
                        {contractMap.get(r.contractId)?.contractCode || r.contractId}
                      </td>
                      <td className="p-3.5 font-display font-bold text-white">{r.size}</td>
                      <td className="p-3.5">
                        <PaymentStatusBadge
                          selection={r.paymentSelection}
                          verificationStatus={r.paymentVerificationStatus}
                        />
                      </td>
                      <td className="p-3.5 text-xs text-[#888888]">
                        {r.paymentAmount ? `$${r.paymentAmount}` : '-'}{' '}
                        {r.paymentNotes ? `· ${r.paymentNotes}` : ''}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setStatus(r, 'verified')}
                            className="px-2.5 py-1.5 rounded bg-[#16A34A]/15 hover:bg-[#16A34A]/30 text-[#4ADE80] text-xs font-medium inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verificar
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(r, 'pending')}
                            className="px-2.5 py-1.5 rounded bg-[#D97706]/15 hover:bg-[#D97706]/30 text-[#FBBF24] text-xs font-medium inline-flex items-center gap-1"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Pendiente
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(r, 'rejected')}
                            className="px-2.5 py-1.5 rounded bg-[#ED1010]/15 hover:bg-[#ED1010]/30 text-[#F87171] text-xs font-medium inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Rechazar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="px-2.5 py-1.5 rounded bg-[#1C1C1C] hover:bg-[#292929] text-white text-xs"
                          >
                            Detalle
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <RegistrationDetails
        registration={editing}
        adminUser={adminInfo}
        onClose={() => setEditing(null)}
      />
    </AdminLayout>
  );
}
