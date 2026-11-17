import React, { useEffect, useState } from 'react';
import { X, Save, History, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { subscribeAuditLogs } from '../services/auditService';
import { updateRegistrationAdmin } from '../services/registrationsService';
import type {
  AuditLog,
  PaymentSelection,
  PaymentVerificationStatus,
  Registration,
} from '../types/mego';
import { DEFAULT_AVAILABLE_SIZES } from '../utils/defaultForm';

interface RegistrationDetailsProps {
  registration: Registration | null;
  availableSizes?: string[];
  adminUser: { uid: string; email: string };
  onClose: () => void;
}

export function RegistrationDetails({
  registration,
  availableSizes = DEFAULT_AVAILABLE_SIZES,
  adminUser,
  onClose,
}: RegistrationDetailsProps) {
  const [fullName, setFullName] = useState('');
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [size, setSize] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection>('PAGO COMPLETO');
  const [paymentVerificationStatus, setPaymentVerificationStatus] =
    useState<PaymentVerificationStatus>('pending');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!registration) return;
    setFullName(registration.fullName);
    setIdentificationNumber(registration.identificationNumber);
    setSize(registration.size);
    setNickname(registration.nickname || '');
    setPhone(registration.phone);
    setInstagram(registration.instagram || '');
    setPaymentSelection(registration.paymentSelection);
    setPaymentVerificationStatus(registration.paymentVerificationStatus);
    setPaymentAmount(registration.paymentAmount !== undefined ? String(registration.paymentAmount) : '');
    setPaymentNotes(registration.paymentNotes || '');

    const unsub = subscribeAuditLogs(setLogs, registration.registrationId);
    return () => unsub();
  }, [registration]);

  if (!registration) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateRegistrationAdmin(
        registration,
        {
          fullName,
          identificationNumber,
          size,
          nickname,
          phone,
          instagram,
          paymentSelection,
          paymentVerificationStatus,
          paymentAmount: paymentAmount ? Number(paymentAmount) : undefined,
          paymentNotes,
        },
        adminUser
      );
      toast.success('Participante actualizado y auditoría registrada.');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl h-full bg-[#0D0D0D] border-l border-[#292929] overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-[#292929] pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#ED1010]">{registration.registrationCode}</span>
              <span className="text-[#888888]">·</span>
              <span className="text-[#38BDF8] uppercase">
                {registration.registrationMode === 'bulk' ||
                registration.source === 'bulk_representative'
                  ? `Masivo${registration.representativeName ? ` (${registration.representativeName})` : ''}`
                  : 'Individual'}
              </span>
            </div>
            <h2 className="font-display text-2xl uppercase text-white mt-0.5">
              Editar Participante
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="p-2 text-[#888888] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Nombre completo</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Cédula (preserva ceros)</label>
              <input
                type="text"
                required
                value={identificationNumber}
                onChange={(e) => setIdentificationNumber(e.target.value)}
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm font-mono text-white outline-none focus:border-[#ED1010]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Talla</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
              >
                {Array.from(new Set([...availableSizes, size])).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Seudónimo</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Teléfono</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm font-mono text-white outline-none focus:border-[#ED1010]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Instagram</label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Modalidad declarada</label>
              <select
                value={paymentSelection}
                onChange={(e) => setPaymentSelection(e.target.value as PaymentSelection)}
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
              >
                <option value="PAGO COMPLETO">PAGO COMPLETO</option>
                <option value="PAGO PARCIAL">PAGO PARCIAL</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Verificación administrativa</label>
              <select
                value={paymentVerificationStatus}
                onChange={(e) =>
                  setPaymentVerificationStatus(e.target.value as PaymentVerificationStatus)
                }
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
              >
                <option value="pending">Pendiente</option>
                <option value="verified">Verificado</option>
                <option value="rejected">Rechazado</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Monto recibido (opcional)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm font-mono text-white outline-none focus:border-[#ED1010]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Notas de pago</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Referencia bancaria, recibo..."
                className="w-full h-10 px-3 bg-[#141414] border border-[#292929] rounded text-sm text-white outline-none focus:border-[#ED1010]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1C1C1C] hover:bg-[#292929] text-sm rounded-md text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-sm font-semibold rounded-md text-white inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        </form>

        {/* Immutable Audit History */}
        <div className="pt-6 border-t border-[#292929] space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <History className="w-4 h-4 text-[#ED1010]" />
            <span>Historial de Modificaciones (Auditoría)</span>
          </div>
          {logs.length === 0 ? (
            <p className="text-xs text-[#888888]">
              Sin modificaciones administrativas registradas para este participante.
            </p>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => (
                <div
                  key={log.logId}
                  className="p-3 bg-[#141414] border border-[#292929] rounded text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[#888888]">
                    <span className="text-white font-medium">{log.userEmail}</span>
                    <span className="tabular-nums">
                      {new Date(log.createdAt).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {log.changedFields.map((ch, i) => (
                      <div key={i} className="text-[#CCCCCC]">
                        <span className="font-mono text-[#ED1010]">{ch.field}</span>:{' '}
                        <span className="text-[#888888] line-through">{ch.oldValue || '(vacío)'}</span>{' '}
                        → <span className="text-white">{ch.newValue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
