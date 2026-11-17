import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MegoLogo } from '../components/MegoLogo';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { getPublicContractByToken } from '../services/contractsService';
import { lookupPublicConfirmation } from '../services/registrationsService';
import type { PublicContract, RegistrationLock } from '../types/mego';

export function PublicLookupPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [queryInput, setQueryInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<RegistrationLock | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getPublicContractByToken(token).then(setContract).catch(() => setContract(null));
  }, [token]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !queryInput.trim()) return;
    setSearching(true);
    setNotFound(false);
    setResult(null);
    try {
      const found = await lookupPublicConfirmation(contract.contractId, queryInput);
      if (!found) {
        setNotFound(true);
      } else {
        setResult(found);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen mego-carbon-bg text-white flex flex-col">
      <header className="h-16 border-b border-[#292929] bg-[#080808] px-4 sm:px-8 flex items-center justify-between">
        <MegoLogo size="sm" />
        <Link
          to={`/registro/${token}`}
          className="text-xs text-[#D4D4D4] hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al registro
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-[#141414] border border-[#292929] rounded-lg p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-[#ED1010] font-semibold">
              {contract?.organizationName || 'MEGO FORCE'}
            </p>
            <h1 className="font-display text-2xl uppercase text-white">
              Consultar Mi Registro
            </h1>
            <p className="text-xs text-[#888888]">
              Ingresa tu número de cédula o código de confirmación (ej. MF-26-...) para verificar tu registro personal. No se muestran datos de terceros.
            </p>
          </div>

          <form onSubmit={handleLookup} className="space-y-3">
            <input
              type="text"
              required
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Cédula o código MF-..."
              aria-label="Cédula o código de confirmación"
              className="w-full h-12 px-4 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm font-mono text-white outline-none"
            />
            <button
              type="submit"
              disabled={searching || !contract}
              className="w-full h-11 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-white text-sm font-display uppercase tracking-wider font-bold rounded-md inline-flex items-center justify-center gap-2"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Consultar Confirmación
            </button>
          </form>

          {notFound && (
            <div className="p-4 rounded bg-[#0B0B0B] border border-[#292929] flex items-center gap-3 text-sm text-[#B5B5B5]">
              <AlertCircle className="w-5 h-5 text-[#ED1010] shrink-0" />
              <span>No se encontró un registro con ese dato en este contrato.</span>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-md bg-[#0B0B0B] border border-[#16A34A]/40 space-y-3">
              <div className="flex items-center gap-2 text-[#4ADE80] text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Registro Confirmado · {result.registrationCode}
              </div>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[#888888]">Nombre</dt>
                  <dd className="text-white font-medium">{result.displayName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#888888]">Cédula</dt>
                  <dd className="font-mono text-white">{result.maskedId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#888888]">Talla</dt>
                  <dd className="font-bold text-[#ED1010]">{result.size}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#888888]">Seudónimo</dt>
                  <dd className="text-white">{result.nickname || '-'}</dd>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <dt className="text-[#888888]">Pago</dt>
                  <dd>
                    <PaymentStatusBadge
                      selection={result.paymentSelection}
                      verificationStatus={result.paymentVerificationStatus}
                    />
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
