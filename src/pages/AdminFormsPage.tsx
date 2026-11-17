import React, { useEffect, useState } from 'react';
import { Save, Eye, Sliders, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DynamicFormBuilder } from '../components/DynamicFormBuilder';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MockupPreview } from '../components/MockupPreview';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import { updateContract } from '../services/contractsService';
import type { FormConfig } from '../types/mego';

interface AdminFormsPageProps {
  defaultPreview?: boolean;
}

export function AdminFormsPage({ defaultPreview = false }: AdminFormsPageProps) {
  const { user } = useAuth();
  const { contracts, loading } = useAdminData();
  const [selectedId, setSelectedId] = useState<string>('');
  const [formConfig, setFormConfig] = useState<FormConfig | null>(null);
  const [sizes, setSizes] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(defaultPreview);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShowPreview(defaultPreview);
  }, [defaultPreview]);

  const selectedContract = contracts.find((c) => c.contractId === selectedId) || contracts[0];

  useEffect(() => {
    if (selectedContract) {
      if (!selectedId) setSelectedId(selectedContract.contractId);
      setFormConfig(selectedContract.formConfig);
      setSizes(selectedContract.availableSizes);
    }
  }, [selectedContract?.contractId]);

  const handleSave = async () => {
    if (!selectedContract || !formConfig || !user) return;
    setSaving(true);
    try {
      await updateContract(
        selectedContract.contractId,
        { formConfig, availableSizes: sizes },
        { uid: user.uid, email: user.email || 'admin@megoforce.com' }
      );
      toast.success('Configuración del formulario guardada en Firestore.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar el formulario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Constructor de Formularios" breadcrumb="Motor Dinámico de Formularios">
      {loading ? (
        <LoadingState label="Cargando contratos..." rows={4} />
      ) : contracts.length === 0 || !selectedContract || !formConfig ? (
        <EmptyState
          title="No hay contratos disponibles"
          description="Crea primero un contrato para personalizar los campos, tallas e instrucciones de su formulario dinámico."
          icon={<Sliders className="w-6 h-6" />}
        />
      ) : (
        <div className="space-y-6">
          <div className="bg-[#141414] border border-[#292929] rounded-lg p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <select
              value={selectedContract.contractId}
              onChange={(e) => {
                const next = contracts.find((c) => c.contractId === e.target.value);
                setSelectedId(e.target.value);
                if (next) {
                  setFormConfig(next.formConfig);
                  setSizes(next.availableSizes);
                }
              }}
              aria-label="Seleccionar contrato a configurar"
              className="h-10 px-3 bg-[#080808] border border-[#292929] rounded-md text-sm text-white max-w-md outline-none"
            >
              {contracts.map((c) => (
                <option key={c.contractId} value={c.contractId}>
                  {c.contractCode} · {c.title}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="h-10 px-4 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs sm:text-sm font-medium rounded-md inline-flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Volver al Editor' : 'Vista Previa'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="h-10 px-5 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-md inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Formulario
              </button>
            </div>
          </div>

          {showPreview ? (
            <MockupPreview
              contract={{
                ...selectedContract,
                availableSizes: sizes,
                formConfig,
              }}
            />
          ) : (
            <DynamicFormBuilder
              formConfig={formConfig}
              availableSizes={sizes}
              onChangeFormConfig={setFormConfig}
              onChangeSizes={setSizes}
            />
          )}
        </div>
      )}
    </AdminLayout>
  );
}
