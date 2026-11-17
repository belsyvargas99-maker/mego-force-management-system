import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ArrowLeft, ShieldCheck, Loader2, Layers } from 'lucide-react';
import type { FormConfig, PaymentSelection, PublicContract, RegistrationLock } from '../types/mego';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { submitPublicRegistration } from '../services/registrationsService';
import { maskIdentification, normalizeInstagram, normalizePhone } from '../utils/normalizers';

interface RegistrationFormProps {
  contract: Pick<
    PublicContract,
    | 'contractId'
    | 'publicToken'
    | 'status'
    | 'availableSizes'
    | 'formConfig'
    | 'additionalGarments'
    | 'individualRegistrationEnabled'
  >;
  previewMode?: boolean;
  onSuccess?: (confirmation: RegistrationLock) => void;
}

export function RegistrationForm({
  contract,
  previewMode = false,
  onSuccess,
}: RegistrationFormProps) {
  const formConfig: FormConfig = contract.formConfig;
  const fields = [...(formConfig.fields || [])]
    .filter((f) => f.enabled)
    .sort((a, b) => a.order - b.order);

  const extraGarments = contract.additionalGarments || [];
  const defaultExtraSize = contract.availableSizes?.[0] || 'M';

  const [values, setValues] = useState<Record<string, any>>({
    fullName: '',
    identificationNumber: '',
    size: '',
    nickname: '',
    phone: '',
    instagram: '',
    paymentSelection: '',
  });
  const [garmentItems, setGarmentItems] = useState<{ garment: string; size: string; nickname: string }[]>(
    () =>
      extraGarments.map((g) => ({
        garment: g,
        size: defaultExtraSize,
        nickname: '',
      }))
  );
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewStep, setReviewStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setFieldVal = (key: string, val: any) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const updateExtraGarment = (idx: number, patch: Partial<{ size: string; nickname: string }>) => {
    setGarmentItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const validateAll = (): boolean => {
    const nextErrors: Record<string, string> = {};

    for (const field of fields) {
      const val = values[field.key];
      const strVal = Array.isArray(val) ? val.join('') : String(val ?? '').trim();

      if (field.required && !strVal) {
        nextErrors[field.key] = `El campo "${field.label}" es obligatorio.`;
        continue;
      }

      if (field.key === 'identificationNumber' && strVal) {
        const cleanDigits = strVal.replace(/[\s.\-]/g, '');
        if (cleanDigits.length < 4) {
          nextErrors[field.key] = 'Ingresa un número de cédula válido (mínimo 4 caracteres).';
        }
      }

      if (field.key === 'phone' && strVal) {
        const digits = normalizePhone(strVal).replace(/\D/g, '');
        if (digits.length < 7) {
          nextErrors[field.key] = 'Ingresa un número de teléfono válido con prefijo.';
        }
      }

      if (field.type === 'email' && strVal) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
          nextErrors[field.key] = 'Ingresa un correo electrónico válido.';
        }
      }
    }

    if (!privacyAccepted) {
      nextErrors.privacyAccepted = 'Debes aceptar la política de privacidad para continuar.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePrimaryAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (honeypot.trim()) {
      setSubmitError('Solicitud rechazada por verificación de seguridad.');
      return;
    }

    if (!validateAll()) {
      return;
    }

    if (formConfig.requireReviewStep && !reviewStep) {
      setReviewStep(true);
      return;
    }

    if (previewMode) {
      setSubmitError('Modo vista previa administrativa: los envíos reales solo se procesan en el enlace público.');
      return;
    }

    setSubmitting(true);
    try {
      const customFields: Record<string, any> = {};
      for (const f of fields) {
        if (!f.isSystemDefault && values[f.key] !== undefined) {
          customFields[f.label] = values[f.key];
        }
      }

      const confirmation = await submitPublicRegistration({
        contractId: contract.contractId,
        publicToken: contract.publicToken,
        fullName: String(values.fullName || ''),
        identificationNumber: String(values.identificationNumber || ''),
        size: String(values.size || ''),
        nickname: String(values.nickname || ''),
        phone: String(values.phone || ''),
        instagram: normalizeInstagram(String(values.instagram || '')),
        paymentSelection: (values.paymentSelection as PaymentSelection) || 'PAGO COMPLETO',
        privacyAccepted: true,
        customFields,
        ...(garmentItems.length > 0 ? { garmentItems } : {}),
      });

      onSuccess?.(confirmation);
    } catch (err: any) {
      setSubmitError(err?.message || 'No se pudo procesar tu registro. Intenta nuevamente.');
      setReviewStep(false);
    } finally {
      setSubmitting(false);
    }
  };

  if ((contract.status !== 'active' || contract.individualRegistrationEnabled === false) && !previewMode) {
    return (
      <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-[#ED1010] mx-auto" />
        <h3 className="font-display text-2xl uppercase tracking-wide text-white">
          Registro Cerrado
        </h3>
        <p className="text-sm text-[#888888]">
          Este contrato no admite nuevos registros individuales en este momento. Si ya te registraste, puedes consultar tu confirmación.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handlePrimaryAction} noValidate className="space-y-6">
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="sr-only"
      />

      {!reviewStep ? (
        <>
          <div className="space-y-5">
            {fields.map((field) => (
              <DynamicFieldRenderer
                key={field.id}
                field={field}
                value={values[field.key]}
                availableSizes={contract.availableSizes}
                error={errors[field.key]}
                onChange={(val) => setFieldVal(field.key, val)}
                disabled={submitting}
              />
            ))}
          </div>

          {extraGarments.length > 0 && (
            <div className="bg-[#0D0D0D] border border-[#292929] rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                <Layers className="w-4 h-4 text-[#ED1010]" />
                <span>Prendas Adicionales del Contrato</span>
              </div>
              <div className="space-y-3">
                {garmentItems.map((item, idx) => (
                  <div
                    key={item.garment}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-[#141414] border border-[#222222] rounded p-3"
                  >
                    <span className="sm:col-span-5 text-xs font-medium text-white">
                      {item.garment}
                    </span>
                    <div className="sm:col-span-3">
                      <select
                        aria-label={`Talla para ${item.garment}`}
                        value={item.size}
                        onChange={(e) => updateExtraGarment(idx, { size: e.target.value })}
                        disabled={submitting}
                        className="w-full h-9 px-2 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                      >
                        {contract.availableSizes.map((s) => (
                          <option key={s} value={s}>
                            Talla {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        aria-label={`Seudónimo para ${item.garment}`}
                        value={item.nickname}
                        onChange={(e) => updateExtraGarment(idx, { nickname: e.target.value })}
                        disabled={submitting}
                        placeholder="Personalización opcional"
                        className="w-full h-9 px-2.5 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#292929] space-y-2">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-md bg-[#0D0D0D] border border-[#292929]">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => {
                  setPrivacyAccepted(e.target.checked);
                  if (errors.privacyAccepted) {
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.privacyAccepted;
                      return copy;
                    });
                  }
                }}
                disabled={submitting}
                className="w-5 h-5 mt-0.5 accent-[#ED1010] shrink-0"
              />
              <span className="text-xs sm:text-sm text-[#D4D4D4] leading-relaxed">
                {formConfig.privacyPolicyText}
              </span>
            </label>
            {errors.privacyAccepted && (
              <p className="text-xs text-[#ED1010] font-medium" role="alert">
                {errors.privacyAccepted}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="bg-[#0D0D0D] border border-[#292929] rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-[#ED1010]">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-display text-xl uppercase tracking-wide text-white">
              Revisa tus datos antes de confirmar
            </h3>
          </div>

          <dl className="divide-y divide-[#222222] text-sm">
            {fields.map((f) => {
              let displayVal = values[f.key];
              if (Array.isArray(displayVal)) displayVal = displayVal.join(', ');
              if (f.key === 'identificationNumber') {
                displayVal = maskIdentification(String(displayVal || ''));
              }
              if (f.key === 'instagram' && displayVal) {
                displayVal = normalizeInstagram(String(displayVal));
              }
              return (
                <div key={f.id} className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-[#888888] text-xs uppercase">{f.label}</dt>
                  <dd className="text-white font-medium text-right break-words">
                    {String(displayVal || '-')}
                  </dd>
                </div>
              );
            })}
            {garmentItems.map((g) => (
              <div key={g.garment} className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-[#888888] text-xs uppercase">{g.garment}</dt>
                <dd className="text-white font-medium text-right">
                  Talla {g.size} {g.nickname ? `(${g.nickname})` : ''}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {submitError && (
        <div
          className="p-4 rounded-md bg-[#ED1010]/15 border border-[#ED1010]/50 flex items-start gap-3 text-sm text-white"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-[#ED1010] shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {reviewStep && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => setReviewStep(false)}
            className="h-12 px-5 bg-[#292929] hover:bg-[#383838] text-white text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Corregir datos
          </button>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-12 px-6 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-60 text-white text-base font-display uppercase tracking-wider font-bold rounded-md inline-flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Registrando...
            </>
          ) : reviewStep ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {formConfig.submitButtonText || 'Confirmar Registro'}
            </>
          ) : formConfig.requireReviewStep ? (
            'Revisar y Continuar'
          ) : (
            formConfig.submitButtonText || 'Confirmar Registro'
          )}
        </button>
      </div>
    </form>
  );
}
