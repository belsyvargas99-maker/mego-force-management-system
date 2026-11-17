import React, { useState } from 'react';
import { Eye, Save, Loader2, CalendarClock, UsersRound, UserCheck, Tag } from 'lucide-react';
import type { Contract, ContractStatus, FormConfig, MockupImage } from '../types/mego';
import { CONTRACT_STATUS_META, SUPPORTED_TIMEZONES } from '../utils/contractSchedule';
import { createDefaultFormConfig, DEFAULT_AVAILABLE_SIZES } from '../utils/defaultForm';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import { ImageGallery } from './ImageGallery';
import { ImageUploader } from './ImageUploader';
import { MockupPreview } from './MockupPreview';

interface ContractFormProps {
  initialContract?: Contract;
  saving?: boolean;
  onSubmit: (payload: {
    contractCode: string;
    organizationName: string;
    title: string;
    description: string;
    garmentType: string;
    garmentFeatures: string[];
    additionalGarments: string[];
    currency: string;
    unitPrice?: number;
    status: ContractStatus;
    startDate: string;
    endDate: string;
    openDate: string;
    openTime: string;
    closeDate: string;
    closeTime: string;
    timezone: string;
    closedMessage: string;
    individualRegistrationEnabled: boolean;
    bulkRegistrationEnabled: boolean;
    availableSizes: string[];
    mockupImages: MockupImage[];
    formConfig: FormConfig;
  }) => Promise<void>;
}

export function ContractForm({
  initialContract,
  saving = false,
  onSubmit,
}: ContractFormProps) {
  const [tab, setTab] = useState<'general' | 'mockups' | 'form' | 'preview'>('general');

  const [contractCode, setContractCode] = useState(
    initialContract?.contractCode || `MF-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`
  );
  const [organizationName, setOrganizationName] = useState(
    initialContract?.organizationName || ''
  );
  const [title, setTitle] = useState(initialContract?.title || '');
  const [description, setDescription] = useState(initialContract?.description || '');
  const [garmentType, setGarmentType] = useState(
    initialContract?.garmentType || 'Jersey Sublimado Pro'
  );
  const [featuresText, setFeaturesText] = useState(
    (initialContract?.garmentFeatures || ['Tela Dry-Tech transpirable', 'Sublimación HD permanente']).join('\n')
  );
  const [additionalGarmentsText, setAdditionalGarmentsText] = useState(
    (initialContract?.additionalGarments || []).join('\n')
  );
  const [currency, setCurrency] = useState(initialContract?.currency || 'USD');
  const [unitPriceInput, setUnitPriceInput] = useState(
    initialContract?.unitPrice !== undefined ? String(initialContract.unitPrice) : ''
  );
  const [status, setStatus] = useState<ContractStatus>(initialContract?.status || 'active');
  const [openDate, setOpenDate] = useState(
    initialContract?.openDate || initialContract?.startDate || new Date().toISOString().slice(0, 10)
  );
  const [openTime, setOpenTime] = useState(initialContract?.openTime || '00:00');
  const [closeDate, setCloseDate] = useState(
    initialContract?.closeDate || initialContract?.endDate || ''
  );
  const [closeTime, setCloseTime] = useState(initialContract?.closeTime || '23:59');
  const [timezone, setTimezone] = useState(initialContract?.timezone || 'America/Caracas');
  const [closedMessage, setClosedMessage] = useState(
    initialContract?.closedMessage ||
      'El plazo de registro para este contrato ha finalizado. Contacta al coordinador de tu organización.'
  );
  const [individualRegistrationEnabled, setIndividualRegistrationEnabled] = useState(
    initialContract?.individualRegistrationEnabled !== false
  );
  const [bulkRegistrationEnabled, setBulkRegistrationEnabled] = useState(
    Boolean(initialContract?.bulkRegistrationEnabled)
  );

  const [availableSizes, setAvailableSizes] = useState<string[]>(
    initialContract?.availableSizes || [...DEFAULT_AVAILABLE_SIZES]
  );
  const [mockupImages, setMockupImages] = useState<MockupImage[]>(
    initialContract?.mockupImages || []
  );
  const [formConfig, setFormConfig] = useState<FormConfig>(
    initialContract?.formConfig || createDefaultFormConfig()
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!contractCode.trim() || !organizationName.trim() || !title.trim() || !garmentType.trim()) {
      setValidationError('Completa Código, Organización, Nombre del Contrato y Tipo de Prenda.');
      setTab('general');
      return;
    }

    if (openDate && closeDate && `${closeDate}T${closeTime}` < `${openDate}T${openTime}`) {
      setValidationError('La fecha y hora de cierre no pueden ser anteriores a la apertura.');
      setTab('general');
      return;
    }

    const garmentFeatures = featuresText
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

    const additionalGarments = additionalGarmentsText
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

    const parsedPrice = unitPriceInput.trim() ? Number(unitPriceInput) : undefined;
    const unitPrice =
      parsedPrice !== undefined && !Number.isNaN(parsedPrice) && parsedPrice >= 0
        ? parsedPrice
        : undefined;

    await onSubmit({
      contractCode: contractCode.trim(),
      organizationName: organizationName.trim(),
      title: title.trim(),
      description: description.trim(),
      garmentType: garmentType.trim(),
      garmentFeatures,
      additionalGarments,
      currency: currency.trim() || 'USD',
      ...(unitPrice !== undefined ? { unitPrice } : {}),
      status,
      startDate: openDate,
      endDate: closeDate,
      openDate,
      openTime,
      closeDate,
      closeTime,
      timezone,
      closedMessage: closedMessage.trim(),
      individualRegistrationEnabled,
      bulkRegistrationEnabled,
      availableSizes,
      mockupImages,
      formConfig,
    });
  };

  const draftPreview = {
    contractId: initialContract?.contractId || 'draft_preview',
    contractCode,
    organizationName,
    title,
    description,
    garmentType,
    garmentFeatures: featuresText.split('\n').filter(Boolean),
    additionalGarments: additionalGarmentsText.split('\n').map((x) => x.trim()).filter(Boolean),
    currency,
    unitPrice: unitPriceInput.trim() ? Number(unitPriceInput) : undefined,
    status,
    openDate,
    openTime,
    closeDate,
    closeTime,
    timezone,
    closedMessage,
    individualRegistrationEnabled,
    bulkRegistrationEnabled,
    publicToken: initialContract?.publicToken || 'preview-token',
    availableSizes,
    mockupImages,
    formConfig,
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292929] pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#141414] p-1 rounded-lg border border-[#292929]">
          {[
            { id: 'general', label: '1. Datos y Modalidades' },
            { id: 'mockups', label: `2. Mockups (${mockupImages.length})` },
            { id: 'form', label: '3. Constructor de Formulario' },
            { id: 'preview', label: '4. Vista Previa Pública' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as any)}
              className={`px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-[#ED1010] text-white'
                  : 'text-[#B5B5B5] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-10 px-5 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-white text-sm font-semibold rounded-md inline-flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : initialContract ? 'Guardar Cambios' : 'Crear Contrato'}
        </button>
      </div>

      {validationError && (
        <div className="p-3.5 rounded-md bg-[#ED1010]/15 border border-[#ED1010]/50 text-sm text-white">
          {validationError}
        </div>
      )}

      {tab === 'general' && (
        <div className="space-y-6">
          <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Código de contrato *</label>
                <input
                  type="text"
                  required
                  value={contractCode}
                  onChange={(e) => setContractCode(e.target.value)}
                  placeholder="Ej. MF-2026-001"
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm font-mono text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Organización / Club *</label>
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Ej. Academia Titanes"
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Estado del contrato</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContractStatus)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                >
                  {(Object.keys(CONTRACT_STATUS_META) as ContractStatus[]).map((st) => (
                    <option key={st} value={st}>
                      {CONTRACT_STATUS_META[st].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Nombre del contrato *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Uniformes Torneo Nacional 2026"
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">
                  Nombre oficial de la prenda *
                </label>
                <input
                  type="text"
                  required
                  value={garmentType}
                  onChange={(e) => setGarmentType(e.target.value)}
                  placeholder="Ej. Jersey Oficial Torneo Dry-Tech 180g"
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5] inline-flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#ED1010]" />
                  Precio unitario
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    aria-label="Moneda"
                    className="h-10 px-2 bg-[#080808] border border-[#292929] rounded-md text-xs text-white"
                  >
                    <option value="USD">USD</option>
                    <option value="VES">VES</option>
                    <option value="COP">COP</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPriceInput}
                    onChange={(e) => setUnitPriceInput(e.target.value)}
                    placeholder="Ej. 35"
                    className="flex-1 min-w-0 h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm font-mono text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Descripción de la prenda y alcance</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe tela, acabados, detalles de confección y entrega..."
                  className="w-full p-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">
                  Características técnicas (una por línea)
                </label>
                <textarea
                  rows={3}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  className="w-full p-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-xs text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">
                  Prendas adicionales multi-artículo (opcional, 1 por línea)
                </label>
                <textarea
                  rows={3}
                  value={additionalGarmentsText}
                  onChange={(e) => setAdditionalGarmentsText(e.target.value)}
                  placeholder={'Ej.\nShort Pro\nSudadera Entrenamiento'}
                  className="w-full p-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Module 2: Automatic Closing & Schedule Window */}
          <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
              <CalendarClock className="w-4 h-4 text-[#ED1010]" />
              <h3 className="font-display text-lg uppercase tracking-wide text-white">
                Programación de Apertura y Cierre Automático
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Fecha de apertura</label>
                <input
                  type="date"
                  value={openDate}
                  onChange={(e) => setOpenDate(e.target.value)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Hora de apertura</label>
                <input
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm font-mono text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Fecha de cierre</label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Hora de cierre</label>
                <input
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm font-mono text-white outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#B5B5B5]">Zona horaria</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
                >
                  {SUPPORTED_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#B5B5B5]">
                Mensaje personalizado para visitantes cuando el contrato expire o cierre
              </label>
              <input
                type="text"
                value={closedMessage}
                onChange={(e) => setClosedMessage(e.target.value)}
                placeholder="Mensaje mostrado al expirar la fecha de cierre..."
                className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Version 2.1: Registration Modalities (Individual + Public Bulk) */}
          <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-4">
            <h3 className="font-display text-lg uppercase tracking-wide text-white border-b border-[#222222] pb-2">
              Configuración de Modalidades de Registro Público
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-md bg-[#0B0B0B] border border-[#292929]">
                <input
                  type="checkbox"
                  checked={individualRegistrationEnabled}
                  onChange={(e) => setIndividualRegistrationEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#ED1010]"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <UserCheck className="w-4 h-4 text-[#ED1010]" />
                    <span>Habilitar Registro Individual Público</span>
                  </div>
                  <p className="text-xs text-[#888888] leading-relaxed">
                    Permite que cada participante ingrese con el enlace del contrato y complete su propio formulario de registro.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-md bg-[#0B0B0B] border border-[#292929]">
                <input
                  type="checkbox"
                  checked={bulkRegistrationEnabled}
                  onChange={(e) => setBulkRegistrationEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#ED1010]"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <UsersRound className="w-4 h-4 text-[#ED1010]" />
                    <span>Habilitar Registro Masivo Público (Organizaciones)</span>
                  </div>
                  <p className="text-xs text-[#888888] leading-relaxed">
                    Genera un enlace público independiente para que el representante cargue múltiples participantes mediante tabla o Excel/CSV sin cuenta administrativa.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {tab === 'mockups' && (
        <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-6">
          <div>
            <h3 className="font-display text-lg uppercase tracking-wide text-white">
              Galería Oficial de Mockups
            </h3>
            <p className="text-xs text-[#888888] mt-1">
              Sube las imágenes aprobadas del uniforme. Marca la estrella para elegir la imagen de portada principal.
            </p>
          </div>

          <ImageUploader
            contractId={initialContract?.contractId || 'draft_temp'}
            currentCount={mockupImages.length}
            onUploaded={(imgs) => setMockupImages((prev) => [...prev, ...imgs])}
          />

          <ImageGallery
            images={mockupImages}
            editable
            onChange={setMockupImages}
          />
        </div>
      )}

      {tab === 'form' && (
        <DynamicFormBuilder
          formConfig={formConfig}
          availableSizes={availableSizes}
          onChangeFormConfig={setFormConfig}
          onChangeSizes={setAvailableSizes}
        />
      )}

      {tab === 'preview' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-[#888888]">
            <Eye className="w-4 h-4 text-[#ED1010]" />
            <span>
              Esta es la vista exacta que verán los participantes antes de publicar o activar el contrato.
            </span>
          </div>
          <MockupPreview contract={draftPreview} />
        </div>
      )}
    </form>
  );
}
