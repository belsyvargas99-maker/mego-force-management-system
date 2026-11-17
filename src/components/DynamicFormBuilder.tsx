import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react';
import type { DynamicFieldType, FormConfig, FormFieldConfig } from '../types/mego';
import { generateEntityId } from '../utils/normalizers';

interface DynamicFormBuilderProps {
  formConfig: FormConfig;
  availableSizes: string[];
  onChangeFormConfig: (next: FormConfig) => void;
  onChangeSizes: (nextSizes: string[]) => void;
}

const FIELD_TYPES: { value: DynamicFieldType; label: string }[] = [
  { value: 'short_text', label: 'Texto corto' },
  { value: 'long_text', label: 'Texto largo' },
  { value: 'number', label: 'Número' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'email', label: 'Correo electrónico' },
  { value: 'select', label: 'Lista desplegable' },
  { value: 'single_choice', label: 'Selección única' },
  { value: 'multi_checkbox', label: 'Casillas múltiples' },
  { value: 'date', label: 'Fecha' },
  { value: 'custom', label: 'Campo personalizado' },
];

export function DynamicFormBuilder({
  formConfig,
  availableSizes,
  onChangeFormConfig,
  onChangeSizes,
}: DynamicFormBuilderProps) {
  const [newSizeInput, setNewSizeInput] = useState('');

  const sortedFields = [...formConfig.fields].sort((a, b) => a.order - b.order);

  const updateMeta = <K extends keyof FormConfig>(key: K, val: FormConfig[K]) => {
    onChangeFormConfig({ ...formConfig, [key]: val });
  };

  const updateField = (id: string, patch: Partial<FormFieldConfig>) => {
    onChangeFormConfig({
      ...formConfig,
      fields: sortedFields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const moveField = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sortedFields.length) return;
    const copy = [...sortedFields];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChangeFormConfig({
      ...formConfig,
      fields: copy.map((f, i) => ({ ...f, order: i + 1 })),
    });
  };

  const addCustomField = () => {
    const id = generateEntityId('fld');
    const nextField: FormFieldConfig = {
      id,
      key: `custom_${id}`,
      label: 'CAMPO PERSONALIZADO',
      type: 'short_text',
      required: false,
      enabled: true,
      placeholder: 'Escribe aquí...',
      helpText: '',
      options: ['Opción 1', 'Opción 2'],
      maxLength: 120,
      isSystemDefault: false,
      order: sortedFields.length + 1,
    };
    onChangeFormConfig({
      ...formConfig,
      fields: [...sortedFields, nextField],
    });
  };

  const removeField = (id: string) => {
    const next = sortedFields
      .filter((f) => f.id !== id)
      .map((f, i) => ({ ...f, order: i + 1 }));
    onChangeFormConfig({ ...formConfig, fields: next });
  };

  const addSize = () => {
    const clean = newSizeInput.trim().toUpperCase();
    if (!clean || availableSizes.includes(clean)) return;
    const nextSizes = [...availableSizes, clean];
    onChangeSizes(nextSizes);
    // Keep TALLA field options synchronized
    onChangeFormConfig({
      ...formConfig,
      fields: sortedFields.map((f) =>
        f.key === 'size' ? { ...f, options: nextSizes } : f
      ),
    });
    setNewSizeInput('');
  };

  const removeSize = (size: string) => {
    if (availableSizes.length <= 1) return;
    const nextSizes = availableSizes.filter((s) => s !== size);
    onChangeSizes(nextSizes);
    onChangeFormConfig({
      ...formConfig,
      fields: sortedFields.map((f) =>
        f.key === 'size' ? { ...f, options: nextSizes } : f
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* General Copy & Instructions */}
      <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-4">
        <h3 className="font-display text-lg uppercase tracking-wide text-white">
          Textos, Instrucciones y Comportamiento
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#B5B5B5]">Título del formulario</label>
            <input
              type="text"
              value={formConfig.title}
              onChange={(e) => updateMeta('title', e.target.value)}
              className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#B5B5B5]">Subtítulo</label>
            <input
              type="text"
              value={formConfig.subtitle}
              onChange={(e) => updateMeta('subtitle', e.target.value)}
              className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#B5B5B5]">Instrucciones para participantes</label>
          <textarea
            rows={3}
            value={formConfig.instructions}
            onChange={(e) => updateMeta('instructions', e.target.value)}
            className="w-full p-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#B5B5B5]">Texto del botón de envío</label>
            <input
              type="text"
              value={formConfig.submitButtonText}
              onChange={(e) => updateMeta('submitButtonText', e.target.value)}
              className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
            />
          </div>

          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm text-white">
              <input
                type="checkbox"
                checked={formConfig.requireReviewStep}
                onChange={(e) => updateMeta('requireReviewStep', e.target.checked)}
                className="w-4 h-4 accent-[#ED1010]"
              />
              Mostrar pantalla de revisión antes de confirmar envío
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#B5B5B5]">Mensaje de confirmación tras envío</label>
          <textarea
            rows={2}
            value={formConfig.confirmationMessage}
            onChange={(e) => updateMeta('confirmationMessage', e.target.value)}
            className="w-full p-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#B5B5B5]">
            Texto de Política de Privacidad y Tratamiento de Datos
          </label>
          <textarea
            rows={2}
            value={formConfig.privacyPolicyText}
            onChange={(e) => updateMeta('privacyPolicyText', e.target.value)}
            className="w-full p-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
          />
        </div>
      </div>

      {/* Sizes Config */}
      <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg uppercase tracking-wide text-white">
              Tallas Disponibles del Contrato
            </h3>
            <p className="text-xs text-[#888888]">
              Define el orden y las tallas habilitadas en el selector y en los listados de producción.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSizeInput}
              onChange={(e) => setNewSizeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
              placeholder="Ej. 4XL o JUV-M"
              className="h-9 px-3 bg-[#080808] border border-[#292929] rounded text-xs text-white outline-none focus:border-[#ED1010]"
            />
            <button
              type="button"
              onClick={addSize}
              className="h-9 px-3 bg-[#292929] hover:bg-[#383838] text-white text-xs font-medium rounded whitespace-nowrap"
            >
              Agregar talla
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableSizes.map((size) => (
            <div
              key={size}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0B0B0B] border border-[#292929] rounded text-xs font-mono text-white"
            >
              <span>{size}</span>
              <button
                type="button"
                onClick={() => removeSize(size)}
                aria-label={`Quitar talla ${size}`}
                className="text-[#888888] hover:text-[#ED1010]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Dynamic Fields Builder */}
      <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg uppercase tracking-wide text-white">
              Campos del Formulario
            </h3>
            <p className="text-xs text-[#888888]">
              Reordena, activa/desactiva, edita etiquetas o añade campos personalizados sin programar.
            </p>
          </div>
          <button
            type="button"
            onClick={addCustomField}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded-md whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Agregar campo
          </button>
        </div>

        <div className="space-y-3">
          {sortedFields.map((field, idx) => {
            const hasOptions =
              field.type === 'select' ||
              field.type === 'single_choice' ||
              field.type === 'multi_checkbox';

            return (
              <div
                key={field.id}
                className={`p-4 rounded-md border transition-colors ${
                  field.enabled
                    ? 'bg-[#0B0B0B] border-[#292929]'
                    : 'bg-[#0B0B0B]/50 border-[#1F1F1F] opacity-65'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#222222]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#888888] tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-white">{field.label}</span>
                    {field.isSystemDefault && (
                      <span className="text-[11px] text-[#888888]">· Campo base</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveField(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Subir ${field.label}`}
                      className="p-1.5 rounded bg-[#1C1C1C] text-white disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(idx, 1)}
                      disabled={idx === sortedFields.length - 1}
                      aria-label={`Bajar ${field.label}`}
                      className="p-1.5 rounded bg-[#1C1C1C] text-white disabled:opacity-30"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(field.id, { enabled: !field.enabled })}
                      aria-label={field.enabled ? `Desactivar ${field.label}` : `Activar ${field.label}`}
                      className={`px-2.5 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1 ${
                        field.enabled
                          ? 'bg-[#1C1C1C] text-white'
                          : 'bg-[#292929] text-[#888888]'
                      }`}
                    >
                      {field.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {field.enabled ? 'Activo' : 'Oculto'}
                    </button>
                    {!field.isSystemDefault && (
                      <button
                        type="button"
                        onClick={() => removeField(field.id)}
                        aria-label={`Eliminar campo ${field.label}`}
                        className="p-1.5 rounded bg-[#1C1C1C] text-[#F87171] hover:bg-[#ED1010]/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#888888]">Etiqueta visible</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white outline-none focus:border-[#ED1010]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#888888]">Tipo de campo</label>
                    <select
                      value={field.type}
                      disabled={field.isSystemDefault}
                      onChange={(e) =>
                        updateField(field.id, { type: e.target.value as DynamicFieldType })
                      }
                      className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white outline-none disabled:opacity-60"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#888888]">Placeholder / Ayuda corta</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                      className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white outline-none focus:border-[#ED1010]"
                    />
                  </div>

                  <div className="flex items-end gap-4 pb-1.5">
                    <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="w-4 h-4 accent-[#ED1010]"
                      />
                      Obligatorio
                    </label>
                    {(field.key === 'nickname' || field.type === 'short_text') && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#888888]">Máx:</span>
                        <input
                          type="number"
                          min={2}
                          max={200}
                          value={field.maxLength || 60}
                          onChange={(e) =>
                            updateField(field.id, { maxLength: Number(e.target.value) || 60 })
                          }
                          className="w-16 h-8 px-2 bg-[#141414] border border-[#292929] rounded text-xs text-white tabular-nums"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#888888]">Texto de ayuda</label>
                    <input
                      type="text"
                      value={field.helpText || ''}
                      onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                      className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white outline-none focus:border-[#ED1010]"
                    />
                  </div>

                  {field.key === 'identificationNumber' && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#888888]">Formato por país (Cédula / ID)</label>
                      <select
                        value={field.countryFormat || 'GENERAL'}
                        onChange={(e) => updateField(field.id, { countryFormat: e.target.value })}
                        className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white outline-none"
                      >
                        <option value="GENERAL">General (Preservar ceros iniciales)</option>
                        <option value="VE">Venezuela (V/E + dígitos)</option>
                        <option value="CO">Colombia (CC 6-10 dígitos)</option>
                        <option value="EC">Ecuador (10 dígitos con cero inicial)</option>
                        <option value="DO">Rep. Dominicana (11 dígitos)</option>
                      </select>
                    </div>
                  )}

                  {hasOptions && field.key !== 'size' && (
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#888888]">
                        Opciones (separadas por coma)
                      </label>
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: e.target.value
                              .split(',')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full h-9 px-2.5 bg-[#141414] border border-[#292929] rounded text-xs text-white outline-none focus:border-[#ED1010]"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
