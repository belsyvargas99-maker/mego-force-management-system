import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Users,
  Shirt,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Factory,
  UsersRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { SizeDistributionChart } from '../components/SizeDistributionChart';
import { StatsCard } from '../components/StatsCard';
import { SyncStatus } from '../components/SyncStatus';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import { seedSampleContractForAdmin } from '../services/contractsService';
import { calculateDashboardMetrics } from '../utils/sizeEngine';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const { contracts, registrations, productionOrders, bulkSubmissions, syncJobs, settings, loading } =
    useAdminData();
  const [seeding, setSeeding] = useState(false);

  const metrics = useMemo(
    () => calculateDashboardMetrics(contracts, registrations, settings.defaultSizes),
    [contracts, registrations, settings.defaultSizes]
  );

  const autoClosedContracts = useMemo(
    () => contracts.filter((c) => c.status === 'auto_closed'),
    [contracts]
  );

  const handleSeedSample = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedSampleContractForAdmin({
        uid: user.uid,
        email: user.email || 'admin@megoforce.com',
      });
      toast.success('Contrato inicial MEGO FORCE creado en Firestore.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear contrato inicial.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AdminLayout title="Dashboard Ejecutivo" breadcrumb="MEGO FORCE · Resumen General">
      {loading ? (
        <LoadingState label="Cargando métricas de Firestore en tiempo real..." rows={6} />
      ) : (
        <div className="space-y-6">
          {contracts.length === 0 && (
            <EmptyState
              title="Tu consola MEGO FORCE está lista"
              description="Crea tu primer contrato oficial o genera un contrato de ejemplo para probar el enlace público, el constructor de formularios y la sincronización con Google Sheets."
              actionLabel={seeding ? 'Creando...' : 'Cargar Contrato Muestra'}
              onAction={handleSeedSample}
              icon={<Sparkles className="w-6 h-6 text-[#ED1010]" />}
            />
          )}

          {autoClosedContracts.length > 0 && (
            <div className="bg-[#ED1010]/10 border border-[#ED1010]/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#ED1010] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {autoClosedContracts.length} contrato(s) cerrado(s) automáticamente por vencimiento de plazo
                  </p>
                  <p className="text-xs text-[#CCCCCC] mt-0.5">
                    {autoClosedContracts.map((c) => `${c.contractCode} (${c.title})`).join(' · ')}
                  </p>
                </div>
              </div>
              <Link
                to={`/admin/contracts/${autoClosedContracts[0].contractId}`}
                className="h-9 px-3.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                Revisar / Reabrir
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Primary KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Contratos Activos"
              value={metrics.activeContracts}
              sublabel={`${metrics.totalContracts} contratos totales`}
              accent="red"
              icon={<FileText className="w-4 h-4" />}
            />
            <StatsCard
              label="Total Participantes"
              value={metrics.totalParticipants}
              sublabel="Registros confirmados en sistema"
              icon={<Users className="w-4 h-4" />}
            />
            <StatsCard
              label="Órdenes de Producción"
              value={productionOrders.length}
              sublabel={`${productionOrders.filter((o) => o.isFrozen).length} aprobadas / congeladas`}
              icon={<Factory className="w-4 h-4" />}
            />
            <StatsCard
              label="Pagos Verificados"
              value={metrics.verifiedPayments}
              sublabel={`${metrics.pendingVerificationPayments} pendientes · ${metrics.rejectedPayments} rechazados`}
              accent="green"
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
          </div>

          {/* Payment & Mode Breakdown Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Total de Prendas"
              value={metrics.totalGarments}
              sublabel="Unidades requeridas"
              icon={<Shirt className="w-4 h-4" />}
            />
            <StatsCard
              label="Pagos Completos"
              value={metrics.fullPaymentsDeclared}
              sublabel={`${metrics.partialPaymentsDeclared} parciales declarados`}
            />
            <StatsCard
              label="Envíos Masivos Org."
              value={bulkSubmissions.length}
              sublabel={`${registrations.filter((r) => r.registrationMode === 'bulk').length} atletas vía representante`}
              icon={<UsersRound className="w-4 h-4" />}
            />
            <StatsCard
              label="Pendientes Verificación"
              value={metrics.pendingVerificationPayments}
              sublabel="Requieren revisión administrativa"
              accent="amber"
              icon={<Clock className="w-4 h-4" />}
            />
          </div>

          {/* Charts */}
          <SizeDistributionChart metrics={metrics} />

          {/* Recent Contracts & Sync Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <DashboardCard
              title="Contratos Recientes"
              subtitle="Acceso rápido a gestión y enlaces públicos"
              className="lg:col-span-7"
              action={
                <Link
                  to="/admin/contracts"
                  className="text-xs font-medium text-[#ED1010] hover:underline inline-flex items-center gap-1"
                >
                  Ver todos
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            >
              {contracts.length === 0 ? (
                <div className="py-6 text-center text-sm text-[#888888]">
                  No hay contratos creados todavía.{' '}
                  <Link to="/admin/contracts/new" className="text-[#ED1010] hover:underline">
                    Crear primer contrato
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#222222]">
                  {contracts.slice(0, 5).map((c) => {
                    const count = registrations.filter(
                      (r) => r.contractId === c.contractId && r.registrationStatus !== 'cancelled'
                    ).length;
                    return (
                      <div
                        key={c.contractId}
                        className="py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <Link
                            to={`/admin/contracts/${c.contractId}`}
                            className="text-sm font-semibold text-white hover:text-[#ED1010] truncate block"
                          >
                            {c.title}
                          </Link>
                          <p className="text-xs text-[#888888] truncate">
                            {c.contractCode} · {c.organizationName}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-bold text-white tabular-nums">
                            {count}
                          </p>
                          <p className="text-[11px] text-[#888888] uppercase">{c.status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </DashboardCard>

            <DashboardCard
              title="Cola de Sincronización Sheets"
              subtitle="Últimos eventos de exportación automática"
              className="lg:col-span-5"
              action={
                <Link
                  to="/admin/exports"
                  className="text-xs font-medium text-[#ED1010] hover:underline inline-flex items-center gap-1"
                >
                  Gestionar
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              }
            >
              {syncJobs.length === 0 ? (
                <div className="py-6 text-center text-sm text-[#888888]">
                  Sin tareas de sincronización en cola.
                </div>
              ) : (
                <div className="divide-y divide-[#222222]">
                  {syncJobs.slice(0, 6).map((job) => (
                    <div key={job.jobId} className="py-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-white">{job.contractId.slice(0, 14)}</span>
                        <span className="text-[#888888] tabular-nums">
                          Intentos: {job.attempts}
                        </span>
                      </div>
                      <SyncStatus
                        status={job.status}
                        lastSyncAt={job.lastAttemptAt}
                        errorMessage={job.errorMessage}
                      />
                    </div>
                  ))}
                </div>
              )}
            </DashboardCard>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
