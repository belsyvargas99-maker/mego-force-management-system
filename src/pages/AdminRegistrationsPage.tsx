import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Users, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { EmptyState } from '../components/EmptyState';
import { ExportMenu } from '../components/ExportMenu';
import { FilterPanel, INITIAL_FILTERS, type RegistrationFilters } from '../components/FilterPanel';
import { ImportModal } from '../components/ImportModal';
import { LoadingState } from '../components/LoadingState';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { RegistrationDetails } from '../components/RegistrationDetails';
import { RegistrationTable } from '../components/RegistrationTable';
import { filterRegistrations, useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import {
  deleteRegistrationAdmin,
  updateRegistrationAdmin,
} from '../services/registrationsService';
import type { Contract, PaymentVerificationStatus, Registration } from '../types/mego';
import {
  calculateProductionSummary,
  groupRegistrationsBySize,
  sortRegistrationsChronologically,
} from '../utils/sizeEngine';

interface AdminRegistrationsPageProps {
  defaultView?: 'general' | 'by_size' | 'summary';
}

export function AdminRegistrationsPage({ defaultView = 'general' }: AdminRegistrationsPageProps) {
  const { id: contractIdParam } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const { contracts, registrations, settings, loading } = useAdminData();

  const [viewMode, setViewMode] = useState<'general' | 'by_size' | 'summary'>(defaultView);
  React.useEffect(() => {
    setViewMode(defaultView);
  }, [defaultView]);
  const [filters, setFilters] = useState<RegistrationFilters>(INITIAL_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingReg, setEditingReg] = useState<Registration | null>(null);
  const [deletingReg, setDeletingReg] = useState<Registration | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const contractsMap = useMemo(
    () => new Map(contracts.map((c) => [c.contractId, c])),
    [contracts]
  );

  const activeContract: Contract | undefined = contractIdParam
    ? contractsMap.get(contractIdParam)
    : filters.contractId !== 'all'
      ? contractsMap.get(filters.contractId)
      : contracts[0];

  const effectiveFilters = useMemo(
    () =>
      contractIdParam
        ? { ...filters, contractId: contractIdParam }
        : filters,
    [filters, contractIdParam]
  );

  const filtered = useMemo(
    () => sortRegistrationsChronologically(filterRegistrations(registrations, effectiveFilters)),
    [registrations, effectiveFilters]
  );

  const configuredSizes = activeContract?.availableSizes || settings.defaultSizes;
  const sizeGroups = useMemo(
    () => groupRegistrationsBySize(filtered, configuredSizes),
    [filtered, configuredSizes]
  );
  const summary = useMemo(
    () => calculateProductionSummary(filtered, configuredSizes),
    [filtered, configuredSizes]
  );

  const adminInfo = {
    uid: user?.uid || 'admin',
    email: user?.email || 'admin@megoforce.com',
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };

  const handleQuickVerify = async (reg: Registration, status: PaymentVerificationStatus) => {
    try {
      await updateRegistrationAdmin(reg, { paymentVerificationStatus: status }, adminInfo);
      toast.success(`Pago actualizado a ${status.toUpperCase()}.`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar verificación.');
    }
  };

  const handleBulkVerify = async () => {
    const selectedRegs = filtered.filter((r) => selectedIds.has(r.registrationId));
    if (selectedRegs.length === 0) return;
    try {
      for (const r of selectedRegs) {
        await updateRegistrationAdmin(r, { paymentVerificationStatus: 'verified' }, adminInfo);
      }
      toast.success(`${selectedRegs.length} registro(s) verificados.`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err?.message || 'Error en verificación múltiple.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingReg) return;
    setDeleting(true);
    try {
      await deleteRegistrationAdmin(deletingReg, adminInfo);
      toast.success('Registro eliminado correctamente.');
      setDeletingReg(null);
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar registro.');
    } finally {
      setDeleting(false);
    }
  };

  const exportContractMeta = activeContract || {
    contractCode: 'GLOBAL',
    title: 'Todos los Contratos',
    organizationName: 'MEGO FORCE',
    availableSizes: settings.defaultSizes,
  };

  const exportList =
    selectedIds.size > 0
      ? filtered.filter((r) => selectedIds.has(r.registrationId))
      : filtered;

  return (
    <AdminLayout
      title={
        contractIdParam && activeContract
          ? `Participantes · ${activeContract.contractCode}`
          : 'Participantes'
      }
      breadcrumb={
        contractIdParam && activeContract
          ? `Contratos / ${activeContract.title}`
          : 'Base de Datos de Participantes'
      }
    >
      <div className="space-y-5">
        {contractIdParam && (
          <Link
            to={`/admin/contracts/${contractIdParam}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al contrato
          </Link>
        )}

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#141414] border border-[#292929] rounded-lg">
            {[
              { id: 'general', label: 'Listado Cronológico' },
              { id: 'by_size', label: 'Agrupado por Talla' },
              { id: 'summary', label: 'Resumen Producción' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setViewMode(t.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  viewMode === t.id
                    ? 'bg-[#ED1010] text-white'
                    : 'text-[#B5B5B5] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleBulkVerify}
                className="h-9 px-3.5 bg-[#16A34A]/20 border border-[#16A34A]/50 text-[#4ADE80] text-xs font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verificar seleccionados ({selectedIds.size})
              </button>
            )}
            {activeContract && (
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="h-9 px-3.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Importar XLSX/Word
              </button>
            )}
            <ExportMenu
              contract={exportContractMeta}
              registrations={exportList}
              options={{
                scope:
                  viewMode === 'summary'
                    ? 'production_summary'
                    : filters.size !== 'all'
                      ? 'size'
                      : 'filtered',
                specificSize: filters.size !== 'all' ? filters.size : undefined,
              }}
            />
          </div>
        </div>

        <FilterPanel
          filters={effectiveFilters}
          onChange={setFilters}
          contracts={contracts}
          sizes={configuredSizes}
          hideContractFilter={Boolean(contractIdParam)}
        />

        {loading ? (
          <LoadingState label="Cargando registros..." rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin participantes registrados"
            description="No hay registros que coincidan con los filtros actuales o aún no se han completado formularios."
            icon={<Users className="w-6 h-6" />}
          />
        ) : viewMode === 'general' ? (
          <RegistrationTable
            registrations={filtered}
            contractsMap={contractIdParam ? undefined : contractsMap}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onEdit={setEditingReg}
            onDelete={setDeletingReg}
            onQuickVerify={handleQuickVerify}
          />
        ) : viewMode === 'by_size' ? (
          <div className="space-y-5">
            {sizeGroups
              .filter((g) => g.count > 0)
              .map((group) => (
                <section
                  key={group.size}
                  className="bg-[#141414] border border-[#292929] rounded-lg overflow-hidden"
                >
                  <div className="px-5 py-3.5 bg-[#0E0E0E] border-b border-[#292929] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-display text-xl font-bold text-[#ED1010]">
                        TALLA {group.size}
                      </span>
                      <span className="text-xs text-[#888888] tabular-nums">
                        {group.count} participante(s) · {group.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#222222] text-[#888888] uppercase">
                          <th className="p-3">#</th>
                          <th className="p-3">Nombre</th>
                          <th className="p-3">Cédula</th>
                          <th className="p-3">Seudónimo</th>
                          <th className="p-3">Teléfono</th>
                          <th className="p-3">Pago</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222222]">
                        {group.registrations.map((r, i) => (
                          <tr key={r.registrationId} className="hover:bg-[#191919]">
                            <td className="p-3 font-mono text-[#888888] tabular-nums">{i + 1}</td>
                            <td className="p-3 font-medium text-white">{r.fullName}</td>
                            <td className="p-3 font-mono tabular-nums">{r.identificationNumber}</td>
                            <td className="p-3">{r.nickname || '-'}</td>
                            <td className="p-3 font-mono tabular-nums">{r.phone}</td>
                            <td className="p-3">
                              <PaymentStatusBadge
                                selection={r.paymentSelection}
                                verificationStatus={r.paymentVerificationStatus}
                              />
                            </td>
                            <td className="p-3 font-mono text-[#888888] tabular-nums">
                              {new Date(r.registrationTimestamp).toLocaleDateString('es-ES')}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setEditingReg(r)}
                                className="text-[#ED1010] hover:underline font-medium"
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292929] pb-4">
              <div>
                <h3 className="font-display text-2xl uppercase text-white">
                  Resumen de Producción
                </h3>
                <p className="text-xs text-[#888888]">
                  Totales requeridos para corte y confección
                </p>
              </div>
              <div className="font-display text-3xl font-bold text-[#ED1010] tabular-nums">
                {summary.totalGarments} PRENDAS
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {summary.groups.map((g) => (
                <div
                  key={g.size}
                  className="bg-[#0B0B0B] border border-[#292929] rounded-md p-4 text-center space-y-1"
                >
                  <p className="font-display text-lg text-[#888888]">{g.size}</p>
                  <p className="font-display text-3xl font-bold text-white tabular-nums">
                    {g.count}
                  </p>
                  <p className="font-mono text-xs text-[#ED1010] tabular-nums">
                    {g.percentage}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <RegistrationDetails
        registration={editingReg}
        availableSizes={configuredSizes}
        adminUser={adminInfo}
        onClose={() => setEditingReg(null)}
      />

      <ConfirmationModal
        open={Boolean(deletingReg)}
        title="Eliminar Registro de Participante"
        description={`¿Confirmas eliminar el registro de ${deletingReg?.fullName} (Talla ${deletingReg?.size})? Esta acción quedará registrada en auditoría.`}
        confirmLabel="Sí, eliminar"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingReg(null)}
      />

      <ImportModal
        open={importOpen}
        contract={activeContract || null}
        existingRegistrations={registrations}
        adminUser={adminInfo}
        onClose={() => setImportOpen(false)}
      />
    </AdminLayout>
  );
}
