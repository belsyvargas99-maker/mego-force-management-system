import React from 'react';
import { CheckCircle2, Printer, Search, ArrowLeft } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { MegoLogo } from '../components/MegoLogo';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import type { RegistrationLock } from '../types/mego';

export function PublicConfirmationPage() {
  const { token = '' } = useParams<{ token: string }>();
  const location = useLocation();
  const state = (location.state || {}) as {
    confirmation?: RegistrationLock;
    contractTitle?: string;
    organizationName?: string;
    confirmationMessage?: string;
  };

  let confirmation = state.confirmation || null;
  if (!confirmation) {
    try {
      const saved = sessionStorage.getItem(`mego_conf_${token}`);
      if (saved) confirmation = JSON.parse(saved);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen mego-carbon-bg text-white flex flex-col">
      <header className="h-16 border-b border-[#292929] bg-[#080808] px-4 sm:px-8 flex items-center justify-between">
        <MegoLogo size="sm" />
        <Link
          to={`/registro/${token}/consulta`}
          className="text-xs font-medium text-[#D4D4D4] hover:text-white inline-flex items-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          Consultar por cédula
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {!confirmation ? (
          <div className="max-w-md w-full bg-[#141414] border border-[#292929] rounded-lg p-6 text-center space-y-4">
            <h1 className="font-display text-2xl uppercase">Comprobante no disponible</h1>
            <p className="text-sm text-[#888888]">
              Puedes consultar tu confirmación ingresando tu número de cédula o código de registro.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={`/registro/${token}/consulta`}
                className="px-5 py-2.5 bg-[#ED1010] text-white text-sm font-semibold rounded-md"
              >
                Ir a Consulta
              </Link>
              <Link
                to={`/registro/${token}`}
                className="px-5 py-2.5 bg-[#292929] text-white text-sm font-medium rounded-md"
              >
                Volver al Contrato
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-lg w-full bg-[#141414] border border-[#292929] rounded-lg p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-[#16A34A]/15 border border-[#16A34A]/40 flex items-center justify-center text-[#4ADE80]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="font-display text-3xl uppercase tracking-wide text-white">
                Registro Confirmado
              </h1>
              <p className="text-sm text-[#B5B5B5]">
                {state.confirmationMessage ||
                  'Tu registro se ha guardado correctamente en el sistema MEGO FORCE.'}
              </p>
            </div>

            <div className="bg-[#0B0B0B] border border-[#292929] rounded-md p-4 text-center space-y-1">
              <p className="text-xs uppercase tracking-widest text-[#888888]">
                Código Único de Confirmación
              </p>
              <p className="font-mono text-2xl font-bold tracking-wider text-[#ED1010] tabular-nums">
                {confirmation.registrationCode}
              </p>
            </div>

            <dl className="divide-y divide-[#222222] text-sm">
              {state.organizationName && (
                <div className="py-2.5 flex justify-between gap-4">
                  <dt className="text-[#888888]">Organización</dt>
                  <dd className="text-white font-medium text-right">{state.organizationName}</dd>
                </div>
              )}
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#888888]">Participante</dt>
                <dd className="text-white font-medium text-right">{confirmation.displayName}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#888888]">Cédula (protegida)</dt>
                <dd className="font-mono text-white text-right">{confirmation.maskedId}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#888888]">Talla seleccionada</dt>
                <dd className="font-display text-lg font-bold text-[#ED1010]">
                  {confirmation.size}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#888888]">Seudónimo</dt>
                <dd className="text-white font-medium text-right">
                  {confirmation.nickname || '-'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-[#888888]">Pago</dt>
                <dd>
                  <PaymentStatusBadge
                    selection={confirmation.paymentSelection}
                    verificationStatus={confirmation.paymentVerificationStatus}
                  />
                </dd>
              </div>
            </dl>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 h-11 px-4 bg-[#292929] hover:bg-[#383838] text-white text-sm font-medium rounded-md inline-flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Guardar / Imprimir
              </button>
              <Link
                to={`/registro/${token}`}
                className="flex-1 h-11 px-4 bg-[#0B0B0B] border border-[#292929] hover:border-[#888888] text-white text-sm font-medium rounded-md inline-flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Contrato
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
