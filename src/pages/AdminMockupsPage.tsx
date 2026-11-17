import React, { useEffect, useState } from 'react';
import {
  Save,
  Image as ImageIcon,
  Loader2,
  Eye,
  Copy,
  ExternalLink,
  MessageCircle,
  Mail,
  Sparkles,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { EmptyState } from '../components/EmptyState';
import { ImageGallery } from '../components/ImageGallery';
import { ImageUploader } from '../components/ImageUploader';
import { LoadingState } from '../components/LoadingState';
import { MockupPreview } from '../components/MockupPreview';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import { seedSampleContractForAdmin, updateContract } from '../services/contractsService';
import type { MockupImage } from '../types/mego';
import { publicUrl as buildClientUrl } from '../config/appMode';

export function AdminMockupsPage() {
  const { user } = useAuth();
  const { contracts, loading } = useAdminData();
  const [selectedContractId, setSelectedContractId] = useState<string>('');

  const [garmentType, setGarmentType] = useState('');
  const [title, setTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [description, setDescription] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [additionalGarmentsText, setAdditionalGarmentsText] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [unitPriceInput, setUnitPriceInput] = useState('');
  const [draftImages, setDraftImages] = useState<MockupImage[]>([]);

  const [showLivePreview, setShowLivePreview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const selectedContract =
    contracts.find((c) => c.contractId === selectedContractId) || contracts[0];

  useEffect(() => {
    if (!selectedContract) return;
    setGarmentType(selectedContract.garmentType || '');
    setTitle(selectedContract.title || '');
    setOrganizationName(selectedContract.organizationName || '');
    setDescription(selectedContract.description || '');
    setFeaturesText((selectedContract.garmentFeatures || []).join('\n'));
    setAdditionalGarmentsText((selectedContract.additionalGarments || []).join('\n'));
    setCurrency(selectedContract.currency || 'USD');
    setUnitPriceInput(
      selectedContract.unitPrice !== undefined ? String(selectedContract.unitPrice) : ''
    );
    setDraftImages(selectedContract.mockupImages || []);
  }, [selectedContract]);

  const handleSeedSample = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const created = await seedSampleContractForAdmin({
        uid: user.uid,
        email: user.email || 'admin@megoforce.com',
      });
      setSelectedContractId(created.contractId);
      toast.success('Contrato de prueba creado. Ya puedes editar la prenda y presentación.');
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo crear el contrato de prueba.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSavePresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !user) return;
    if (!garmentType.trim() || !title.trim() || !organizationName.trim()) {
      toast.error(
        'Completa el Nombre oficial de la prenda, Título de presentación y Organización.'
      );
      return;
    }

    setSaving(true);
    try {
      const parsedPrice = unitPriceInput.trim() ? Number(unitPriceInput) : undefined;
      const unitPrice =
        parsedPrice !== undefined && !Number.isNaN(parsedPrice) && parsedPrice >= 0
          ? parsedPrice
          : undefined;

      await updateContract(
        selectedContract.contractId,
        {
          garmentType: garmentType.trim(),
          title: title.trim(),
          organizationName: organizationName.trim(),
          description: description.trim(),
          garmentFeatures: featuresText
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
          additionalGarments: additionalGarmentsText
            .split('\n')
            .map((x) => x.trim())
            .filter(Boolean),
          currency: currency.trim() || 'USD',
          ...(unitPrice !== undefined ? { unitPrice } : {}),
          mockupImages: draftImages,
        },
        { uid: user.uid, email: user.email || 'admin@megoforce.com' }
      );
      toast.success(
        'Presentación, nombre oficial de la prenda y mockups actualizados en los enlaces públicos.'
      );
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la presentación.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (url: string, label: string) => {
    await navigator.clipboard.writeText(url);
    toast.success(label);
  };

  const individualUrl = selectedContract
    ? buildClientUrl(`/registro/${selectedContract.publicToken}`)
    : '';
  const bulkUrl =
    selectedContract && selectedContract.bulkToken
      ? buildClientUrl(`/registro-masivo/${selectedContract.bulkToken}`)
      : '';

  const buildShareText = (mode: 'individual' | 'bulk', url: string) => {
    const org = organizationName.trim() || selectedContract?.organizationName || '';
    const garment = garmentType.trim() || selectedContract?.garmentType || '';
    const ctrTitle = title.trim() || selectedContract?.title || '';
    return mode === 'bulk'
      ? `Hola, compartimos el enlace de registro masivo de ${org} para "${ctrTitle}" (Prenda oficial: ${garment}). Ingresa aquí para cargar la nómina de tu equipo: ${url}`
      : `Hola, te compartimos el enlace oficial de registro para ${org} — "${ctrTitle}" (Prenda oficial: ${garment}). Completa tu talla y datos aquí: ${url}`;
  };

  const previewContract = selectedContract
    ? {
        ...selectedContract,
        garmentType,
        title,
        organizationName,
        description,
        garmentFeatures: featuresText
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        additionalGarments: additionalGarmentsText
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean),
        currency,
        unitPrice: unitPriceInput.trim() ? Number(unitPriceInput) : undefined,
        mockupImages: draftImages,
      }
    : null;

  return (
    <AdminLayout
      title="Presentación, Prenda y Mockups"
      breadcrumb="Edita el nombre oficial de la prenda y el mockup antes de enviar el enlace al cliente"
    >
      {loading ? (
        <LoadingState label="Cargando contratos y editor de presentaciones..." rows={4} />
      ) : !selectedContract ? (
        <EmptyState
          title="Sin contratos disponibles"
          description="Crea primero un contrato o carga un contrato de prueba para editar la presentación del mockup y el nombre oficial de la prenda."
          actionLabel={seeding ? 'Creando contrato...' : 'Cargar Contrato de Prueba'}
          onAction={handleSeedSample}
          icon={<ImageIcon className="w-6 h-6 text-[#ED1010]" />}
        />
      ) : (
        <form onSubmit={handleSavePresentation} className="space-y-6">
          {/* Top Selector & Save Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#141414] border border-[#292929] rounded-lg p-4">
            <div className="space-y-1 flex-1 max-w-xl">
              <label className="text-xs text-[#888888]">
                Contrato a editar antes de enviar el enlace al cliente
              </label>
              <select
                value={selectedContract.contractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                aria-label="Seleccionar contrato para editar presentación y mockups"
                className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white outline-none"
              >
                {contracts.map((c) => (
                  <option key={c.contractId} value={c.contractId}>
                    {c.contractCode} · {c.organizationName} — {c.garmentType} ({c.mockupImages?.length || 0} mockups)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowLivePreview((prev) => !prev)}
                className="h-10 px-4 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Eye className="w-4 h-4 text-[#ED1010]" />
                {showLivePreview ? 'Ocultar Vista Previa' : 'Ver Vista Previa'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-white text-xs font-semibold rounded inline-flex items-center gap-2 whitespace-nowrap"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Presentación y Mockups
              </button>
            </div>
          </div>

          {/* Editable Presentation & Official Garment Name */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <DashboardCard
              title="Datos Editables de la Presentación y Prenda"
              subtitle="Cualquier ajuste aquí actualiza instantáneamente el enlace público antes de compartirlo"
              className="lg:col-span-7"
            >
              <div className="space-y-4">
                <div className="p-3.5 bg-[#0B0B0B] border border-[#ED1010]/40 rounded-md space-y-2">
                  <label
                    htmlFor="official-garment-name"
                    className="text-xs font-semibold uppercase tracking-wide text-white flex items-center justify-between gap-2"
                  >
                    <span>Nombre Oficial de la Prenda *</span>
                    <span className="text-[11px] font-normal text-[#4ADE80]">
                      Completamente editable
                    </span>
                  </label>
                  <input
                    id="official-garment-name"
                    type="text"
                    required
                    value={garmentType}
                    onChange={(e) => setGarmentType(e.target.value)}
                    placeholder="Ej. Jersey Competitivo Pro Dry-Tech 180g"
                    className="w-full h-11 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded text-sm font-semibold text-white outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[#888888] inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#ED1010]" />
                      Ejemplos rápidos:
                    </span>
                    {[
                      'Jersey Competitivo Pro Dry-Tech 180g',
                      'Kit Oficial Running + Short Sublimado',
                      'Chaqueta Rompevientos Corporativa Elite',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setGarmentType(preset)}
                        className="text-[11px] px-2 py-0.5 bg-[#141414] hover:bg-[#222222] border border-[#292929] rounded text-[#D4D4D4]"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#B5B5B5]">Título del Contrato / Campaña *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded text-sm text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#B5B5B5]">Organización / Cliente *</label>
                    <input
                      type="text"
                      required
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#B5B5B5] inline-flex items-center gap-1">
                      <Tag className="w-3 h-3 text-[#ED1010]" />
                      Moneda y Precio Unitario
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        aria-label="Moneda"
                        className="h-10 px-2 bg-[#080808] border border-[#292929] rounded text-xs text-white"
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
                        className="flex-1 min-w-0 h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm font-mono text-white"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs text-[#B5B5B5]">
                      Descripción visible para el cliente
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Detalles de confección, tela, gramaje y tiempos de entrega..."
                      className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#B5B5B5]">
                      Características técnicas (1 por línea)
                    </label>
                    <textarea
                      rows={3}
                      value={featuresText}
                      onChange={(e) => setFeaturesText(e.target.value)}
                      className="w-full p-2.5 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#B5B5B5]">
                      Prendas adicionales multi-artículo (1 por línea)
                    </label>
                    <textarea
                      rows={3}
                      value={additionalGarmentsText}
                      onChange={(e) => setAdditionalGarmentsText(e.target.value)}
                      placeholder={'Ej.\nShort Pro\nMedias Técnicas'}
                      className="w-full p-2.5 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </DashboardCard>

            {/* Personalized Client Link Sharing */}
            <DashboardCard
              title="Enviar Enlaces Personalizados al Cliente"
              subtitle="Guarda tus cambios arriba antes de copiar o enviar el enlace"
              className="lg:col-span-5"
            >
              <div className="space-y-4">
                <div className="p-3.5 bg-[#0B0B0B] border border-[#292929] rounded-md space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">Enlace Individual Público</span>
                    <span
                      className={
                        selectedContract.individualRegistrationEnabled !== false
                          ? 'text-[#4ADE80]'
                          : 'text-[#F87171]'
                      }
                    >
                      {selectedContract.individualRegistrationEnabled !== false
                        ? 'Habilitado'
                        : 'Deshabilitado'}
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={individualUrl}
                    aria-label="Enlace individual público"
                    className="w-full h-9 px-2.5 bg-[#080808] border border-[#292929] rounded text-xs font-mono text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(individualUrl, 'Enlace individual copiado.')}
                      className="h-8 px-2.5 bg-[#292929] hover:bg-[#383838] text-white text-xs rounded inline-flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar
                    </button>
                    <a
                      href={individualUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-2.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        buildShareText('individual', individualUrl)
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-2.5 bg-[#16A34A]/20 hover:bg-[#16A34A]/30 border border-[#16A34A]/50 text-[#4ADE80] text-xs font-medium rounded inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" />
                      WhatsApp
                    </a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(
                        `MEGO FORCE · ${title || selectedContract.title} (${garmentType})`
                      )}&body=${encodeURIComponent(buildShareText('individual', individualUrl))}`}
                      className="h-8 px-2.5 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs rounded inline-flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      Correo
                    </a>
                  </div>
                </div>

                <div className="p-3.5 bg-[#0B0B0B] border border-[#292929] rounded-md space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">
                      Enlace Masivo Organización
                    </span>
                    <span
                      className={
                        selectedContract.bulkRegistrationEnabled
                          ? 'text-[#4ADE80]'
                          : 'text-[#888888]'
                      }
                    >
                      {selectedContract.bulkRegistrationEnabled ? 'Habilitado' : 'Deshabilitado'}
                    </span>
                  </div>
                  {bulkUrl ? (
                    <>
                      <input
                        type="text"
                        readOnly
                        value={bulkUrl}
                        aria-label="Enlace masivo público"
                        className="w-full h-9 px-2.5 bg-[#080808] border border-[#292929] rounded text-xs font-mono text-white"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copyLink(bulkUrl, 'Enlace masivo copiado.')}
                          className="h-8 px-2.5 bg-[#292929] hover:bg-[#383838] text-white text-xs rounded inline-flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Copiar
                        </button>
                        <a
                          href={bulkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-2.5 bg-white hover:bg-neutral-200 text-[#080808] text-xs font-bold rounded inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir
                        </a>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            buildShareText('bulk', bulkUrl)
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-2.5 bg-[#16A34A]/20 hover:bg-[#16A34A]/30 border border-[#16A34A]/50 text-[#4ADE80] text-xs font-medium rounded inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </a>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[#888888]">
                      Habilita la modalidad masiva desde el detalle del contrato para obtener el enlace de organización.
                    </p>
                  )}
                </div>
              </div>
            </DashboardCard>
          </div>

          {/* Mockups Gallery Upload & Ordering */}
          <DashboardCard
            title={`Galería Oficial de Mockups — ${garmentType || selectedContract.garmentType}`}
            subtitle="Sube nuevas vistas, define la portada con la estrella o ajusta leyendas y orden."
          >
            <div className="space-y-6">
              <ImageUploader
                contractId={selectedContract.contractId}
                currentCount={draftImages.length}
                onUploaded={(imgs) => setDraftImages((prev) => [...prev, ...imgs])}
              />
              <ImageGallery images={draftImages} editable onChange={setDraftImages} />
            </div>
          </DashboardCard>

          {/* Live Client Presentation Preview */}
          {showLivePreview && previewContract && (
            <DashboardCard
              title="Vista Previa Exacta del Cliente (Antes de Enviar el Enlace)"
              subtitle="Refleja en tiempo real el nombre oficial de la prenda, descripción, precio y galería de mockups"
            >
              <MockupPreview contract={previewContract} />
            </DashboardCard>
          )}
        </form>
      )}
    </AdminLayout>
  );
}
