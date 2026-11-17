import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Edit3,
  Users,
  Layers,
  FileSpreadsheet,
  Upload,
  CalendarClock,
  UsersRound,
  Factory,
  RefreshCw,
  ShieldOff,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { ErrorState } from '../components/ErrorState';
import { ExportMenu } from '../components/ExportMenu';
import { ImageGallery } from '../components/ImageGallery';
import { ImportModal } from '../components/ImportModal';
import { LoadingState } from '../components/LoadingState';
import { StatsCard } from '../components/StatsCard';
import { SyncStatus } from '../components/SyncStatus';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import {
  reopenOrExtendContractSchedule,
  rotateOrRevokeContractLink,
  updateContract,
} from '../services/contractsService';
import { createProductionOrderFromContract } from '../services/productionOrdersService';
import {
  createSpreadsheetForContract,
  syncContractToGoogleSheets,
} from '../services/sheetsSyncService';
import type { ContractStatus } from '../types/mego';
import {
  CONTRACT_STATUS_META,
  formatWindowDisplay,
  SUPPORTED_TIMEZONES,
} from '../utils/contractSchedule';
import { calculateProductionSummary } from '../utils/sizeEngine';
import { publicUrl as buildClientUrl } from '../config/appMode';

export function AdminContractDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasGoogleSheetsToken, reconnectSheets } = useAuth();
  const { contracts, registrations, bulkSubmissions, productionOrders, loading } = useAdminData();
  const [syncing, setSyncing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [confirmRevokeMode, setConfirmRevokeMode] = useState<'individual' | 'bulk' | null>(null);
  const [indivExpiryDraft, setIndivExpiryDraft] = useState<string | null>(null);
  const [bulkExpiryDraft, setBulkExpiryDraft] = useState<string | null>(null);
  const [expandedBulkSubId, setExpandedBulkSubId] = useState<string | null>(null);

  const contract = contracts.find((c) => c.contractId === id);

  const [nextStatus, setNextStatus] = useState<ContractStatus>('active');
  const [nextOpenDate, setNextOpenDate] = useState('');
  const [nextOpenTime, setNextOpenTime] = useState('00:00');
  const [nextCloseDate, setNextCloseDate] = useState('');
  const [nextCloseTime, setNextCloseTime] = useState('23:59');
  const [nextTimezone, setNextTimezone] = useState('America/Caracas');
  const [nextClosedMsg, setNextClosedMsg] = useState('');
  const [changeReason, setChangeReason] = useState('');

  const contractRegs = useMemo(
    () =>
      registrations.filter(
        (r) => r.contractId === id && r.registrationStatus !== 'cancelled'
      ),
    [registrations, id]
  );

  const contractBulkSubs = useMemo(
    () => bulkSubmissions.filter((b) => b.contractId === id),
    [bulkSubmissions, id]
  );

  const contractOrders = useMemo(
    () => productionOrders.filter((o) => o.contractId === id),
    [productionOrders, id]
  );

  const summary = useMemo(
    () =>
      contract
        ? calculateProductionSummary(contractRegs, contract.availableSizes)
        : null,
    [contract, contractRegs]
  );

  if (loading) {
    return (
      <AdminLayout title="Detalle de Contrato" breadcrumb="Contratos">
        <LoadingState label="Cargando contrato..." rows={5} />
      </AdminLayout>
    );
  }

  if (!contract || !summary) {
    return (
      <AdminLayout title="Contrato no encontrado" breadcrumb="Contratos">
        <ErrorState message="No se encontró el contrato solicitado." />
      </AdminLayout>
    );
  }

  const indivEnabled = contract.individualRegistrationEnabled !== false;
  const bulkEnabled = Boolean(contract.bulkRegistrationEnabled);
  const publicUrl = buildClientUrl(`/registro/${contract.publicToken}`);
  const bulkUrl = contract.bulkToken
    ? buildClientUrl(`/registro-masivo/${contract.bulkToken}`)
    : '';
  const statusMeta = CONTRACT_STATUS_META[contract.status] || CONTRACT_STATUS_META.draft;
  const adminInfo = {
    uid: user?.uid || 'admin',
    email: user?.email || 'admin@megoforce.com',
    displayName: user?.displayName || user?.email || 'Administrador',
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const openScheduleModal = () => {
    setNextStatus(
      contract.status === 'auto_closed' || contract.status === 'closed'
        ? 'active'
        : contract.status
    );
    setNextOpenDate(contract.openDate || contract.startDate || '');
    setNextOpenTime(contract.openTime || '00:00');
    setNextCloseDate(contract.closeDate || contract.endDate || '');
    setNextCloseTime(contract.closeTime || '23:59');
    setNextTimezone(contract.timezone || 'America/Caracas');
    setNextClosedMsg(contract.closedMessage || '');
    setChangeReason('');
    setScheduleEditorOpen(true);
  };

  const handleSaveScheduleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    try {
      const action =
        nextStatus === 'active' &&
        (contract.status === 'closed' || contract.status === 'auto_closed')
          ? 'manual_reopened'
          : nextCloseDate !== contract.closeDate
            ? 'deadline_extended'
            : nextStatus === 'closed'
              ? 'manual_closed'
              : 'status_changed';

      await reopenOrExtendContractSchedule(
        contract,
        {
          status: nextStatus,
          openDate: nextOpenDate,
          openTime: nextOpenTime,
          closeDate: nextCloseDate,
          closeTime: nextCloseTime,
          timezone: nextTimezone,
          closedMessage: nextClosedMsg,
          action,
          reason:
            changeReason.trim() ||
            (action === 'manual_reopened'
              ? 'Reapertura manual de contrato'
              : action === 'deadline_extended'
                ? 'Extensión de plazo de registro'
                : 'Actualización de programación'),
        },
        adminInfo
      );
      toast.success('Programación y estado del contrato actualizados.');
      setScheduleEditorOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar programación.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSetModes = async (indiv: boolean, bulk: boolean) => {
    setLinkBusy('modes');
    try {
      await updateContract(
        contract.contractId,
        {
          individualRegistrationEnabled: indiv,
          bulkRegistrationEnabled: bulk,
        },
        adminInfo
      );
      toast.success('Modalidades de registro actualizadas.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudieron actualizar las modalidades.');
    } finally {
      setLinkBusy(null);
    }
  };

  const handleRotateOrRevoke = async (
    mode: 'individual' | 'bulk',
    action: 'regenerate' | 'revoke'
  ) => {
    setLinkBusy(`${mode}_${action}`);
    try {
      await rotateOrRevokeContractLink(contract, mode, action, adminInfo);
      setConfirmRevokeMode(null);
      toast.success(
        action === 'revoke'
          ? `Enlace ${mode === 'bulk' ? 'masivo' : 'individual'} revocado y deshabilitado.`
          : `Nuevo enlace ${mode === 'bulk' ? 'masivo' : 'individual'} generado; el anterior quedó invalidado.`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar el enlace.');
    } finally {
      setLinkBusy(null);
    }
  };

  const handleSaveLinkExpirations = async () => {
    setLinkBusy('expiry');
    try {
      await updateContract(
        contract.contractId,
        {
          individualLinkExpiresAt:
            indivExpiryDraft !== null ? indivExpiryDraft : contract.individualLinkExpiresAt || '',
          bulkLinkExpiresAt:
            bulkExpiryDraft !== null ? bulkExpiryDraft : contract.bulkLinkExpiresAt || '',
        },
        adminInfo
      );
      toast.success('Fechas de expiración de enlaces guardadas.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la expiración de enlaces.');
    } finally {
      setLinkBusy(null);
    }
  };

  const handleCreateOrder = async () => {
    if (contractRegs.length === 0) {
      toast.error('Este contrato aún no tiene participantes confirmados.');
      return;
    }
    setCreatingOrder(true);
    try {
      const order = await createProductionOrderFromContract(
        contract,
        contractRegs,
        `Generada desde contrato ${contract.contractCode}`,
        adminInfo
      );
      toast.success(`Orden ${order.orderCode} generada.`);
      navigate(`/admin/production/${order.orderId}`);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo generar la orden.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleSheetsAction = async () => {
    if (!hasGoogleSheetsToken) {
      const ok = await reconnectSheets();
      if (!ok) return;
    }
    setSyncing(true);
    try {
      if (!contract.sheetsConfig?.spreadsheetId) {
        await createSpreadsheetForContract(contract, adminInfo);
        toast.success('Hoja de cálculo de Google Sheets creada. Sincronizando datos...');
      }
      const res = await syncContractToGoogleSheets(contract, contractRegs, adminInfo);
      if (res.synced) {
        toast.success(`Sincronizado con Google Sheets (${res.totalRows} registros).`);
      } else {
        toast.error(res.errorMessage || 'Error en sincronización.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error al operar con Google Sheets.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AdminLayout title={contract.title} breadcrumb={`Contratos / ${contract.contractCode}`}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/admin/contracts"
            className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Todos los contratos
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={creatingOrder || contractRegs.length === 0}
              className="h-9 px-3.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#ED1010]/60 disabled:opacity-40 text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5"
            >
              <Factory className="w-3.5 h-3.5 text-[#ED1010]" />
              {creatingOrder ? 'Generando...' : 'Generar Orden de Fabricación'}
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="h-9 px-3.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar Excel/Word
            </button>
            <Link
              to={`/admin/contracts/${contract.contractId}/registrations`}
              className="h-9 px-3.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Participantes ({contractRegs.length})
            </Link>
            <Link
              to={`/admin/contracts/${contract.contractId}/production`}
              className="h-9 px-3.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Órdenes ({contractOrders.length})
            </Link>
            <Link
              to="/admin/mockups"
              className="h-9 px-3.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded-md inline-flex items-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#ED1010]" />
              Presentación y Prenda
            </Link>
            <Link
              to={`/admin/contracts/${contract.contractId}/edit`}
              className="h-9 px-3.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar y Formulario
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard label="Participantes" value={summary.totalGarments} accent="red" />
          <StatsCard label="Pagos Completos" value={summary.fullPaymentsDeclared} />
          <StatsCard label="Pagos Verificados" value={summary.verifiedPayments} accent="green" />
          <StatsCard
            label="Sesiones Masivas Org."
            value={contractBulkSubs.length}
            sublabel={`${contractRegs.filter((r) => r.registrationMode === 'bulk').length} registros masivos`}
            accent="amber"
          />
        </div>

        {/* Official V2.1 Registration Configuration & Schedule Window */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard
            title="CONFIGURACIÓN DE REGISTROS"
            subtitle="Control independiente de portales públicos Individual y Masivo"
          >
            <div className="space-y-5">
              {/* 4-Mode Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={linkBusy !== null}
                  onClick={() => handleSetModes(true, false)}
                  className={`h-9 px-2.5 rounded text-xs font-semibold border transition-colors ${
                    indivEnabled && !bulkEnabled
                      ? 'bg-[#ED1010] border-[#ED1010] text-white'
                      : 'bg-[#0B0B0B] border-[#292929] text-[#B5B5B5] hover:text-white'
                  }`}
                >
                  Solo Individual
                </button>
                <button
                  type="button"
                  disabled={linkBusy !== null}
                  onClick={() => handleSetModes(false, true)}
                  className={`h-9 px-2.5 rounded text-xs font-semibold border transition-colors ${
                    !indivEnabled && bulkEnabled
                      ? 'bg-[#ED1010] border-[#ED1010] text-white'
                      : 'bg-[#0B0B0B] border-[#292929] text-[#B5B5B5] hover:text-white'
                  }`}
                >
                  Solo Masivo
                </button>
                <button
                  type="button"
                  disabled={linkBusy !== null}
                  onClick={() => handleSetModes(true, true)}
                  className={`h-9 px-2.5 rounded text-xs font-semibold border transition-colors ${
                    indivEnabled && bulkEnabled
                      ? 'bg-[#ED1010] border-[#ED1010] text-white'
                      : 'bg-[#0B0B0B] border-[#292929] text-[#B5B5B5] hover:text-white'
                  }`}
                >
                  Ambos Portales
                </button>
                <button
                  type="button"
                  disabled={linkBusy !== null}
                  onClick={() => handleSetModes(false, false)}
                  className={`h-9 px-2.5 rounded text-xs font-semibold border transition-colors ${
                    !indivEnabled && !bulkEnabled
                      ? 'bg-[#292929] border-[#888888] text-white'
                      : 'bg-[#0B0B0B] border-[#292929] text-[#B5B5B5] hover:text-white'
                  }`}
                >
                  Deshabilitar Ambos
                </button>
              </div>

              {/* Individual Public Portal Link */}
              <div className="space-y-2 p-3.5 bg-[#0B0B0B] border border-[#222222] rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#B5B5B5] font-semibold">
                    Portal Individual Público
                  </label>
                  <span
                    className={`text-[11px] font-semibold uppercase ${
                      indivEnabled ? 'text-[#4ADE80]' : 'text-[#F87171]'
                    }`}
                  >
                    {indivEnabled ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    aria-label="Enlace público individual"
                    className="flex-1 min-w-[200px] h-9 px-3 bg-[#080808] border border-[#292929] rounded text-xs font-mono text-white"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(publicUrl, 'Enlace individual copiado.')}
                    className="h-9 px-3 bg-[#292929] hover:bg-[#383838] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hola, compartimos el enlace oficial de ${contract.organizationName} — "${contract.title}" (Prenda oficial: ${contract.garmentType}). Regístrate aquí: ${publicUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-2.5 bg-[#16A34A]/20 hover:bg-[#16A34A]/30 border border-[#16A34A]/50 text-[#4ADE80] text-xs font-medium rounded inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(
                      `MEGO FORCE · ${contract.title} (${contract.garmentType})`
                    )}&body=${encodeURIComponent(
                      `Hola,\n\nTe compartimos el enlace de registro para ${contract.organizationName} (${contract.garmentType}):\n${publicUrl}`
                    )}`}
                    className="h-9 px-2.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs rounded inline-flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Correo
                  </a>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#888888]">Expira:</span>
                    <input
                      type="date"
                      aria-label="Expiración enlace individual"
                      value={
                        indivExpiryDraft !== null
                          ? indivExpiryDraft
                          : contract.individualLinkExpiresAt || ''
                      }
                      onChange={(e) => setIndivExpiryDraft(e.target.value)}
                      className="h-8 px-2 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={linkBusy !== null}
                      onClick={() => handleRotateOrRevoke('individual', 'regenerate')}
                      className="h-8 px-2.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] rounded text-[#D4D4D4] inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Regenerar
                    </button>
                    {confirmRevokeMode === 'individual' ? (
                      <button
                        type="button"
                        disabled={linkBusy !== null}
                        onClick={() => handleRotateOrRevoke('individual', 'revoke')}
                        className="h-8 px-2.5 bg-[#ED1010] text-white font-semibold rounded"
                      >
                        Confirmar Revocar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeMode('individual')}
                        className="h-8 px-2.5 bg-[#1C1C1C] hover:border-[#ED1010] border border-[#292929] rounded text-[#F87171] inline-flex items-center gap-1"
                      >
                        <ShieldOff className="w-3 h-3" />
                        Revocar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Public Bulk Organization Portal Link */}
              <div className="space-y-2 p-3.5 bg-[#0B0B0B] border border-[#222222] rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] uppercase tracking-wider text-[#B5B5B5] font-semibold inline-flex items-center gap-1.5">
                    <UsersRound className="w-3.5 h-3.5 text-[#ED1010]" />
                    Portal Masivo Público (Representantes)
                  </label>
                  <span
                    className={`text-[11px] font-semibold uppercase ${
                      bulkEnabled ? 'text-[#4ADE80]' : 'text-[#888888]'
                    }`}
                  >
                    {bulkEnabled ? 'Habilitado' : 'Deshabilitado'}
                  </span>
                </div>

                {bulkUrl ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={bulkUrl}
                      aria-label="Enlace especial para registro masivo"
                      className="flex-1 min-w-[200px] h-9 px-3 bg-[#080808] border border-[#292929] rounded text-xs font-mono text-white"
                    />
                    <button
                      type="button"
                      onClick={() => copyText(bulkUrl, 'Enlace masivo copiado.')}
                      className="h-9 px-3 bg-[#292929] hover:bg-[#383838] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </button>
                    <a
                      href={bulkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-3 bg-white hover:bg-neutral-200 text-[#080808] text-xs font-bold rounded inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir Masivo
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Hola, compartimos el enlace de registro masivo de ${contract.organizationName} para "${contract.title}" (Prenda oficial: ${contract.garmentType}): ${bulkUrl}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-2.5 bg-[#16A34A]/20 hover:bg-[#16A34A]/30 border border-[#16A34A]/50 text-[#4ADE80] text-xs font-medium rounded inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-[#888888]">
                    Genera un enlace para representantes habilitando el registro masivo.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#888888]">Expira:</span>
                    <input
                      type="date"
                      aria-label="Expiración enlace masivo"
                      value={
                        bulkExpiryDraft !== null
                          ? bulkExpiryDraft
                          : contract.bulkLinkExpiresAt || ''
                      }
                      onChange={(e) => setBulkExpiryDraft(e.target.value)}
                      className="h-8 px-2 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={linkBusy !== null}
                      onClick={() => handleRotateOrRevoke('bulk', 'regenerate')}
                      className="h-8 px-2.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] rounded text-[#D4D4D4] inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Regenerar
                    </button>
                    {confirmRevokeMode === 'bulk' ? (
                      <button
                        type="button"
                        disabled={linkBusy !== null}
                        onClick={() => handleRotateOrRevoke('bulk', 'revoke')}
                        className="h-8 px-2.5 bg-[#ED1010] text-white font-semibold rounded"
                      >
                        Confirmar Revocar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeMode('bulk')}
                        className="h-8 px-2.5 bg-[#1C1C1C] hover:border-[#ED1010] border border-[#292929] rounded text-[#F87171] inline-flex items-center gap-1"
                      >
                        <ShieldOff className="w-3 h-3" />
                        Revocar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {(indivExpiryDraft !== null || bulkExpiryDraft !== null) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={linkBusy !== null}
                    onClick={handleSaveLinkExpirations}
                    className="h-8 px-4 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded"
                  >
                    Guardar Expiración de Enlaces
                  </button>
                </div>
              )}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Ventana de Cierre Automático"
            subtitle="Control temporal y reapertura auditada"
            action={
              <button
                type="button"
                onClick={openScheduleModal}
                className="text-xs px-3 py-1.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white font-semibold rounded inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reabrir / Extender Plazo
              </button>
            }
          >
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-[#0B0B0B] border border-[#222222] rounded px-3 py-2">
                <span className="text-[#888888]">Estado actual:</span>
                <span className={`font-semibold uppercase ${statusMeta.colorClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#0B0B0B] border border-[#222222] rounded p-3">
                  <p className="text-[#888888]">Apertura programada</p>
                  <p className="font-mono text-white mt-1">
                    {formatWindowDisplay(
                      contract.openDate || contract.startDate,
                      contract.openTime,
                      contract.timezone
                    )}
                  </p>
                </div>
                <div className="bg-[#0B0B0B] border border-[#222222] rounded p-3">
                  <p className="text-[#888888]">Cierre programado</p>
                  <p className="font-mono text-white mt-1">
                    {formatWindowDisplay(
                      contract.closeDate || contract.endDate,
                      contract.closeTime,
                      contract.timezone
                    )}
                  </p>
                </div>
              </div>
              {contract.closedAt && (
                <div className="p-2.5 rounded bg-[#ED1010]/10 border border-[#ED1010]/30 text-[#F87171]">
                  Cerrado: {new Date(contract.closedAt).toLocaleString()} · Motivo:{' '}
                  {contract.closeReason || 'Vencimiento de plazo'}
                </div>
              )}
              {scheduleEditorOpen && (
                <form
                  onSubmit={handleSaveScheduleUpdate}
                  className="p-4 bg-[#0B0B0B] border border-[#292929] rounded-lg space-y-3 mt-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#888888]">Nuevo Estado</label>
                      <select
                        value={nextStatus}
                        onChange={(e) => setNextStatus(e.target.value as ContractStatus)}
                        className="w-full h-9 px-2 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                      >
                        {(Object.keys(CONTRACT_STATUS_META) as ContractStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {CONTRACT_STATUS_META[st].label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#888888]">Zona horaria</label>
                      <select
                        value={nextTimezone}
                        onChange={(e) => setNextTimezone(e.target.value)}
                        className="w-full h-9 px-2 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                      >
                        {SUPPORTED_TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#888888]">Fecha apertura</label>
                      <input
                        type="date"
                        value={nextOpenDate}
                        onChange={(e) => setNextOpenDate(e.target.value)}
                        className="w-full h-9 px-2 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#888888]">Hora apertura</label>
                      <input
                        type="time"
                        value={nextOpenTime}
                        onChange={(e) => setNextOpenTime(e.target.value)}
                        className="w-full h-9 px-2 bg-[#141414] border border-[#292929] rounded text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#888888]">Nueva fecha de cierre</label>
                      <input
                        type="date"
                        value={nextCloseDate}
                        onChange={(e) => setNextCloseDate(e.target.value)}
                        className="w-full h-9 px-2 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#888888]">Hora de cierre</label>
                      <input
                        type="time"
                        value={nextCloseTime}
                        onChange={(e) => setNextCloseTime(e.target.value)}
                        className="w-full h-9 px-2 bg-[#141414] border border-[#292929] rounded text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#888888]">Mensaje de cierre al visitante</label>
                    <input
                      type="text"
                      value={nextClosedMsg}
                      onChange={(e) => setNextClosedMsg(e.target.value)}
                      className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#888888]">Motivo del cambio (bitácora)</label>
                    <input
                      type="text"
                      value={changeReason}
                      onChange={(e) => setChangeReason(e.target.value)}
                      placeholder="Ej. Extensión solicitada por el coordinador"
                      className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setScheduleEditorOpen(false)}
                      className="h-8 px-3 bg-[#1C1C1C] text-xs text-[#B5B5B5] rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingSchedule}
                      className="h-8 px-4 bg-[#ED1010] text-xs font-semibold text-white rounded"
                    >
                      {savingSchedule ? 'Guardando...' : 'Aplicar Ventana'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Bulk Submission Activity Log for Admin */}
        <DashboardCard
          title="Sesiones de Registro Masivo por Organizaciones"
          subtitle="Historial de lotes enviados por representantes desde el portal masivo público"
          action={<UsersRound className="w-4 h-4 text-[#ED1010]" />}
        >
          {contractBulkSubs.length === 0 ? (
            <p className="text-xs text-[#888888] py-3">
              Aún no se han recibido envíos masivos de representantes para este contrato.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#292929] text-[#888888] uppercase">
                    <th className="py-2.5 pr-3">Fecha</th>
                    <th className="py-2.5 px-3">Representante</th>
                    <th className="py-2.5 px-3">Enviados</th>
                    <th className="py-2.5 px-3">Guardados</th>
                    <th className="py-2.5 px-3">Duplicados</th>
                    <th className="py-2.5 px-3">Rechazados</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 pl-3 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {contractBulkSubs.map((sub) => {
                    const isOpen = expandedBulkSubId === sub.submissionId;
                    return (
                      <React.Fragment key={sub.submissionId}>
                        <tr>
                          <td className="py-2.5 pr-3 font-mono text-[#B5B5B5]">
                            {new Date(sub.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="text-white font-semibold">{sub.representativeName}</p>
                            <p className="text-[#888888]">{sub.representativeContact}</p>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{sub.totalEntered}</td>
                          <td className="py-2.5 px-3 font-mono text-[#4ADE80] font-bold">
                            {sub.totalSaved}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#FBBF24]">
                            {sub.totalDuplicates || 0}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#F87171]">
                            {sub.totalRejected}
                          </td>
                          <td className="py-2.5 px-3 uppercase font-semibold">{sub.status}</td>
                          <td className="py-2.5 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBulkSubId(isOpen ? null : sub.submissionId)
                              }
                              className="px-2.5 py-1 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] rounded text-white inline-flex items-center gap-1"
                            >
                              {isOpen ? (
                                <>
                                  Ocultar <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  Ver detalle <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-[#0B0B0B]">
                            <td colSpan={8} className="p-4 space-y-2">
                              {sub.registrationCodes.length > 0 && (
                                <p className="text-xs text-[#CCCCCC]">
                                  <strong>Códigos generados:</strong>{' '}
                                  <span className="font-mono">
                                    {sub.registrationCodes.join(', ')}
                                  </span>
                                </p>
                              )}
                              {sub.rejectedReasons.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs text-[#F87171] font-semibold">
                                    Motivos de rechazo / duplicado:
                                  </p>
                                  <ul className="text-xs text-[#CCCCCC] space-y-0.5 max-h-32 overflow-y-auto">
                                    {sub.rejectedReasons.map((r, i) => (
                                      <li key={i}>• {r}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        {/* Google Sheets Sync + Schedule History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard
            title="Sincronización Google Sheets"
            subtitle="Hoja independiente con pestañas cronológicas, por talla y resumen"
            action={
              contract.sheetsConfig?.spreadsheetUrl && (
                <a
                  href={contract.sheetsConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#4ADE80] hover:underline inline-flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Abrir Hoja
                </a>
              )
            }
          >
            <div className="space-y-3">
              <SyncStatus
                status={contract.sheetsConfig?.lastSyncStatus || 'pending'}
                lastSyncAt={contract.sheetsConfig?.lastSyncAt}
                errorMessage={contract.sheetsConfig?.lastError}
                retrying={syncing}
                onRetry={handleSheetsAction}
              />
              {!contract.sheetsConfig?.spreadsheetId && (
                <p className="text-xs text-[#888888]">
                  Haz clic en “Sincronizar ahora” para crear automáticamente la hoja de cálculo en tu Google Drive y volcar todos los registros.
                </p>
              )}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Historial de Fechas y Aperturas"
            subtitle="Registro cronológico de cierres automáticos, reaperturas y extensiones"
            action={<CalendarClock className="w-4 h-4 text-[#888888]" />}
          >
            {!contract.scheduleHistory || contract.scheduleHistory.length === 0 ? (
              <p className="text-xs text-[#888888] py-4">
                Sin eventos de cambio de fechas registrados todavía.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {[...contract.scheduleHistory].reverse().map((h, i) => (
                  <div
                    key={i}
                    className="p-2.5 bg-[#0B0B0B] border border-[#222222] rounded text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white uppercase">{h.action}</span>
                      <span className="font-mono text-[11px] text-[#888888]">
                        {new Date(h.changedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#CCCCCC]">{h.reason}</p>
                    <p className="text-[11px] text-[#888888]">
                      {h.previousStatus} → <strong className="text-white">{h.newStatus}</strong> · Por:{' '}
                      {h.changedBy}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Mockups + Quick Size Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <DashboardCard title="Mockups del Uniforme" className="lg:col-span-5">
            <ImageGallery images={contract.mockupImages || []} />
          </DashboardCard>

          <DashboardCard
            title="Resumen de Tallas y Exportación"
            subtitle="Orden configurado para fabricación"
            className="lg:col-span-7"
            action={<ExportMenu contract={contract} registrations={contractRegs} />}
          >
            <div className="space-y-3">
              {summary.groups.map((g) => (
                <div key={g.size} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-display text-sm uppercase text-white">{g.size}</span>
                    <span className="font-mono text-[#B5B5B5] tabular-nums">
                      {g.count} prendas ({g.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-[#0B0B0B] rounded overflow-hidden">
                    <div
                      className="h-full bg-[#ED1010]"
                      style={{ width: `${Math.min(100, g.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>

      <ImportModal
        open={importOpen}
        contract={contract}
        existingRegistrations={contractRegs}
        adminUser={adminInfo}
        onClose={() => setImportOpen(false)}
      />
    </AdminLayout>
  );
}
