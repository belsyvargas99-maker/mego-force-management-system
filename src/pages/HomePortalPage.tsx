import React, { useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, Layers, FileSpreadsheet, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { MegoLogo } from '../components/MegoLogo';
import { IS_ADMIN_ENABLED } from '../config/appMode';

export function HomePortalPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [accessType, setAccessType] = useState<'individual' | 'bulk'>('individual');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleOpenRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let clean = tokenInput.trim();
    if (!clean) {
      setError('Ingresa el código o enlace de registro proporcionado por tu organización.');
      return;
    }

    const bulkMatch = clean.match(/\/registro-masivo\/([a-zA-Z0-9_\-]+)/);
    if (bulkMatch) {
      navigate(`/registro-masivo/${bulkMatch[1]}`);
      return;
    }

    const indivMatch = clean.match(/\/registro\/([a-zA-Z0-9_\-]+)/);
    if (indivMatch) {
      clean = indivMatch[1];
    }

    if (!/^[a-zA-Z0-9_\-]{6,64}$/.test(clean)) {
      setError('Código de enlace inválido. Verifica e intenta nuevamente.');
      return;
    }

    if (accessType === 'bulk') {
      navigate(`/registro-masivo/${clean}`);
    } else {
      navigate(`/registro/${clean}`);
    }
  };

  return (
    <div className="min-h-screen mego-carbon-bg text-white flex flex-col overflow-x-hidden">
      <header className="h-16 border-b border-[#292929] bg-[#080808]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-3 sm:gap-8">
        <MegoLogo size="md" />
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#B5B5B5]">
          <a href="#acceso-participantes" className="hover:text-white transition-colors whitespace-nowrap">
            Portal Participantes
          </a>
          <a href="#capacidades" className="hover:text-white transition-colors whitespace-nowrap">
            Producción y Tallas
          </a>
        </nav>
        {/* El acceso al panel solo se muestra fuera del host público */}
        {IS_ADMIN_ENABLED ? (
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="sm:hidden">Acceso Admin</span>
            <span className="hidden sm:inline">Acceso Administrativo</span>
          </Link>
        ) : (
          <a
            href="#acceso-participantes"
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <span className="sm:hidden">Registrarme</span>
            <span className="hidden sm:inline">Abrir mi registro</span>
          </a>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-12 sm:py-20 space-y-16">
        <section
          id="acceso-participantes"
          className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch"
        >
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#ED1010]">
              MEGO FORCE MANAGEMENT SYSTEM
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.05] text-balance">
              Gestión Privada de Contratos y Producción Deportiva
            </h1>
            <p className="text-base sm:text-lg text-[#B5B5B5] max-w-xl leading-relaxed">
              Plataforma oficial para registro individual y masivo por organizaciones, clasificación automática por tallas, órdenes de fabricación y sincronización con Google Sheets.
            </p>

            {IS_ADMIN_ENABLED && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/admin/login"
                  className="h-12 px-6 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-sm font-display uppercase tracking-wider font-bold rounded-md inline-flex items-center gap-2 transition-colors"
                >
                  Entrar al Panel Administrativo
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-[#141414] border border-[#292929] rounded-lg p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <h2 className="font-display text-2xl uppercase tracking-wide text-white">
                Portal del Cliente y Organizaciones
              </h2>
              <p className="text-sm text-[#888888]">
                Ingresa el enlace o código privado recibido para registrar tu participación o cargar la nómina de tu equipo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-[#0B0B0B] p-1 rounded-md border border-[#292929]">
              <button
                type="button"
                onClick={() => setAccessType('individual')}
                className={`min-h-10 px-2 py-1.5 rounded text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                  accessType === 'individual'
                    ? 'bg-[#ED1010] text-white'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                <span className="sm:hidden">Individual</span>
                <span className="hidden sm:inline">Participante Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setAccessType('bulk')}
                className={`min-h-10 px-2 py-1.5 rounded text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                  accessType === 'bulk'
                    ? 'bg-[#ED1010] text-white'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                <UsersRound className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden">Rep. Masivo</span>
                <span className="hidden sm:inline">Representante Masivo</span>
              </button>
            </div>

            <form onSubmit={handleOpenRegistration} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="contract-token-input"
                  className="block text-xs font-semibold uppercase tracking-wide text-[#D4D4D4]"
                >
                  {accessType === 'bulk'
                    ? 'Enlace o código de registro masivo'
                    : 'Enlace o código del contrato'}
                </label>
                <input
                  id="contract-token-input"
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    accessType === 'bulk'
                      ? 'Ej. /registro-masivo/... o código masivo'
                      : 'Ej. a8f92kLmP3x o /registro/...'
                  }
                  className="w-full h-12 px-4 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm font-mono text-white placeholder-[#525252] outline-none"
                />
              </div>

              {error && (
                <p className="text-xs text-[#ED1010] font-medium" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full h-12 bg-white hover:bg-neutral-200 text-[#080808] text-sm font-display uppercase tracking-wider font-bold rounded-md inline-flex items-center justify-center gap-2 transition-colors"
              >
                {accessType === 'bulk'
                  ? 'Abrir Carga Masiva de Organización'
                  : 'Abrir Formulario del Contrato'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-4 border-t border-[#292929] text-xs text-[#888888]">
              <p>
                Acceso exclusivo por enlace privado. Tus datos están protegidos y no son visibles para terceros.
              </p>
            </div>
          </div>
        </section>

        <section
          id="capacidades"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-[#292929] pt-12"
        >
          <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-3">
            <Layers className="w-6 h-6 text-[#ED1010]" />
            <h3 className="font-display text-xl uppercase text-white">
              Agrupación Automática por Talla
            </h3>
            <p className="text-sm text-[#888888] leading-relaxed">
              Clasificación cronológica instantánea desde XS hasta XXXL y tallas personalizadas, lista para corte y sublimación.
            </p>
          </div>

          <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-3">
            <FileSpreadsheet className="w-6 h-6 text-[#ED1010]" />
            <h3 className="font-display text-xl uppercase text-white">
              Google Sheets + Excel / PDF
            </h3>
            <p className="text-sm text-[#888888] leading-relaxed">
              Sincronización en cola con pestañas por talla, resumen de fabricación y exportaciones profesionales listas para imprimir.
            </p>
          </div>

          <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-3">
            <ShieldCheck className="w-6 h-6 text-[#ED1010]" />
            <h3 className="font-display text-xl uppercase text-white">
              Control Antifraude y Auditoría
            </h3>
            <p className="text-sm text-[#888888] leading-relaxed">
              Prevención atómica de cédulas duplicadas, separación estricta de verificación de pagos y bitácora inmutable de cambios.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#292929] px-4 sm:px-8 py-6 text-xs text-[#888888] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>MEGO FORCE · Sistema Privado de Gestión de Contratos</span>
        {IS_ADMIN_ENABLED && (
          <Link to="/admin/login" className="hover:text-white transition-colors">
            Consola Administrativa
          </Link>
        )}
      </footer>
    </div>
  );
}
