import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Layers,
  GitBranch,
  AlertTriangle,
  History,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { StatsCard } from '../components/StatsCard';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import {
  exportProductionOrderExcel,
  exportProductionOrderPdf,
} from '../services/exportService';
import {
  approveAndFreezeProductionOrder,
  createNewVersionOfProductionOrder,
  subscribeProductionOrderById,
  updateProductionOrderProgress,
} from '../services/productionOrdersService';
import type { ProductionOrder, ProductionOrderStatus } from '../types/mego';
import {
  detectOrderParticipantChanges,
  PRODUCTION_ORDER_STATUS_META,
} from '../utils/productionOrders';

export function AdminProductionOrderDetailPage() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { contracts, registrations } = useAdminData();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [observationsDraft, setObservationsDraft] = useState('');
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    const unsub = subscribeProductionOrderById(orderId, (ord) => {
      setOrder(ord);
      if (ord) setObservationsDraft(ord.observations || '');
      setLoading(false);
    });
    return () => unsub();
  }, [orderId]);

  const contract = useMemo(
    () => (order ? contracts.find((c) => c.contractId === order.contractId) : undefined),
    [contracts, order]
  );

  const contractRegs = useMemo(
    () =>
      order
        ? registrations.filter(
            (r) => r.contractId === order.contractId && r.registrationStatus !== 'cancelled'
          )
        : [],
    [registrations, order]
  );

  const participantDiff = useMemo(
    () => (order ? detectOrderParticipantChanges(order, contractRegs) : null),
    [order, contractRegs]
  );

  if (loading) {
    return (
      <AdminLayout title="Detalle de Orden de Fabricación" breadcrumb="PRODUCCIÓN MEGO FORCE">
        <LoadingState label="Cargando orden de fabricación..." rows={5} />
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout title="Orden no encontrada" breadcrumb="PRODUCCIÓN MEGO FORCE">
        <ErrorState message="No se encontró la orden de fabricación solicitada." />
      </AdminLayout>
    );
  }

  const adminInfo = {
    uid: user?.uid || 'admin',
    email: user?.email || 'admin@megoforce.com',
    displayName: user?.displayName || user?.email || 'Administrador',
  };

  const statusMeta =
    PRODUCTION_ORDER_STATUS_META[order.status] || PRODUCTION_ORDER_STATUS_META.draft;

  const handleStatusChange = async (nextStatus: ProductionOrderStatus) => {
    setBusy(true);
    try {
      if (nextStatus === 'approved' && !order.isFrozen) {
        await approveAndFreezeProductionOrder(order, adminInfo);
        toast.success('Orden aprobada y congelada de forma inmutable.');
      } else {
        await updateProductionOrderProgress(
          order,
          { status: nextStatus, observations: observationsDraft },
          adminInfo
        );
        toast.success(`Estado actualizado a ${PRODUCTION_ORDER_STATUS_META[nextStatus].label}.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar estado.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveObservations = async () => {
    setBusy(true);
    try {
      await updateProductionOrderProgress(order, { observations: observationsDraft }, adminInfo);
      toast.success('Observaciones guardadas.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar observaciones.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!contract) {
      toast.error('Contrato base no disponible para generar nueva versión.');
      return;
    }
    setBusy(true);
    try {
      const nextOrd = await createNewVersionOfProductionOrder(
        order,
        contract,
        contractRegs,
        newVersionNotes,
        adminInfo
      );
      toast.success(`Nueva versión v${nextOrd.version} creada (${nextOrd.orderCode}).`);
      navigate(`/admin/production/${nextOrd.orderId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear nueva versión.');
    } finally {
      setBusy(false);
    }
  };

  const sizes = order.availableSizes?.length
    ? order.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  return (
    <AdminLayout
      title={`${order.orderCode} · v${order.version}`}
      breadcrumb={`PRODUCCIÓN MEGO FORCE / ${order.contractCode}`}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/admin/production"
            className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Todas las órdenes de producción
          </Link>

          {/* 4 Required Production Exports */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportProductionOrderPdf(order, 'full')}
              className="h-9 px-3 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF de Producción
            </button>
            <button
              type="button"
              onClick={() => exportProductionOrderExcel(order)}
              className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#4ADE80]" />
              Excel de Producción
            </button>
            <button
              type="button"
              onClick={() => exportProductionOrderPdf(order, 'by_size')}
              className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              PDF Agrupado por Tallas
            </button>
            <button
              type="button"
              onClick={() => exportProductionOrderPdf(order, 'customizations')}
              className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#38BDF8]" />
              Listado Personalizaciones
            </button>
          </div>
        </div>

        {/* Immutability & Participant Change Banner */}
        {order.isFrozen && (
          <div className="bg-[#0B1726] border border-[#38BDF8]/40 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#38BDF8] shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-white">
                  Orden Aprobada e Inmutable (v{order.version}) — Aprobada por {order.approvedByEmail}
                </p>
                <p className="text-[#B5B5B5]">
                  Los datos de fabricación de esta orden están congelados. Cambios posteriores en participantes nunca alteran esta versión.
                </p>
              </div>
            </div>
          </div>
        )}

        {participantDiff?.hasChanges && contract && (
          <div className="bg-[#D97706]/10 border border-[#D97706]/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#FBBF24] shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold text-white">
                  Cambios detectados en participantes desde la generación de esta orden
                </p>
                <p className="text-[#FDE68A]">{participantDiff.summaryText}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newVersionNotes}
                onChange={(e) => setNewVersionNotes(e.target.value)}
                placeholder="Describe el motivo de la nueva versión (opcional)..."
                className="flex-1 h-9 px-3 bg-[#080808] border border-[#292929] rounded text-xs text-white"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleCreateNewVersion}
                className="h-9 px-4 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Crear Nueva Versión (v{order.version + 1})
              </button>
            </div>
          </div>
        )}

        {/* Order Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard label="Total Prendas" value={order.totalGarments} accent="red" />
          <StatsCard
            label="Versión"
            value={`v${order.version}`}
            sublabel={order.isFrozen ? 'Snapshot Congelado' : 'Editable hasta aprobar'}
          />
          <StatsCard
            label="Estado Actual"
            value={statusMeta.label}
            sublabel={`Responsable: ${order.responsibleName}`}
            accent="green"
          />
          <StatsCard
            label="Organización"
            value={order.organizationName}
            sublabel={`${order.contractCode} · ${order.garmentType}`}
          />
        </div>

        {/* Status Progression & Observations */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <DashboardCard
            title="Flujo de Estado de Fabricación"
            subtitle="Al aprobar la orden, el listado queda congelado de manera inmutable"
            className="lg:col-span-6"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRODUCTION_ORDER_STATUS_META) as ProductionOrderStatus[]).map(
                  (st) => {
                    const meta = PRODUCTION_ORDER_STATUS_META[st];
                    const active = order.status === st;
                    const disabled =
                      busy || (order.isFrozen && (st === 'draft' || st === 'in_review'));
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleStatusChange(st)}
                        className={`h-9 px-3 rounded text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-[#ED1010] border-[#ED1010] text-white'
                            : 'bg-[#0B0B0B] border-[#292929] text-[#B5B5B5] hover:text-white disabled:opacity-30'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  }
                )}
              </div>

              {!order.isFrozen && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatusChange('approved')}
                  className="w-full h-10 bg-white hover:bg-neutral-200 text-[#080808] text-xs font-bold uppercase tracking-wider rounded-md inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  Aprobar y Congelar Versión Inmutable
                </button>
              )}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Observaciones de Planta y Confección"
            subtitle="Notas técnicas para corte, sublimación y empaque"
            className="lg:col-span-6"
          >
            <div className="space-y-3">
              <textarea
                rows={3}
                value={observationsDraft}
                onChange={(e) => setObservationsDraft(e.target.value)}
                className="w-full p-3 bg-[#080808] border border-[#292929] rounded text-xs text-white outline-none focus:border-[#ED1010]"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveObservations}
                  className="h-9 px-4 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar Observaciones
                </button>
              </div>
            </div>
          </DashboardCard>
        </div>

        {/* Automatic Size Distribution Summary */}
        <DashboardCard
          title="Resumen Automático de Cantidades por Talla"
          subtitle="Distribución exacta congelada en esta orden"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {sizes.map((sz) => {
              const count = order.sizeSummary[sz] || 0;
              return (
                <div
                  key={sz}
                  className="bg-[#0B0B0B] border border-[#292929] rounded-md p-3.5 text-center space-y-1"
                >
                  <p className="font-display text-base text-[#888888]">{sz}</p>
                  <p className="font-display text-3xl font-bold text-white tabular-nums">
                    {count}
                  </p>
                </div>
              );
            })}
          </div>
        </DashboardCard>

        {/* Individual Customization List */}
        <DashboardCard
          title="Listado Individual de Fabricación y Personalizaciones"
          subtitle={`${order.snapshotItems.length} prenda(s) registradas en esta orden`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#292929] bg-[#0B0B0B] text-[#888888] uppercase">
                  <th className="p-3">#</th>
                  <th className="p-3">Participante</th>
                  <th className="p-3">Talla</th>
                  <th className="p-3">Seudónimo</th>
                  <th className="p-3">Tipo de Prenda</th>
                  <th className="p-3">Observaciones de Personalización</th>
                  <th className="p-3">Modo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {order.snapshotItems.map((it, idx) => (
                  <tr key={it.registrationId} className="hover:bg-[#191919]">
                    <td className="p-3 font-mono text-[#888888]">{idx + 1}</td>
                    <td className="p-3 font-medium text-white">{it.fullName}</td>
                    <td className="p-3">
                      <span className="font-display font-bold px-2 py-0.5 bg-[#1C1C1C] border border-[#292929] rounded text-white">
                        {it.size}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-[#ED1010]">{it.nickname || '-'}</td>
                    <td className="p-3 text-[#D4D4D4]">{it.garmentType}</td>
                    <td className="p-3 text-[#B5B5B5]">{it.customizationNotes}</td>
                    <td className="p-3 uppercase text-[11px] font-mono text-[#888888]">
                      {it.registrationMode === 'bulk' ? 'Masivo' : 'Individual'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        {/* Version History */}
        <DashboardCard
          title="Historial de Versiones y Aprobaciones"
          action={<History className="w-4 h-4 text-[#888888]" />}
        >
          <div className="space-y-2.5">
            {[...order.versionHistory].reverse().map((v, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#0B0B0B] border border-[#222222] rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#ED1010]">v{v.version}</span>
                    <span className="font-semibold text-white uppercase">{v.action}</span>
                    <span className="text-[#888888]">· {v.totalGarments} prendas</span>
                  </div>
                  <p className="text-[#CCCCCC]">{v.changesSummary}</p>
                </div>
                <div className="text-right font-mono text-[11px] text-[#888888] shrink-0">
                  <p className="text-white">{v.createdByEmail}</p>
                  <p>{new Date(v.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </AdminLayout>
  );
}
