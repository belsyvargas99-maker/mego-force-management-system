import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Search, AlertCircle, CalendarClock, UsersRound, Lock, Tag } from 'lucide-react';
import { ImageGallery } from '../components/ImageGallery';
import { LoadingState } from '../components/LoadingState';
import { MegoLogo } from '../components/MegoLogo';
import { RegistrationForm } from '../components/RegistrationForm';
import { getPublicContractByToken } from '../services/contractsService';
import { getGlobalSettings } from '../services/settingsService';
import type { GlobalSettings, PublicContract, RegistrationLock } from '../types/mego';
import {
  CONTRACT_STATUS_META,
  evaluatePublicLinkAvailability,
  formatWindowDisplay,
} from '../utils/contractSchedule';
import { DEFAULT_GLOBAL_SETTINGS } from '../utils/defaultForm';

export function PublicContractPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();

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

    Promise.all([
      getPublicContractByToken(token),
      getGlobalSettings(),
      fetch(`/api/public/contract-window/${encodeURIComponent(token)}?mode=individual`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([ctr, cfg, srvWin]) => {
        if (!active) return;
        setSettings(cfg);
        if (!ctr) {
          setError('El enlace del contrato no existe o fue desactivado.');
        } else {
          setContract(ctr);
          if (srvWin) {
            if (typeof srvWin.allowed === 'boolean') {
              setServerAllowed(srvWin.allowed);
              setServerLinkMessage(srvWin.linkMessage || srvWin.window?.visitorMessage || '');
            } else if (srvWin.window) {
              setServerAllowed(Boolean(srvWin.window.isAcceptingRegistrations));
              setServerLinkMessage(srvWin.window.visitorMessage || '');
            }
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setError('No se pudo cargar la información del contrato. Verifica tu conexión.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleSuccess = (confirmation: RegistrationLock) => {
    try {
      sessionStorage.setItem(`mego_conf_${token}`, JSON.stringify(confirmation));
    } catch {
      // ignore storage failure
    }
    navigate(`/registro/${token}/confirmacion`, {
      state: {
        confirmation,
        contractTitle: contract?.title,
        organizationName: contract?.organizationName,
        confirmationMessage: contract?.formConfig.confirmationMessage,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white p-6 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <LoadingState label="Cargando contrato y diseño oficial..." rows={5} />
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
            Volver al inicio
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#141414] border border-[#292929] rounded-lg p-6 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-[#ED1010] mx-auto" />
            <h1 className="font-display text-2xl uppercase">Contrato No Disponible</h1>
            <p className="text-sm text-[#888888]">
              {error || 'No se encontró un contrato asociado a este enlace.'}
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-[#ED1010] text-white text-sm font-semibold rounded-md"
            >
              Ingresar otro código
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const linkEval = evaluatePublicLinkAvailability(contract, 'individual');
  const isAccepting = serverAllowed === false ? false : linkEval.allowed;
  const effectiveStatus =
    serverAllowed === false && linkEval.window.effectiveStatus === 'active'
      ? 'auto_closed'
      : linkEval.window.effectiveStatus;
  const closedBannerMsg =
    serverLinkMessage || linkEval.message || linkEval.window.visitorMessage;
  const badge = CONTRACT_STATUS_META[effectiveStatus] || CONTRACT_STATUS_META.draft;

  return (
    <div className="min-h-screen mego-carbon-bg text-white flex flex-col">
      {/* Compact Sticky Header (<15% mobile height) */}
      <header className="h-14 sm:h-16 sticky top-0 z-30 bg-[#080808]/95 backdrop-blur-md border-b border-[#292929] px-4 sm:px-8 flex items-center justify-between gap-4">
        <MegoLogo brandName={settings.brandName} logoUrl={settings.logoUrl} size="sm" />
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-semibold uppercase whitespace-nowrap ${badge.colorClass}`}>
            {badge.label}
          </span>
          <Link
            to={`/registro/${token}/consulta`}
            className="h-9 px-3 bg-[#141414] border border-[#292929] hover:border-[#888888] rounded-md text-xs text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Consultar Registro</span>
            <span className="sm:hidden">Consultar</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Presentation & Mockups Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#888888]">
                <span className="text-[#ED1010] font-semibold uppercase tracking-wider">
                  {contract.organizationName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{contract.contractCode}</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-wide text-white text-balance">
                {contract.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[#B5B5B5]">
                <span className="font-semibold text-white">{contract.garmentType}</span>
                {typeof contract.unitPrice === 'number' && contract.unitPrice > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#141414] border border-[#292929] font-mono text-xs text-white">
                    <Tag className="w-3 h-3 text-[#ED1010]" />
                    {contract.currency || 'USD'} {contract.unitPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {(contract.openDate || contract.closeDate) && (
              <div className="bg-[#141414] border border-[#292929] rounded-lg p-3.5 flex items-center gap-3 text-xs">
                <CalendarClock className="w-4 h-4 text-[#ED1010] shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-[#888888]">Ventana oficial de registro:</p>
                  <p className="font-mono text-white">
                    Cierre: {formatWindowDisplay(contract.closeDate, contract.closeTime, contract.timezone)}
                  </p>
                </div>
              </div>
            )}

            <ImageGallery images={contract.mockupImages || []} />

            {contract.description && (
              <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-2">
                <h2 className="font-display text-base uppercase tracking-wide text-white">
                  Especificaciones de la Prenda
                </h2>
                <p className="text-sm text-[#CCCCCC] leading-relaxed">
                  {contract.description}
                </p>
              </div>
            )}

            {contract.garmentFeatures && contract.garmentFeatures.length > 0 && (
              <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-3">
                <h2 className="font-display text-base uppercase tracking-wide text-white">
                  Características Técnicas
                </h2>
                <ul className="space-y-2 text-sm text-[#D4D4D4]">
                  {contract.garmentFeatures.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#ED1010] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {contract.formConfig.instructions && (
              <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-2">
                <h2 className="font-display text-base uppercase tracking-wide text-white">
                  Instrucciones de Registro
                </h2>
                <p className="text-xs sm:text-sm text-[#B5B5B5] whitespace-pre-line leading-relaxed">
                  {contract.formConfig.instructions}
                </p>
              </div>
            )}
          </div>

          {/* Registration Form Column */}
          <div className="lg:col-span-7 bg-[#141414] border border-[#292929] rounded-lg p-5 sm:p-8 space-y-6">
            <div className="border-b border-[#292929] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wide text-white">
                  {contract.formConfig.title}
                </h2>
                <p className="text-sm text-[#888888] mt-1">
                  {contract.formConfig.subtitle}
                </p>
              </div>
              {contract.bulkRegistrationEnabled && contract.bulkToken && (
                <Link
                  to={`/registro-masivo/${contract.bulkToken}`}
                  className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-xs font-medium text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <UsersRound className="w-3.5 h-3.5 text-[#ED1010]" />
                  Portal Masivo Organización
                </Link>
              )}
            </div>

            {!isAccepting ? (
              <div className="bg-[#0B0B0B] border border-[#ED1010]/40 rounded-lg p-6 text-center space-y-4">
                <Lock className="w-9 h-9 text-[#ED1010] mx-auto" />
                <div className="space-y-1.5">
                  <h3 className="font-display text-2xl uppercase text-white">
                    {linkEval.reasonCode === 'MODE_DISABLED'
                      ? 'Registro Individual Deshabilitado'
                      : linkEval.reasonCode === 'LINK_EXPIRED'
                        ? 'Enlace Expirado'
                        : badge.label}
                  </h3>
                  <p className="text-sm text-[#CCCCCC] max-w-md mx-auto leading-relaxed">
                    {closedBannerMsg}
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  {contract.bulkRegistrationEnabled && contract.bulkToken && (
                    <Link
                      to={`/registro-masivo/${contract.bulkToken}`}
                      className="h-10 px-5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-bold uppercase tracking-wider rounded-md inline-flex items-center gap-2"
                    >
                      <UsersRound className="w-4 h-4" />
                      Ir al Portal Masivo
                    </Link>
                  )}
                  <Link
                    to={`/registro/${token}/consulta`}
                    className="h-10 px-5 bg-white hover:bg-neutral-200 text-[#080808] text-xs font-bold uppercase tracking-wider rounded-md inline-flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Consultar Mi Registro Existente
                  </Link>
                </div>
              </div>
            ) : (
              <RegistrationForm contract={contract} onSuccess={handleSuccess} />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#292929] bg-[#080808]/90 px-4 sm:px-8 py-4 text-xs text-[#888888] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>MEGO FORCE · Portal Oficial de Registro</span>
        <div className="flex flex-wrap items-center gap-3">
          <span>¿Dudas o consultas?</span>
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
