import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Lock, Search, Tag, UsersRound } from 'lucide-react';
import { BulkRegistrationGrid } from '../components/BulkRegistrationGrid';
import { ImageGallery } from '../components/ImageGallery';
import { LoadingState } from '../components/LoadingState';
import { MegoLogo } from '../components/MegoLogo';
import {
  getPublicContractByBulkToken,
  getPublicContractByToken,
} from '../services/contractsService';
import { getGlobalSettings } from '../services/settingsService';
import type { GlobalSettings, PublicContract } from '../types/mego';
import {
  CONTRACT_STATUS_META,
  evaluatePublicLinkAvailability,
} from '../utils/contractSchedule';
import { DEFAULT_GLOBAL_SETTINGS } from '../utils/defaultForm';

export function PublicBulkRegistrationPage() {
  const { bulkToken, token } = useParams<{ bulkToken?: string; token?: string }>();

  const [contract, setContract] = useState<PublicContract | null>(null);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [serverAllowed, setServerAllowed] = useState<boolean | null>(null);
  const [serverLinkMessage, setServerLinkMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const loader = bulkToken
      ? getPublicContractByBulkToken(bulkToken)
      : token
        ? getPublicContractByToken(token)
        : Promise.resolve(null);

    Promise.all([loader, getGlobalSettings()])
      .then(async ([ctr, cfg]) => {
        if (!active) return;
        setSettings(cfg);
        if (!ctr) {
          setError('Este enlace de registro masivo no existe, fue revocado o no está disponible.');
          return;
        }
        if (!ctr.bulkRegistrationEnabled) {
          setError(
            'El registro masivo por organizaciones no está habilitado para este contrato.'
          );
          return;
        }
        if (bulkToken && ctr.bulkToken && ctr.bulkToken !== bulkToken) {
          setError(
            'Este enlace de registro masivo fue revocado o reemplazado. Solicita el nuevo enlace a MEGO FORCE.'
          );
          return;
        }
        setContract(ctr);
        try {
          const activeToken = bulkToken || ctr.bulkToken || '';
          const r = await fetch(
            `/api/public/contract-window/${encodeURIComponent(ctr.publicToken)}?mode=bulk&bulkToken=${encodeURIComponent(activeToken)}`
          );
          if (r.ok && active) {
            const j = await r.json();
            if (typeof j?.allowed === 'boolean') {
              setServerAllowed(j.allowed);
              setServerLinkMessage(j.linkMessage || j.window?.visitorMessage || '');
            } else if (j?.window) {
              setServerAllowed(Boolean(j.window.isAcceptingRegistrations));
              setServerLinkMessage(j.window.visitorMessage || '');
            }
          }
        } catch {
          // ignore network glitch on window ping
        }
      })
      .catch(() => {
        if (active) setError('No se pudo cargar la sesión de registro masivo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bulkToken, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white p-6 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <LoadingState label="Cargando portal público de registro masivo..." rows={5} />
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen mego-carbon-bg text-white flex flex-col">
        <header className="h-16 border-b border-[#292929] bg-[#080808] px-4 sm:px-8 flex items-center justify-between">
          <MegoLogo brandName={settings.brandName} logoUrl={settings.logoUrl} size="sm" />
          <Link to="/" className="text-xs text-[#B5B5B5] hover:text-white">
            Volver al portal
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#141414] border border-[#292929] rounded-lg p-6 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-[#ED1010] mx-auto" />
            <h1 className="font-display text-2xl uppercase">Acceso Masivo No Disponible</h1>
            <p className="text-sm text-[#888888]">
              {error || 'No se encontró un contrato habilitado para carga masiva.'}
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-[#ED1010] text-white text-sm font-semibold rounded-md"
            >
              Volver al Inicio
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const linkEval = evaluatePublicLinkAvailability(contract, 'bulk');
  const isAccepting = serverAllowed === false ? false : linkEval.allowed;
  const effectiveStatus =
    serverAllowed === false && linkEval.window.effectiveStatus === 'active'
      ? 'auto_closed'
      : linkEval.window.effectiveStatus;
  const badge = CONTRACT_STATUS_META[effectiveStatus] || CONTRACT_STATUS_META.draft;
  const effectiveBulkToken = bulkToken || contract.bulkToken || contract.publicToken;
  const closedMsg = serverLinkMessage || linkEval.message || linkEval.window.visitorMessage;

  return (
    <div className="min-h-screen mego-carbon-bg text-white flex flex-col">
      <header className="h-14 sm:h-16 sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-md border-b border-[#292929] px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <MegoLogo brandName={settings.brandName} logoUrl={settings.logoUrl} size="sm" />
          <span className="hidden md:inline text-xs text-[#888888] border-l border-[#292929] pl-3">
            Portal Público · Registro Masivo por Organizaciones
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold uppercase ${badge.colorClass}`}>
            {badge.label}
          </span>
          <Link
            to={`/registro/${contract.publicToken}/consulta`}
            className="h-9 px-3 bg-[#141414] border border-[#292929] hover:border-[#888888] rounded-md text-xs text-white inline-flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            Consultar
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* Contract Overview Strip */}
        <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#888888]">
              <UsersRound className="w-4 h-4 text-[#ED1010]" />
              <span className="text-[#ED1010] font-semibold uppercase tracking-wider">
                {contract.organizationName}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{contract.contractCode}</span>
              {typeof contract.unitPrice === 'number' && contract.unitPrice > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-white">
                    <Tag className="w-3 h-3 text-[#ED1010]" />
                    {contract.currency || 'USD'} {contract.unitPrice.toFixed(2)}
                  </span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-white">
              {contract.title} — Carga Masiva
            </h1>
            <p className="text-xs sm:text-sm text-[#B5B5B5]">
              Prenda principal: <strong className="text-white">{contract.garmentType}</strong> · Tallas autorizadas:{' '}
              <span className="font-mono text-white">{contract.availableSizes.join(', ')}</span>
            </p>
            {contract.additionalGarments && contract.additionalGarments.length > 0 && (
              <p className="text-xs text-[#888888]">
                Prendas adicionales habilitadas:{' '}
                <strong className="text-white">{contract.additionalGarments.join(', ')}</strong>
              </p>
            )}
            {contract.formConfig.instructions && (
              <div className="bg-[#0B0B0B] border border-[#222222] rounded p-3 text-xs text-[#CCCCCC] whitespace-pre-line">
                {contract.formConfig.instructions}
              </div>
            )}
            {contract.individualRegistrationEnabled !== false && (
              <Link
                to={`/registro/${contract.publicToken}`}
                className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-white pt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Ir al formulario individual público
              </Link>
            )}
          </div>

          <div className="lg:col-span-4 max-w-xs w-full mx-auto lg:ml-auto">
            {contract.mockupImages?.length > 0 && (
              <ImageGallery images={contract.mockupImages.slice(0, 1)} />
            )}
          </div>
        </div>

        {!isAccepting ? (
          <div className="bg-[#141414] border border-[#ED1010]/40 rounded-lg p-8 text-center space-y-4">
            <Lock className="w-10 h-10 text-[#ED1010] mx-auto" />
            <h2 className="font-display text-2xl uppercase text-white">
              {linkEval.reasonCode === 'LINK_EXPIRED'
                ? 'Enlace Masivo Expirado'
                : `Registro Masivo Cerrado (${badge.label})`}
            </h2>
            <p className="text-sm text-[#CCCCCC] max-w-lg mx-auto">{closedMsg}</p>
            <Link
              to={`/registro/${contract.publicToken}/consulta`}
              className="inline-flex h-10 px-5 items-center justify-center bg-white text-[#080808] text-xs font-bold uppercase tracking-wider rounded-md"
            >
              Consultar Registros Históricos
            </Link>
          </div>
        ) : (
          <BulkRegistrationGrid contract={contract} bulkToken={effectiveBulkToken} />
        )}
      </main>

      <footer className="border-t border-[#292929] bg-[#080808]/90 px-4 sm:px-8 py-4 text-xs text-[#888888] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>MEGO FORCE · Portal Público de Registro Masivo</span>
        <div className="flex flex-wrap items-center gap-3">
          <span>Soporte para organizaciones:</span>
          <a
            href={`mailto:${settings.contactEmail || 'belsyvargas99@gmail.com'}`}
            className="text-white hover:text-[#ED1010] transition-colors"
          >
            {settings.contactEmail || 'belsyvargas99@gmail.com'}
          </a>
          {settings.contactPhone && (
            <span className="font-mono text-[#B5B5B5]">{settings.contactPhone}</span>
          )}
        </div>
      </footer>
    </div>
  );
}
