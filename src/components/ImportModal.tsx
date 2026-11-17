import React, { useState } from 'react';
import { Upload, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  bulkImportRegistrationsAdmin,
  type ImportReport,
  type ImportRowCandidate,
} from '../services/registrationsService';
import type { Contract, Registration } from '../types/mego';
import { getAdminAuthHeaders } from '../config/firebase';

interface ImportModalProps {
  open: boolean;
  contract: Contract | null;
  existingRegistrations: Registration[];
  adminUser: { uid: string; email: string };
  onClose: () => void;
}

const TARGET_FIELDS: { key: keyof ImportRowCandidate; label: string; required?: boolean }[] = [
  { key: 'fullName', label: 'Nombre y Apellido', required: true },
  { key: 'identificationNumber', label: 'Cédula', required: true },
  { key: 'size', label: 'Talla', required: true },
  { key: 'nickname', label: 'Seudónimo' },
  { key: 'phone', label: 'Teléfono', required: true },
  { key: 'instagram', label: 'Instagram' },
  { key: 'paymentSelection', label: 'Modalidad de Pago' },
];

export function ImportModal({
  open,
  contract,
  existingRegistrations,
  adminUser,
  onClose,
}: ImportModalProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<keyof ImportRowCandidate, string>>({
    fullName: '',
    identificationNumber: '',
    size: '',
    nickname: '',
    phone: '',
    instagram: '',
    paymentSelection: '',
  });
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  if (!open || !contract) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setReport(null);
    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ fileName: file.name, base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Error al analizar archivo.');
      }

      setHeaders(data.headers || []);
      setRawRows(data.rows || []);

      // Auto-guess obvious headers
      const guess = (candidates: string[]) =>
        (data.headers as string[]).find((h) =>
          candidates.some((c) => h.toLowerCase().includes(c))
        ) || '';

      setMapping({
        fullName: guess(['nombre', 'name', 'participante']),
        identificationNumber: guess(['cedula', 'cédula', 'dni', 'id', 'documento']),
        size: guess(['talla', 'size']),
        nickname: guess(['seudonimo', 'seudónimo', 'apodo', 'nick']),
        phone: guess(['telefono', 'teléfono', 'celular', 'phone', 'whatsapp']),
        instagram: guess(['instagram', 'ig']),
        paymentSelection: guess(['pago', 'payment', 'modalidad']),
      });
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo leer el archivo.');
    } finally {
      setParsing(false);
    }
  };

  const mappedPreview: ImportRowCandidate[] = rawRows.map((row) => ({
    fullName: mapping.fullName ? String(row[mapping.fullName] || '') : '',
    identificationNumber: mapping.identificationNumber
      ? String(row[mapping.identificationNumber] || '')
      : '',
    size: mapping.size ? String(row[mapping.size] || '') : '',
    nickname: mapping.nickname ? String(row[mapping.nickname] || '') : '',
    phone: mapping.phone ? String(row[mapping.phone] || '') : '',
    instagram: mapping.instagram ? String(row[mapping.instagram] || '') : '',
    paymentSelection:
      mapping.paymentSelection &&
      String(row[mapping.paymentSelection] || '')
        .toUpperCase()
        .includes('PARCIAL')
        ? 'PAGO PARCIAL'
        : 'PAGO COMPLETO',
  }));

  const incompleteCount = mappedPreview.filter(
    (r) => !r.fullName.trim() || r.identificationNumber.trim().length < 3 || !r.size.trim() || r.phone.trim().length < 5
  ).length;

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const existingHashes = new Set(
        existingRegistrations
          .filter((r) => r.contractId === contract.contractId)
          .map((r) => r.identificationHash)
      );
      const res = await bulkImportRegistrationsAdmin(
        contract,
        mappedPreview,
        existingHashes,
        adminUser
      );
      setReport(res);
      toast.success(`Importación completada: ${res.imported} registros añadidos.`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al importar participantes.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#141414] border border-[#292929] rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#292929] pb-4">
          <div>
            <h2 className="font-display text-2xl uppercase text-white">
              Importar Listado (XLSX / CSV / Word)
            </h2>
            <p className="text-xs text-[#888888] mt-0.5">
              Contrato destino: {contract.contractCode} · {contract.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar importador"
            className="p-1.5 text-[#888888] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block border-2 border-dashed border-[#292929] hover:border-[#ED1010] rounded-lg p-6 text-center cursor-pointer bg-[#0B0B0B] transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
          {parsing ? (
            <Loader2 className="w-7 h-7 text-[#ED1010] animate-spin mx-auto mb-2" />
          ) : (
            <Upload className="w-7 h-7 text-[#888888] mx-auto mb-2" />
          )}
          <p className="text-sm font-medium text-white">
            {parsing ? 'Extrayendo columnas y filas...' : 'Seleccionar archivo .XLSX, .CSV o .DOCX'}
          </p>
          <p className="text-xs text-[#888888] mt-1">
            Siempre revisa y mapea las columnas antes de confirmar la importación.
          </p>
        </label>

        {headers.length > 0 && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Mapeo de Columnas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {TARGET_FIELDS.map((tf) => (
                  <div key={tf.key} className="space-y-1">
                    <label className="text-xs text-[#B5B5B5]">
                      {tf.label} {tf.required && <span className="text-[#ED1010]">*</span>}
                    </label>
                    <select
                      value={mapping[tf.key]}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [tf.key]: e.target.value }))
                      }
                      className="w-full h-9 px-2.5 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                    >
                      <option value="">-- Ignorar --</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[#0B0B0B] border border-[#292929] rounded text-xs">
              <span className="text-white">
                Filas detectadas: <strong className="tabular-nums">{rawRows.length}</strong>
              </span>
              {incompleteCount > 0 && (
                <span className="text-[#FBBF24] inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {incompleteCount} fila(s) con campos obligatorios incompletos serán omitidas.
                </span>
              )}
            </div>

            <div className="max-h-60 overflow-auto border border-[#292929] rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0B0B0B] text-[#888888] sticky top-0">
                  <tr>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Cédula</th>
                    <th className="p-2">Talla</th>
                    <th className="p-2">Seudónimo</th>
                    <th className="p-2">Teléfono</th>
                    <th className="p-2">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]">
                  {mappedPreview.slice(0, 25).map((r, i) => (
                    <tr key={i}>
                      <td className="p-2 text-white">{r.fullName || '-'}</td>
                      <td className="p-2 font-mono">{r.identificationNumber || '-'}</td>
                      <td className="p-2 font-bold">{r.size || '-'}</td>
                      <td className="p-2">{r.nickname || '-'}</td>
                      <td className="p-2 font-mono">{r.phone || '-'}</td>
                      <td className="p-2">{r.paymentSelection}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {report && (
          <div className="p-4 bg-[#0B0B0B] border border-[#16A34A]/50 rounded-md space-y-2 text-sm">
            <div className="flex items-center gap-2 text-[#4ADE80] font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              Informe de Importación
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs tabular-nums">
              <div>Importados: <strong className="text-white">{report.imported}</strong></div>
              <div>Duplicados omitidos: <strong className="text-[#FBBF24]">{report.duplicates}</strong></div>
              <div>Rechazados: <strong className="text-[#ED1010]">{report.rejected}</strong></div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#292929]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1C1C1C] hover:bg-[#292929] text-sm rounded-md text-white"
          >
            Cerrar
          </button>
          {rawRows.length > 0 && !report && (
            <button
              type="button"
              disabled={importing}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-50 text-sm font-semibold rounded-md text-white inline-flex items-center gap-2"
            >
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Importación ({rawRows.length - incompleteCount} válidas)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
