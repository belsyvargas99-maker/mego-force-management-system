import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Factory, Layers, Lock, Plus, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { EmptyState } from '../components/EmptyState';
import { ExportMenu } from '../components/ExportMenu';
import { LoadingState } from '../components/LoadingState';
import { StatsCard } from '../components/StatsCard';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import { createProductionOrderFromContract } from '../services/productionOrdersService';
import { PRODUCTION_ORDER_STATUS_META } from '../utils/productionOrders';
import { calculateProductionSummary } from '../utils/sizeEngine';

export function AdminProductionPage() {
  const { id: contractIdParam } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { contracts, registrations, productionOrders, settings, loading } = useAdminData();
  const [selectedContractId, setSelectedContractId] = useState<string>(contractIdParam || 'all');
  const [creatingOrder, setCreatingOrder] = useState(false);

  const activeContractId = contractIdParam || selectedContractId;
  const targetContract =
    activeContractId !== 'all'
      ? contracts.find((c) => c.contractId === activeContractId)
      : undefined;

  const targetRegs = useMemo(
    () =>
      registrations.filter(
        (r) =>
          r.registrationStatus !== 'cancelled' &&
          (activeContractId === 'all' || r.contractId === activeContractId)
      ),
    [registrations, activeContractId]
  );

  const scopedOrders = useMemo(
    () =>
      activeContractId === 'all'
        ? productionOrders
        : productionOrders.filter((o) => o.contractId === activeContractId),
    [productionOrders, activeContractId]
  );

  const sizes = targetContract?.availableSizes || settings.defaultSizes;
  const summary = useMemo(
    () => calculateProductionSummary(targetRegs, sizes),
    [targetRegs, sizes]
  );

  const exportMeta = targetContract || {
    contractCode: 'PRODUCCION-GLOBAL',
    title: 'Consolidado General de Producción',
    organizationName: 'MEGO FORCE',
    availableSizes: sizes,
  };

  const handleGenerateOrder = async () => {
    const chosenContract = targetContract || contracts[0];
    if (!chosenContract) {
      toast.error('No hay contratos disponibles para generar orden.');
      return;
    }
    const chosenRegs = registrations.filter(
      (r) =>
        r.contractId === chosenContract.contractId &&
        r.registrationStatus !== 'cancelled'
    );
    if (chosenRegs.length === 0) {
      toast.error(`El contrato ${chosenContract.contractCode} no tiene participantes confirmados.`);
      return;
    }
    setCreatingOrder(true);
    try {
      const order = await createProductionOrderFromContract(
        chosenContract,
        chosenRegs,
        `Orden generada desde PRODUCCIÓN MEGO FORCE (${chosenContract.contractCode})`,
        {
          uid: user?.uid || 'admin',
          email: user?.email || 'admin@megoforce.com',
          displayName: user?.displayName || user?.email || 'Administrador',
        }
      );
      toast.success(`Orden ${order.orderCode} creada.`);
      navigate(`/admin/production/${order.orderId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al generar orden de fabricación.');
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <AdminLayout
      title={targetContract ? `Producción · ${targetContract.contractCode}` : 'PRODUCCIÓN MEGO FORCE'}
      breadcrumb="Órdenes de Fabricación y Tallaje Oficial"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {contractIdParam ? (
            <Link
              to={`/admin/contracts/${contractIdParam}`}
              className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al contrato
            </Link>
          ) : (
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              aria-label="Seleccionar contrato para producción"
              className="h-10 px-3 bg-[#141414] border border-[#292929] rounded-md text-sm text-white max-w-md outline-none"
            >
              <option value="all">Todos los contratos activos</option>
              {contracts.map((c) => (
                <option key={c.contractId} value={c.contractId}>
                  {c.contractCode} · {c.title}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {targetContract && (
              <button
                type="button"
                disabled={creatingOrder || targetRegs.length === 0}
                onClick={handleGenerateOrder}
                className="h-10 px-4 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-40 text-white text-xs sm:text-sm font-semibold rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {creatingOrder ? 'Generando...' : 'Nueva Orden de Fabricación'}
              </button>
            )}
            <ExportMenu
              contract={exportMeta}
              registrations={targetRegs}
              options={{ scope: 'all' }}
            />
          </div>
        </div>

        {/* Module 3: Formal Production Orders List (Screen #17) */}
        <DashboardCard
          title="Órdenes de Fabricación MEGO FORCE"
          subtitle="Snapshots versionados e inmutables al aprobar para planta"
          action={<Factory className="w-4 h-4 text-[#ED1010]" />}
        >
          {loading ? (
            <LoadingState label="Cargando órdenes de fabricación..." rows={3} />
          ) : scopedOrders.length === 0 ? (
            <p className="text-xs text-[#888888] py-3">
              Aún no se han generado órdenes de fabricación{targetContract ? ' para este contrato' : ''}. Selecciona un contrato arriba y haz clic en “Nueva Orden de Fabricación”.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scopedOrders.map((ord) => {
                const st =
                  PRODUCTION_ORDER_STATUS_META[ord.status] || PRODUCTION_ORDER_STATUS_META.draft;
                return (
                  <Link
                    key={ord.orderId}
                    to={`/admin/production/${ord.orderId}`}
                    className="block bg-[#0B0B0B] border border-[#292929] hover:border-[#ED1010] rounded-lg p-4 space-y-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs text-[#ED1010] font-semibold">
                          {ord.orderCode}
                        </span>
                        <h3 className="text-sm font-bold text-white mt-0.5 line-clamp-1">
                          {ord.contractTitle}
                        </h3>
                        <p className="text-xs text-[#888888]">{ord.organizationName}</p>
                      </div>
                      {ord.isFrozen && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#4ADE80]/15 text-[#4ADE80] rounded text-[10px] font-bold uppercase shrink-0">
                          <Lock className="w-3 h-3" />
                          v{ord.version}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-[#222222] pt-2.5">
                      <span className={`font-semibold uppercase ${st.colorClass}`}>{st.label}</span>
                      <span className="font-mono text-white font-bold">
                        {ord.totalGarments} prendas
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#888888]">
                      <span>Resp: {ord.responsibleName}</span>
                      <span className="text-white inline-flex items-center gap-1">
                        Ver matriz <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </DashboardCard>

        {loading ? (
          <LoadingState label="Calculando resumen en vivo por tallas..." rows={4} />
        ) : targetRegs.length === 0 ? (
          <EmptyState
            title="Sin prendas pendientes de fabricación"
            description="Los totales por talla y personalizaciones aparecerán automáticamente en cuanto ingresen participantes."
            icon={<Layers className="w-6 h-6" />}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                label="Total Prendas a Fabricar"
                value={summary.totalGarments}
                accent="red"
              />
              <StatsCard
                label="Personalizaciones (Seudónimo)"
                value={summary.customNicknamesCount}
              />
              <StatsCard
                label="Pagos Verificados"
                value={summary.verifiedPayments}
                accent="green"
              />
              <StatsCard
                label="Pendientes Verificación"
                value={summary.pendingVerifications}
                accent="amber"
              />
            </div>

            <DashboardCard
              title="Cantidades por Talla para Corte y Sublimación"
              subtitle="Agrupación automática respetando el orden de tallas configurado"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {summary.groups.map((g) => (
                  <div
                    key={g.size}
                    className="bg-[#0B0B0B] border border-[#292929] rounded-md p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-lg font-bold text-white">{g.size}</span>
                      <span className="font-mono text-xs text-[#ED1010] tabular-nums">
                        {g.percentage}%
                      </span>
                    </div>
                    <p className="font-display text-3xl font-bold text-white tabular-nums">
                      {g.count}
                    </p>
                    <div className="h-1.5 bg-[#1C1C1C] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#ED1010]"
                        style={{ width: `${Math.min(100, g.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </DashboardCard>

            <DashboardCard
              title="Listado de Personalización por Talla"
              subtitle="Orden cronológico interno dentro de cada bloque de talla"
            >
              <div className="space-y-6">
                {summary.groups
                  .filter((g) => g.count > 0)
                  .map((g) => (
                    <div key={g.size} className="space-y-2">
                      <h4 className="font-display text-base uppercase text-[#ED1010]">
                        Talla {g.size} · {g.count} unidad(es)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {g.registrations.map((r, idx) => (
                          <div
                            key={r.registrationId}
                            className="p-3 bg-[#0B0B0B] border border-[#292929] rounded flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">
                                {idx + 1}. {r.nickname || '(Sin seudónimo)'}
                              </p>
                              <p className="text-[#888888] truncate">{r.fullName}</p>
                            </div>
                            <span className="font-display font-bold text-sm text-white shrink-0">
                              {r.size}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </DashboardCard>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
