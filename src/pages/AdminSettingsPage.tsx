import React, { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../components/AdminLayout';
import { DashboardCard } from '../components/DashboardCard';
import { LoadingState } from '../components/LoadingState';
import { MegoLogo } from '../components/MegoLogo';
import { useAdminData } from '../hooks/useAdminData';
import { useAuth } from '../hooks/useAuth';
import { saveGlobalSettings } from '../services/settingsService';
import type { GlobalSettings } from '../types/mego';
import { DEFAULT_GLOBAL_SETTINGS } from '../utils/defaultForm';

export function AdminSettingsPage() {
  const { user } = useAuth();
  const { settings, loading } = useAdminData();
  const [form, setForm] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [sizesInput, setSizesInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
    setSizesInput((settings.defaultSizes || []).join(', '));
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsedSizes = sizesInput
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      await saveGlobalSettings(
        {
          ...form,
          defaultSizes: parsedSizes.length > 0 ? parsedSizes : DEFAULT_GLOBAL_SETTINGS.defaultSizes,
        },
        { uid: user.uid, email: user.email || 'admin@megoforce.com' }
      );
      toast.success('Configuración global guardada.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar ajustes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Configuración Global" breadcrumb="Marca, Tallas y Políticas">
      {loading ? (
        <LoadingState label="Cargando configuración..." rows={4} />
      ) : (
        <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
          <DashboardCard title="Identidad Visual y Branding">
            <div className="space-y-4">
              <div className="p-4 bg-[#0B0B0B] border border-[#292929] rounded flex items-center justify-between">
                <MegoLogo brandName={form.brandName} logoUrl={form.logoUrl} size="md" showTagline />
                <span className="text-xs text-[#888888]">Vista previa de marca</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Nombre de marca</label>
                  <input
                    type="text"
                    required
                    value={form.brandName}
                    onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">URL del Logo Oficial (opcional)</label>
                  <input
                    type="text"
                    value={form.logoUrl || ''}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    placeholder="https://... o /uploads/..."
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Color principal</label>
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm font-mono text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Color corporativo de acento</label>
                  <input
                    type="text"
                    value={form.accentColor}
                    onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm font-mono text-white"
                  />
                </div>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Parámetros Operativos y Políticas">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Correo de contacto</label>
                  <input
                    type="email"
                    value={form.contactEmail || ''}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Teléfono de contacto</label>
                  <input
                    type="text"
                    value={form.contactPhone || ''}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Formato de fechas</label>
                  <input
                    type="text"
                    value={form.dateFormat || 'dd/MM/yyyy HH:mm'}
                    onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm font-mono text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#B5B5B5]">Zona horaria</label>
                  <input
                    type="text"
                    value={form.timezone || 'America/Caracas'}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm font-mono text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#B5B5B5]">
                  Tallas predeterminadas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={sizesInput}
                  onChange={(e) => setSizesInput(e.target.value)}
                  className="w-full h-10 px-3 bg-[#080808] border border-[#292929] rounded text-sm font-mono text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#B5B5B5]">Mensaje de confirmación predeterminado</label>
                <textarea
                  rows={2}
                  value={form.defaultConfirmationMessage || ''}
                  onChange={(e) =>
                    setForm({ ...form, defaultConfirmationMessage: e.target.value })
                  }
                  className="w-full p-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#B5B5B5]">Política de privacidad predeterminada</label>
                <textarea
                  rows={3}
                  required
                  value={form.privacyPolicyText}
                  onChange={(e) => setForm({ ...form, privacyPolicyText: e.target.value })}
                  className="w-full p-3 bg-[#080808] border border-[#292929] rounded text-sm text-white"
                />
              </div>
            </div>
          </DashboardCard>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-6 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-white text-sm font-semibold rounded-md inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Configuración Global
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
