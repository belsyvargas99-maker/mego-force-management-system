import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, RefreshCw, ExternalLink, Factory } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { EmptyState } from '../components/EmptyState';
import { ExportMenu } from '../components/ExportMenu';
import { LoadingState } from '../components/LoadingState';
import { SyncStatus } from '../components/SyncStatus';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import {
  exportProductionOrderExcel,
  exportProductionOrderPdf,
} from '../services/exportService';
import {
  createSpreadsheetForContract,
  syncContractToGoogleSheets,
} from '../services/sheetsSyncService';
import type { Contract, SyncJob } from '../types/mego';
import { PRODUCTION_ORDER_STATUS_META } from '../utils/productionOrders';

export function AdminExportsPage() {
  const { user, hasGoogleSheetsToken, reconnectSheets } = useAuth();
  const { contracts, registrations, productionOrders, syncJobs, settings, loading } =
    useAdminData();

  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [scope, setScope] = useState<'all' | 'size' | 'production_summary'>('all');
  const [specificSize, setSpecificSize] = useState<string>('M');
  const [busyId, setBusyId] = useState<string | null>(null);

  const selectedContract =
    contracts.find((c) => c.contractId === selectedContractId) || contracts[0];

  const scopedRegistrations = useMemo(() => {
    if (!selectedContract) return [];
    return registrations.filter(
      (r) =>
        r.contractId === selectedContract.contractId &&
        r.registrationStatus !== 'cancelled'
    );
  }, [registrations, selectedContract]);

  const adminInfo = {
    uid: user?.uid || 'admin',
    email: user?.email || 'admin@megoforce.com',
  };

  const handleSyncContract = async (contract: Contract, job?: SyncJob) => {
    if (!hasGoogleSheetsToken) {
      const ok = await reconnectSheets();
      if (!ok) return;
    }
    setBusyId(job?.jobId || contract.contractId);
    try {
      if (!contract.sheetsConfig?.spreadsheetId) {
        await createSpreadsheetForContract(contract, adminInfo);
      }
      const cRegs = registrations.filter(
        (r) => r.contractId === contract.contractId && r.registrationStatus !== 'cancelled'
      );
      const res = await syncContractToGoogleSheets(contract, cRegs, adminInfo, job);
      if (res.synced) {
        toast.success(`Sincronizado (${res.totalRows} registros).`);
      } else {
        toast.error(res.errorMessage || 'Fallo al sincronizar con Google Sheets.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error en Google Sheets.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout
      title="Exportaciones y Google Sheets"
      breadcrumb="Excel (.xlsx), PDF Producción y Cola de Sincronización"
    >
      {loading ? (
        <LoadingState label="Cargando contratos y cola de sincronización..." rows={5} />
      ) : contracts.length === 0 ? (
        <EmptyState
          title="Sin contratos para exportar"
          description="Crea un contrato primero para generar archivos Excel multi-pestaña, PDFs de producción o sincronizar con Google Sheets."
        />
      ) : (
        <div className="space-y-6">
          {/* Excel & PDF Export Builder */}
          <DashboardCard
            title="Generador de Exportaciones Excel y PDF"
            subtitle="Incluye hoja general cronológica, hojas por talla y resumen de fabricación"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="space-y-1">
                <label className="text-xs text-[#B5B5B5]">Contrato a exportar</label>
                <select
                  value={selectedContract?.contractId || ''}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                >
                  {contracts.map((c) => (
                    <option key={c.contractId} value={c.contractId}>
                      {c.contractCode} · {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#B5B5B5]">Alcance de exportación</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                >
                  <option value="all">Todo el contrato (General + Tallas + Resumen)</option>
                  <option value="size">Una talla específica</option>
                  <option value="production_summary">Solo Resumen de Producción</option>
                </select>
              </div>

              {scope === 'size' && (
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Talla específica</label>
                  <select
                    value={specificSize}
                    onChange={(e) => setSpecificSize(e.target.value)}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                  >
                    {(selectedContract?.availableSizes || settings.defaultSizes).map((s) => (
                      <option key={s} value={s}>
                        Talla {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedContract && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#292929]">
                <p className="text-xs text-[#888888] tabular-nums">
                  Registros confirmados en este contrato:{' '}
                  <strong className="text-white">{scopedRegistrations.length}</strong>
                </p>
                <ExportMenu
                  contract={selectedContract}
                  registrations={scopedRegistrations}
                  options={{ scope, specificSize: scope === 'size' ? specificSize : undefined }}
                />
              </div>
            )}
          </DashboardCard>

          {/* Module 3: 4 Production Order Exports */}
          <DashboardCard
            title="Exportaciones de Órdenes de Producción MEGO FORCE"
            subtitle="PDF de Producción, Excel de Producción, PDF por Tallas y Listado de Personalizaciones"
            action={<Factory className="w-4 h-4 text-[#ED1010]" />}
          >
            {productionOrders.length === 0 ? (
              <p className="text-xs text-[#888888] py-3">
                Genera una Orden de Fabricación en Producción Mego Force para descargar sus formatos oficiales de planta.
              </p>
            ) : (
              <div className="divide-y divide-[#222222]">
                {productionOrders.map((ord) => {
                  const meta =
                    PRODUCTION_ORDER_STATUS_META[ord.status] || PRODUCTION_ORDER_STATUS_META.draft;
                  return (
                    <div
                      key={ord.orderId}
                      className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-[#ED1010] font-semibold">
                            {ord.orderCode}
                          </span>
                          <span className="text-xs text-[#888888]">·</span>
                          <span className="text-sm font-semibold text-white">
                            {ord.contractTitle}
                          </span>
                          <span className={`text-[11px] uppercase font-semibold ${meta.colorClass}`}>
                            ({meta.label})
                          </span>
                        </div>
                        <p className="text-xs text-[#888888]">
                          {ord.organizationName} · {ord.totalGarments} prendas · Versión v
                          {ord.version}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => exportProductionOrderExcel(ord)}
                          className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#4ADE80]" />
                          Excel Producción
                        </button>
                        <button
                          type="button"
                          onClick={() => exportProductionOrderPdf(ord, 'full')}
                          className="h-9 px-3 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          PDF Producción
                        </button>
                        <button
                          type="button"
                          onClick={() => exportProductionOrderPdf(ord, 'by_size')}
                          className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#38BDF8]" />
                          PDF por Tallas
                        </button>
                        <button
                          type="button"
                          onClick={() => exportProductionOrderPdf(ord, 'customizations')}
                          className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#FBBF24]" />
                          Personalizaciones
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>

          {/* Google Sheets per-contract sync status */}
          <DashboardCard
            title="Hojas de Google Sheets por Contrato"
            subtitle="Pestañas automáticas: TODOS LOS REGISTROS, tallas activas y RESUMEN"
            action={
              !hasGoogleSheetsToken && (
                <button
                  type="button"
                  onClick={() => reconnectSheets()}
                  className="h-9 px-3.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Conectar Google Sheets
                </button>
              )
            }
          >
            <div className="divide-y divide-[#222222]">
              {contracts.map((c) => {
                const isBusy = busyId === c.contractId;
                return (
                  <div
                    key={c.contractId}
                    className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#ED1010]">{c.contractCode}</span>
                        <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                      </div>
                      <SyncStatus
                        status={c.sheetsConfig?.lastSyncStatus || 'pending'}
                        lastSyncAt={c.sheetsConfig?.lastSyncAt}
                        errorMessage={c.sheetsConfig?.lastError}
                      />
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {c.sheetsConfig?.spreadsheetUrl && (
                        <a
                          href={c.sheetsConfig.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-xs text-white rounded inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir Sheet
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSyncContract(c)}
                        className="h-9 px-3.5 bg-[#292929] hover:bg-[#383838] disabled:opacity-50 text-xs font-medium text-white rounded inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                        {c.sheetsConfig?.spreadsheetId ? 'Sincronizar' : 'Crear y Sincronizar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DashboardCard>

          {/* Sync Queue Jobs */}
          <DashboardCard
            title="Cola de Eventos y Reintentos"
            subtitle="Los registros en Firestore siempre se conservan aunque Google Sheets esté desconectado"
          >
            {syncJobs.length === 0 ? (
              <p className="text-sm text-[#888888]">Sin eventos de sincronización registrados.</p>
            ) : (
              <div className="divide-y divide-[#222222]">
                {syncJobs.slice(0, 15).map((job) => {
                  const ctr = contracts.find((c) => c.contractId === job.contractId);
                  return (
                    <div
                      key={job.jobId}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-white font-medium">
                          {ctr ? `${ctr.contractCode} · ${ctr.title}` : job.contractId}
                        </p>
                        <SyncStatus
                          status={job.status}
                          lastSyncAt={job.lastAttemptAt || job.createdAt}
                          errorMessage={job.errorMessage}
                        />
                      </div>

                      {ctr && job.status !== 'synced' && (
                        <button
                          type="button"
                          disabled={busyId === job.jobId}
                          onClick={() => handleSyncContract(ctr, job)}
                          className="h-8 px-3 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-white text-xs font-semibold rounded inline-flex items-center gap-1.5 self-start sm:self-auto"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${busyId === job.jobId ? 'animate-spin' : ''}`}
                          />
                          Reintentar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>
        </div>
      )}
    </AdminLayout>
  );
}
