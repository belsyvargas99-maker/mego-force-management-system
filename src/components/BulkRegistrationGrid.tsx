import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Trash2,
  Copy,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  SearchCheck,
  RotateCcw,
  FileSpreadsheet,
  Layers,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  detectExistingLocksForBulkRows,
  submitBulkOrganizationRegistrations,
} from '../services/bulkRegistrationService';
import type {
  BulkSubmissionRecord,
  PaymentSelection,
  PublicContract,
} from '../types/mego';
import {
  autoDetectColumnMapping,
  createEmptyBulkRow,
  mapRawRowsToBulkDrafts,
  validateBulkRows,
  type BulkColumnMapping,
  type BulkRowDraft,
} from '../utils/bulkValidation';

interface BulkRegistrationGridProps {
  contract: PublicContract;
  bulkToken: string;
}

interface PendingImportSheetState {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  workbook: XLSX.WorkBook;
  headers: string[];
  rawRows: Record<string, unknown>[];
  mapping: BulkColumnMapping;
}

const FIELD_MAPPING_LABELS: { key: keyof BulkColumnMapping; label: string; required?: boolean }[] = [
  { key: 'fullName', label: 'Nombre y apellido *', required: true },
  { key: 'identificationNumber', label: 'Cédula / ID *', required: true },
  { key: 'size', label: 'Talla *', required: true },
  { key: 'nickname', label: 'Seudónimo (opcional)' },
  { key: 'phone', label: 'Teléfono *', required: true },
  { key: 'instagram', label: 'Instagram (opcional)' },
  { key: 'paymentSelection', label: 'Modalidad de pago (opcional)' },
];

export function BulkRegistrationGrid({
  contract,
  bulkToken,
}: BulkRegistrationGridProps) {
  const sizes = contract.availableSizes?.length
    ? contract.availableSizes
    : ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const defaultSize = sizes[Math.min(2, sizes.length - 1)] || 'M';
  const extraGarments = contract.additionalGarments || [];
  const draftStorageKey = `mego_bulk_draft_${contract.contractId}_${bulkToken}`;

  const [representativeName, setRepresentativeName] = useState('');
  const [representativeContact, setRepresentativeContact] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [rows, setRows] = useState<BulkRowDraft[]>(() => [
    createEmptyBulkRow(defaultSize),
    createEmptyBulkRow(defaultSize),
    createEmptyBulkRow(defaultSize),
  ]);
  const [expandedGarmentRowId, setExpandedGarmentRowId] = useState<string | null>(null);
  const [existingIdKeys, setExistingIdKeys] = useState<Set<string>>(new Set());
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [previewOpen, setPreviewOpen] = useState(false);

  const [checkingLocks, setCheckingLocks] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImportSheetState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<BulkSubmissionRecord | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  // Restore saved local draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
        setRows(parsed.rows);
        if (typeof parsed.representativeName === 'string') {
          setRepresentativeName(parsed.representativeName);
        }
        if (typeof parsed.representativeContact === 'string') {
          setRepresentativeContact(parsed.representativeContact);
        }
        setDraftRestored(true);
      }
    } catch {
      // ignore corrupted draft
    }
  }, [draftStorageKey]);

  // Auto-save working draft locally to protect representatives from accidental reloads
  useEffect(() => {
    if (receipt) return;
    try {
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          representativeName,
          representativeContact,
          rows: rows.slice(0, 2000),
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      // ignore quota errors
    }
  }, [draftStorageKey, representativeName, representativeContact, rows, receipt]);

  const validation = useMemo(
    () => validateBulkRows(rows, sizes, existingIdKeys),
    [rows, sizes, existingIdKeys]
  );

  const duplicateCountLive = useMemo(
    () =>
      validation.results.filter((r) => r.isDuplicateInBatch || r.isDuplicateExisting).length,
    [validation.results]
  );

  const validationMap = useMemo(
    () => new Map(validation.results.map((r) => [r.rowId, r])),
    [validation.results]
  );

  const visibleRows = useMemo(() => {
    if (viewFilter === 'valid') {
      return rows.filter((r) => validationMap.get(r.rowId)?.isValid);
    }
    if (viewFilter === 'errors') {
      return rows.filter((r) => !validationMap.get(r.rowId)?.isValid);
    }
    return rows;
  }, [rows, viewFilter, validationMap]);

  const updateCell = <K extends keyof BulkRowDraft>(
    rowId: string,
    field: K,
    value: BulkRowDraft[K]
  ) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  };

  const updateRowExtraGarment = (
    rowId: string,
    garmentName: string,
    patch: { size?: string; nickname?: string }
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const current = [...(row.garmentItems || [])];
        const idx = current.findIndex((g) => g.garment === garmentName);
        if (idx >= 0) {
          current[idx] = { ...current[idx], ...patch };
        } else {
          current.push({
            garment: garmentName,
            size: patch.size ?? row.size ?? defaultSize,
            nickname: patch.nickname ?? '',
          });
        }
        return { ...row, garmentItems: current };
      })
    );
  };

  const addRows = (count: number) => {
    const extra = Array.from({ length: count }, () => createEmptyBulkRow(defaultSize));
    setRows((prev) => [...prev, ...extra]);
  };

  const duplicateRow = (row: BulkRowDraft) => {
    const clone: BulkRowDraft = {
      ...row,
      rowId: createEmptyBulkRow(defaultSize).rowId,
      identificationNumber: '',
      garmentItems: row.garmentItems ? row.garmentItems.map((g) => ({ ...g })) : undefined,
    };
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.rowId === row.rowId);
      if (idx === -1) return [...prev, clone];
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return [createEmptyBulkRow(defaultSize)];
      return prev.filter((r) => r.rowId !== rowId);
    });
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
    setDraftRestored(false);
    setRows([createEmptyBulkRow(defaultSize), createEmptyBulkRow(defaultSize)]);
    toast.success('Borrador reiniciado.');
  };

  const handleCheckDuplicates = async () => {
    setCheckingLocks(true);
    try {
      const locks = await detectExistingLocksForBulkRows(contract.contractId, rows);
      setExistingIdKeys(locks);
      if (locks.size > 0) {
        toast.error(`Se detectaron ${locks.size} cédula(s) ya registradas en este contrato.`);
      } else {
        toast.success('Verificación completa: ninguna cédula duplicada con registros existentes.');
      }
    } finally {
      setCheckingLocks(false);
    }
  };

  const extractSheetData = (workbook: XLSX.WorkBook, sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return { headers: [], rawRows: [] };
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });
    if (!matrix.length) return { headers: [], rawRows: [] };
    const headerRowIdx = matrix.findIndex(
      (r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim().length > 0)
    );
    if (headerRowIdx === -1) return { headers: [], rawRows: [] };

    const headers = (matrix[headerRowIdx] || []).map((cell, i) => {
      const text = String(cell ?? '').trim();
      return text || `Columna_${i + 1}`;
    });

    const rawRows: Record<string, unknown>[] = [];
    for (let i = headerRowIdx + 1; i < matrix.length; i++) {
      const rowArr = matrix[i] || [];
      const hasAnyValue = rowArr.some((v) => String(v ?? '').trim().length > 0);
      if (!hasAnyValue) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((h, colIdx) => {
        obj[h] = rowArr[colIdx] ?? '';
      });
      rawRows.push(obj);
    }
    return { headers, rawRows };
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingExcel(true);
    setSubmissionError(null);

    try {
      const buffer = await file.arrayBuffer();
      // Safe client-side SheetJS parsing: never executes formulas/macros/HTML
      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellFormula: false,
        cellHTML: false,
      });

      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        throw new Error('El archivo no contiene hojas válidas.');
      }

      const firstSheet = sheetNames[0];
      const { headers, rawRows } = extractSheetData(workbook, firstSheet);
      if (rawRows.length === 0 || headers.length === 0) {
        throw new Error('La primera hoja no contiene encabezados o filas con datos.');
      }

      const mapping = autoDetectColumnMapping(headers);
      setPendingImport({
        fileName: file.name,
        sheetNames,
        selectedSheet: firstSheet,
        workbook,
        headers,
        rawRows,
        mapping,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Error al leer el archivo Excel o CSV.');
    } finally {
      setImportingExcel(false);
    }
  };

  const handleChangeImportSheet = (sheetName: string) => {
    if (!pendingImport) return;
    const { headers, rawRows } = extractSheetData(pendingImport.workbook, sheetName);
    setPendingImport({
      ...pendingImport,
      selectedSheet: sheetName,
      headers,
      rawRows,
      mapping: autoDetectColumnMapping(headers),
    });
  };

  const handleApplyColumnMapping = async () => {
    if (!pendingImport) return;
    const { rawRows, mapping } = pendingImport;
    if (!mapping.fullName || !mapping.identificationNumber) {
      toast.error('Asigna al menos las columnas de Nombre y Cédula antes de importar.');
      return;
    }

    const importedDrafts = mapRawRowsToBulkDrafts(rawRows, mapping, defaultSize);
    if (importedDrafts.length === 0) {
      toast.error('No se encontraron filas para importar.');
      return;
    }

    setRows((prev) => {
      const hasRealData = prev.some(
        (r) => r.fullName.trim() || r.identificationNumber.trim() || r.phone.trim()
      );
      const combined = hasRealData ? [...prev, ...importedDrafts] : importedDrafts;
      return combined.slice(0, 2000);
    });
    setPendingImport(null);

    const locks = await detectExistingLocksForBulkRows(contract.contractId, importedDrafts);
    if (locks.size > 0) {
      setExistingIdKeys((prev) => new Set([...prev, ...locks]));
    }
    toast.success(`${importedDrafts.length} fila(s) importadas y validadas en la tabla.`);
  };

  const handleSubmitBulk = async () => {
    setSubmissionError(null);
    if (honeypot.trim()) {
      setSubmissionError('Solicitud bloqueada por validación de seguridad.');
      return;
    }
    if (representativeName.trim().length < 2) {
      setSubmissionError('Ingresa el nombre y apellido del representante de la organización.');
      return;
    }
    if (representativeContact.trim().length < 5) {
      setSubmissionError('Ingresa el teléfono o correo de contacto del representante.');
      return;
    }
    if (!privacyAccepted) {
      setSubmissionError('Debes aceptar la política de privacidad para confirmar el envío masivo.');
      return;
    }
    if (validation.validRows.length === 0) {
      setSubmissionError('Corrige los errores de la tabla antes de enviar; no hay filas válidas.');
      return;
    }

    setSubmitting(true);
    setProgress({ done: 0, total: validation.validRows.length });

    try {
      const locks = await detectExistingLocksForBulkRows(contract.contractId, rows);
      setExistingIdKeys(locks);

      const res = await submitBulkOrganizationRegistrations({
        contract,
        bulkToken,
        representativeName,
        representativeContact,
        rows,
        idempotencyKey: idempotencyKeyRef.current,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      try {
        localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
      setReceipt(res);
      toast.success(`Envío masivo procesado: ${res.totalSaved} registro(s) guardados.`);
    } catch (err: any) {
      const msg = err?.message || 'Ocurrió un error de red al procesar el registro masivo.';
      setSubmissionError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewBatch = () => {
    idempotencyKeyRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    setReceipt(null);
    setSubmissionError(null);
    setProgress(null);
    setDraftRestored(false);
    setRows([createEmptyBulkRow(defaultSize), createEmptyBulkRow(defaultSize)]);
  };

  if (receipt) {
    return (
      <div className="bg-[#141414] border border-[#292929] rounded-lg p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#292929] pb-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-7 h-7 text-[#4ADE80] shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-2xl uppercase text-white">
                Envío Masivo Procesado
              </h2>
              <p className="text-xs text-[#888888] mt-1">
                Representante: <strong className="text-white">{receipt.representativeName}</strong> · ID Lote:{' '}
                <span className="font-mono">{receipt.submissionId}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartNewBatch}
            className="h-10 px-4 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded-md inline-flex items-center gap-2 whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Registrar Otro Lote
          </button>
        </div>

        {/* Complete Activity Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#0B0B0B] border border-[#292929] rounded p-3.5">
            <p className="text-[11px] uppercase text-[#888888]">Total enviados</p>
            <p className="font-display text-2xl font-bold text-white tabular-nums mt-1">
              {receipt.totalEntered}
            </p>
          </div>
          <div className="bg-[#0B0B0B] border border-[#292929] rounded p-3.5">
            <p className="text-[11px] uppercase text-[#888888]">Aceptados</p>
            <p className="font-display text-2xl font-bold text-[#4ADE80] tabular-nums mt-1">
              {receipt.totalValid}
            </p>
          </div>
          <div className="bg-[#0B0B0B] border border-[#292929] rounded p-3.5">
            <p className="text-[11px] uppercase text-[#888888]">Rechazados</p>
            <p className="font-display text-2xl font-bold text-[#ED1010] tabular-nums mt-1">
              {receipt.totalRejected}
            </p>
          </div>
          <div className="bg-[#0B0B0B] border border-[#292929] rounded p-3.5">
            <p className="text-[11px] uppercase text-[#888888]">Duplicados</p>
            <p className="font-display text-2xl font-bold text-[#FBBF24] tabular-nums mt-1">
              {receipt.totalDuplicates || 0}
            </p>
          </div>
          <div className="bg-[#0B0B0B] border border-[#292929] rounded p-3.5">
            <p className="text-[11px] uppercase text-[#888888]">Total guardados</p>
            <p className="font-display text-2xl font-bold text-white tabular-nums mt-1">
              {receipt.totalSaved}
            </p>
          </div>
          <div className="bg-[#0B0B0B] border border-[#292929] rounded p-3.5">
            <p className="text-[11px] uppercase text-[#888888]">Pend. sincronización</p>
            <p className="font-display text-2xl font-bold text-[#38BDF8] tabular-nums mt-1">
              {receipt.pendingSyncCount}
            </p>
          </div>
        </div>

        {receipt.registrationCodes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-[#B5B5B5] font-semibold">
              Códigos de Confirmación Generados ({receipt.registrationCodes.length})
            </h3>
            <div className="max-h-40 overflow-y-auto bg-[#0B0B0B] border border-[#222222] rounded p-3 flex flex-wrap gap-2">
              {receipt.registrationCodes.map((code) => (
                <span
                  key={code}
                  className="px-2.5 py-1 bg-[#141414] border border-[#292929] rounded font-mono text-xs text-white"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {receipt.rejectedReasons.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-[#F87171] font-semibold">
              Filas Rechazadas o Duplicadas ({receipt.rejectedReasons.length})
            </h3>
            <ul className="bg-[#0B0B0B] border border-[#ED1010]/30 rounded p-3 space-y-1 text-xs text-[#CCCCCC] max-h-40 overflow-y-auto">
              {receipt.rejectedReasons.map((reason, idx) => (
                <li key={idx}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Honeypot anti-bot field (hidden from human visitors) */}
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

      {draftRestored && (
        <div className="bg-[#141414] border border-[#38BDF8]/40 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-[#38BDF8]">
            Se restauró automáticamente tu borrador local de esta sesión ({rows.length} filas).
          </span>
          <button
            type="button"
            onClick={handleClearDraft}
            className="px-3 py-1 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white rounded"
          >
            Limpiar borrador
          </button>
        </div>
      )}

      {/* Representative Identity Bar */}
      <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222222] pb-3">
          <div>
            <h2 className="font-display text-xl uppercase text-white">
              Datos del Representante de Organización
            </h2>
            <p className="text-xs text-[#888888]">
              Cada participante quedará vinculado a esta sesión masiva y al contrato {contract.contractCode}.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#737373]">
            Idempotencia: {idempotencyKeyRef.current.slice(0, 12)}...
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="rep-name" className="text-xs font-medium text-[#B5B5B5]">
              Nombre del representante / coordinador *
            </label>
            <input
              id="rep-name"
              type="text"
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
              placeholder="Ej. Carlos Mendoza"
              className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="rep-contact" className="text-xs font-medium text-[#B5B5B5]">
              Teléfono o correo de contacto *
            </label>
            <input
              id="rep-contact"
              type="text"
              value={representativeContact}
              onChange={(e) => setRepresentativeContact(e.target.value)}
              placeholder="Ej. +58 412 0000000 / coord@club.com"
              className="w-full h-10 px-3 bg-[#080808] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
            />
          </div>
        </div>
      </div>

      {/* Live Activity Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#141414] border border-[#292929] rounded p-3">
          <p className="text-[11px] uppercase text-[#888888]">Total introducidos</p>
          <p className="font-mono text-xl font-bold text-white tabular-nums">{rows.length}</p>
        </div>
        <div className="bg-[#141414] border border-[#292929] rounded p-3">
          <p className="text-[11px] uppercase text-[#888888]">Total válidos</p>
          <p className="font-mono text-xl font-bold text-[#4ADE80] tabular-nums">
            {validation.validRows.length}
          </p>
        </div>
        <div className="bg-[#141414] border border-[#292929] rounded p-3">
          <p className="text-[11px] uppercase text-[#888888]">Con errores</p>
          <p className="font-mono text-xl font-bold text-[#ED1010] tabular-nums">
            {validation.errorRows.length}
          </p>
        </div>
        <div className="bg-[#141414] border border-[#292929] rounded p-3">
          <p className="text-[11px] uppercase text-[#888888]">Duplicados</p>
          <p className="font-mono text-xl font-bold text-[#FBBF24] tabular-nums">
            {duplicateCountLive}
          </p>
        </div>
        <div className="bg-[#141414] border border-[#292929] rounded p-3">
          <p className="text-[11px] uppercase text-[#888888]">Total guardados</p>
          <p className="font-mono text-xl font-bold text-white tabular-nums">
            {progress ? progress.done : 0}
          </p>
        </div>
        <div className="bg-[#141414] border border-[#292929] rounded p-3">
          <p className="text-[11px] uppercase text-[#888888]">Pend. sincronización</p>
          <p className="font-mono text-xl font-bold text-[#38BDF8] tabular-nums">
            {validation.validRows.length}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141414] border border-[#292929] rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addRows(1)}
            className="h-9 px-3 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar participante
          </button>
          <button
            type="button"
            onClick={() => addRows(5)}
            className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
          >
            +5 filas
          </button>

          <label className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5 cursor-pointer">
            {importingExcel ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-[#4ADE80]" />
            )}
            Importar Excel / CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelImport}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleCheckDuplicates}
            disabled={checkingLocks}
            className="h-9 px-3 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs font-medium rounded inline-flex items-center gap-1.5"
          >
            {checkingLocks ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SearchCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
            )}
            Verificar duplicados
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-[#080808] p-1 rounded border border-[#292929]">
          <button
            type="button"
            onClick={() => setViewFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewFilter === 'all' ? 'bg-[#292929] text-white' : 'text-[#888888] hover:text-white'
            }`}
          >
            Todos ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('valid')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewFilter === 'valid'
                ? 'bg-[#16A34A]/30 text-[#4ADE80]'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            Válidos ({validation.validRows.length})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('errors')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewFilter === 'errors'
                ? 'bg-[#ED1010]/30 text-[#F87171]'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            Con errores ({validation.errorRows.length})
          </button>
        </div>
      </div>

      {/* SheetJS Interactive Sheet Selection & Column Mapping Modal */}
      {pendingImport && (
        <div className="bg-[#141414] border border-[#ED1010]/60 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-[#222222] pb-3">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-[#4ADE80] shrink-0" />
              <div>
                <h3 className="font-display text-lg uppercase text-white">
                  Asignar Columnas de {pendingImport.fileName}
                </h3>
                <p className="text-xs text-[#888888]">
                  {pendingImport.rawRows.length} fila(s) detectadas · Confirma a qué campo corresponde cada columna del archivo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingImport(null)}
              aria-label="Cerrar importación"
              className="p-1.5 text-[#888888] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {pendingImport.sheetNames.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs text-[#B5B5B5]">Hoja del libro Excel</label>
              <select
                value={pendingImport.selectedSheet}
                onChange={(e) => handleChangeImportSheet(e.target.value)}
                className="w-full sm:w-72 h-9 px-3 bg-[#080808] border border-[#292929] rounded text-xs text-white"
              >
                {pendingImport.sheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FIELD_MAPPING_LABELS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="text-[11px] font-medium text-[#B5B5B5]">{f.label}</label>
                <select
                  value={pendingImport.mapping[f.key]}
                  onChange={(e) =>
                    setPendingImport({
                      ...pendingImport,
                      mapping: { ...pendingImport.mapping, [f.key]: e.target.value },
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                >
                  <option value="">-- Ignorar / vacío --</option>
                  {pendingImport.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setPendingImport(null)}
              className="h-9 px-4 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-xs text-[#B5B5B5] rounded"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApplyColumnMapping}
              className="h-9 px-5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded"
            >
              Importar {pendingImport.rawRows.length} fila(s) a la tabla
            </button>
          </div>
        </div>
      )}

      {/* Desktop Editable Table */}
      <div className="hidden lg:block bg-[#141414] border border-[#292929] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B0B0B] border-b border-[#292929] text-[#888888] uppercase">
                <th className="py-3 px-2.5 w-10">#</th>
                <th className="py-3 px-2.5">Nombre y Apellido *</th>
                <th className="py-3 px-2.5">Cédula *</th>
                <th className="py-3 px-2.5 w-28">Talla *</th>
                <th className="py-3 px-2.5">Seudónimo</th>
                <th className="py-3 px-2.5">Teléfono *</th>
                <th className="py-3 px-2.5">Instagram</th>
                <th className="py-3 px-2.5">Modalidad de Pago</th>
                {extraGarments.length > 0 && <th className="py-3 px-2.5">Prendas Extra</th>}
                <th className="py-3 px-2.5">Estado</th>
                <th className="py-3 px-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {visibleRows.map((row) => {
                const v = validationMap.get(row.rowId);
                const rowIdx = v ? v.rowIndex + 1 : 0;
                const errMsgs = v ? Object.values(v.errors) : [];
                const isExpanded = expandedGarmentRowId === row.rowId;
                return (
                  <React.Fragment key={row.rowId}>
                    <tr className={v?.isValid ? 'bg-transparent' : 'bg-[#ED1010]/5'}>
                      <td className="py-2 px-2.5 font-mono text-[#888888]">{rowIdx}</td>
                      <td className="py-2 px-1.5">
                        <input
                          type="text"
                          aria-label={`Nombre fila ${rowIdx}`}
                          value={row.fullName}
                          onChange={(e) => updateCell(row.rowId, 'fullName', e.target.value)}
                          placeholder="Nombre Apellido"
                          className={`w-full h-8 px-2 bg-[#080808] border rounded text-white outline-none ${
                            v?.errors.fullName
                              ? 'border-[#ED1010]'
                              : 'border-[#292929] focus:border-[#888888]'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-1.5">
                        <input
                          type="text"
                          aria-label={`Cédula fila ${rowIdx}`}
                          value={row.identificationNumber}
                          onChange={(e) =>
                            updateCell(row.rowId, 'identificationNumber', e.target.value)
                          }
                          placeholder="Ej. 08451234"
                          className={`w-full h-8 px-2 bg-[#080808] border rounded font-mono text-white outline-none ${
                            v?.errors.identificationNumber
                              ? 'border-[#ED1010]'
                              : 'border-[#292929] focus:border-[#888888]'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-1.5">
                        <select
                          aria-label={`Talla fila ${rowIdx}`}
                          value={row.size}
                          onChange={(e) => updateCell(row.rowId, 'size', e.target.value)}
                          className={`w-full h-8 px-2 bg-[#080808] border rounded text-white font-semibold outline-none ${
                            v?.errors.size ? 'border-[#ED1010]' : 'border-[#292929]'
                          }`}
                        >
                          {sizes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-1.5">
                        <input
                          type="text"
                          aria-label={`Seudónimo fila ${rowIdx}`}
                          value={row.nickname}
                          onChange={(e) => updateCell(row.rowId, 'nickname', e.target.value)}
                          placeholder="Opcional"
                          className="w-full h-8 px-2 bg-[#080808] border border-[#292929] rounded text-white outline-none"
                        />
                      </td>
                      <td className="py-2 px-1.5">
                        <input
                          type="text"
                          aria-label={`Teléfono fila ${rowIdx}`}
                          value={row.phone}
                          onChange={(e) => updateCell(row.rowId, 'phone', e.target.value)}
                          placeholder="04141234567"
                          className={`w-full h-8 px-2 bg-[#080808] border rounded font-mono text-white outline-none ${
                            v?.errors.phone ? 'border-[#ED1010]' : 'border-[#292929]'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-1.5">
                        <input
                          type="text"
                          aria-label={`Instagram fila ${rowIdx}`}
                          value={row.instagram}
                          onChange={(e) => updateCell(row.rowId, 'instagram', e.target.value)}
                          placeholder="@usuario"
                          className="w-full h-8 px-2 bg-[#080808] border border-[#292929] rounded text-white outline-none"
                        />
                      </td>
                      <td className="py-2 px-1.5">
                        <select
                          aria-label={`Modalidad pago fila ${rowIdx}`}
                          value={row.paymentSelection}
                          onChange={(e) =>
                            updateCell(
                              row.rowId,
                              'paymentSelection',
                              e.target.value as PaymentSelection
                            )
                          }
                          className="w-full h-8 px-2 bg-[#080808] border border-[#292929] rounded text-white outline-none"
                        >
                          <option value="PAGO COMPLETO">PAGO COMPLETO</option>
                          <option value="PAGO PARCIAL">PAGO PARCIAL</option>
                        </select>
                      </td>
                      {extraGarments.length > 0 && (
                        <td className="py-2 px-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGarmentRowId(isExpanded ? null : row.rowId)
                            }
                            className="h-8 px-2.5 bg-[#080808] border border-[#292929] hover:border-[#ED1010] rounded text-[11px] text-white inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <Layers className="w-3 h-3 text-[#ED1010]" />
                            {row.garmentItems?.length || extraGarments.length} art.
                          </button>
                        </td>
                      )}
                      <td className="py-2 px-2">
                        {v?.isValid ? (
                          <span className="text-[#4ADE80] font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Válido
                          </span>
                        ) : (
                          <span
                            className="text-[#F87171] text-[11px] leading-tight block max-w-[180px]"
                            title={errMsgs.join(' ')}
                          >
                            {errMsgs[0] || 'Incompleto'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => duplicateRow(row)}
                          aria-label={`Duplicar fila ${rowIdx}`}
                          title="Duplicar fila"
                          className="p-1.5 text-[#888888] hover:text-white"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.rowId)}
                          aria-label={`Eliminar fila ${rowIdx}`}
                          title="Eliminar fila"
                          className="p-1.5 text-[#888888] hover:text-[#ED1010]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {extraGarments.length > 0 && isExpanded && (
                      <tr className="bg-[#0B0B0B]">
                        <td colSpan={11} className="p-3 border-t border-[#222222]">
                          <p className="text-[11px] uppercase text-[#888888] mb-2">
                            Tallas y personalización adicional · Fila #{rowIdx}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {extraGarments.map((gName) => {
                              const currentItem = row.garmentItems?.find(
                                (g) => g.garment === gName
                              );
                              return (
                                <div
                                  key={gName}
                                  className="p-2.5 bg-[#141414] border border-[#292929] rounded space-y-1.5"
                                >
                                  <p className="text-xs font-semibold text-white">{gName}</p>
                                  <div className="flex gap-2">
                                    <select
                                      value={currentItem?.size || row.size || defaultSize}
                                      onChange={(e) =>
                                        updateRowExtraGarment(row.rowId, gName, {
                                          size: e.target.value,
                                        })
                                      }
                                      className="h-8 px-2 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                                    >
                                      {sizes.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Personalización"
                                      value={currentItem?.nickname || ''}
                                      onChange={(e) =>
                                        updateRowExtraGarment(row.rowId, gName, {
                                          nickname: e.target.value,
                                        })
                                      }
                                      className="flex-1 h-8 px-2 bg-[#080808] border border-[#292929] rounded text-xs text-white"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Comfortable Cards View */}
      <div className="lg:hidden space-y-4">
        {visibleRows.map((row) => {
          const v = validationMap.get(row.rowId);
          const rowIdx = v ? v.rowIndex + 1 : 0;
          const errMsgs = v ? Object.values(v.errors) : [];
          return (
            <div
              key={row.rowId}
              className={`bg-[#141414] border rounded-lg p-4 space-y-3 ${
                v?.isValid ? 'border-[#292929]' : 'border-[#ED1010]/60'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#222222] pb-2">
                <span className="font-mono text-xs text-white font-semibold">
                  Participante #{rowIdx}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      v?.isValid ? 'text-[#4ADE80]' : 'text-[#F87171]'
                    }`}
                  >
                    {v?.isValid ? 'Válido' : 'Requiere revisión'}
                  </span>
                  <button
                    type="button"
                    onClick={() => duplicateRow(row)}
                    aria-label={`Duplicar fila ${rowIdx}`}
                    className="p-1 text-[#888888] hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(row.rowId)}
                    aria-label={`Eliminar fila ${rowIdx}`}
                    className="p-1 text-[#888888] hover:text-[#ED1010]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[#888888]">Nombre y Apellido *</label>
                  <input
                    type="text"
                    value={row.fullName}
                    onChange={(e) => updateCell(row.rowId, 'fullName', e.target.value)}
                    className="w-full h-9 px-2.5 mt-1 bg-[#080808] border border-[#292929] rounded text-white"
                  />
                </div>
                <div>
                  <label className="text-[#888888]">Cédula *</label>
                  <input
                    type="text"
                    value={row.identificationNumber}
                    onChange={(e) =>
                      updateCell(row.rowId, 'identificationNumber', e.target.value)
                    }
                    className="w-full h-9 px-2.5 mt-1 bg-[#080808] border border-[#292929] rounded font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[#888888]">Talla *</label>
                  <select
                    value={row.size}
                    onChange={(e) => updateCell(row.rowId, 'size', e.target.value)}
                    className="w-full h-9 px-2.5 mt-1 bg-[#080808] border border-[#292929] rounded text-white"
                  >
                    {sizes.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[#888888]">Seudónimo</label>
                  <input
                    type="text"
                    value={row.nickname}
                    onChange={(e) => updateCell(row.rowId, 'nickname', e.target.value)}
                    className="w-full h-9 px-2.5 mt-1 bg-[#080808] border border-[#292929] rounded text-white"
                  />
                </div>
                <div>
                  <label className="text-[#888888]">Teléfono *</label>
                  <input
                    type="text"
                    value={row.phone}
                    onChange={(e) => updateCell(row.rowId, 'phone', e.target.value)}
                    className="w-full h-9 px-2.5 mt-1 bg-[#080808] border border-[#292929] rounded font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[#888888]">Instagram</label>
                  <input
                    type="text"
                    value={row.instagram}
                    onChange={(e) => updateCell(row.rowId, 'instagram', e.target.value)}
                    className="w-full h-9 px-2.5 mt-1 bg-[#080808] border border-[#292929] rounded text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[#888888]">Modalidad de Pago</label>
                  <select
                    value={row.paymentSelection}
                    onChange={(e) =>
                      updateCell(
                        row.rowId,
                        'paymentSelection',
                        e.target.value as PaymentSelection
                      )
                    }
                    className="w-full h-9 px-2.5 mt-1 bg-[#080808] border border-[#292929] rounded text-white"
                  >
                    <option value="PAGO COMPLETO">PAGO COMPLETO</option>
                    <option value="PAGO PARCIAL">PAGO PARCIAL</option>
                  </select>
                </div>

                {extraGarments.length > 0 && (
                  <div className="sm:col-span-2 space-y-2 pt-2 border-t border-[#222222]">
                    <p className="text-[11px] uppercase text-[#888888]">Artículos adicionales</p>
                    {extraGarments.map((gName) => {
                      const currentItem = row.garmentItems?.find((g) => g.garment === gName);
                      return (
                        <div key={gName} className="flex items-center gap-2">
                          <span className="text-white w-28 truncate">{gName}</span>
                          <select
                            value={currentItem?.size || row.size || defaultSize}
                            onChange={(e) =>
                              updateRowExtraGarment(row.rowId, gName, { size: e.target.value })
                            }
                            className="h-8 px-2 bg-[#080808] border border-[#292929] rounded text-white"
                          >
                            {sizes.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Personalización"
                            value={currentItem?.nickname || ''}
                            onChange={(e) =>
                              updateRowExtraGarment(row.rowId, gName, {
                                nickname: e.target.value,
                              })
                            }
                            className="flex-1 h-8 px-2 bg-[#080808] border border-[#292929] rounded text-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {errMsgs.length > 0 && (
                <p className="text-xs text-[#F87171]">• {errMsgs.join(' · ')}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview Panel */}
      {previewOpen && validation.validRows.length > 0 && (
        <div className="bg-[#141414] border border-[#292929] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg uppercase text-white">
              Previsualización de Registros Válidos ({validation.validRows.length})
            </h3>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="text-xs text-[#888888] hover:text-white"
            >
              Ocultar previsualización
            </button>
          </div>
          <div className="max-h-56 overflow-auto border border-[#222222] rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0B0B0B] text-[#888888]">
                <tr>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Cédula</th>
                  <th className="p-2">Talla</th>
                  <th className="p-2">Seudónimo</th>
                  <th className="p-2">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {validation.validRows.map((item) => (
                  <tr key={item.rowId}>
                    <td className="p-2 text-white">{item.normalized.fullName}</td>
                    <td className="p-2 font-mono">{item.normalized.identificationNumber}</td>
                    <td className="p-2 font-bold text-[#ED1010]">{item.normalized.size}</td>
                    <td className="p-2">{item.normalized.nickname || '-'}</td>
                    <td className="p-2">{item.normalized.paymentSelection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Privacy Policy Consent */}
      <label className="flex items-start gap-3 cursor-pointer p-4 rounded-lg bg-[#141414] border border-[#292929]">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(e) => setPrivacyAccepted(e.target.checked)}
          className="w-4 h-4 mt-0.5 accent-[#ED1010] shrink-0"
        />
        <span className="text-xs text-[#CCCCCC] leading-relaxed">
          {contract.formConfig.privacyPolicyText ||
            'Confirmo que represento a la organización indicada y autorizo a MEGO FORCE el procesamiento de estos datos exclusivamente para la fabricación del contrato.'}
        </span>
      </label>

      {submissionError && (
        <div
          className="p-4 rounded-md bg-[#ED1010]/15 border border-[#ED1010]/50 text-sm text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[#ED1010] shrink-0 mt-0.5" />
            <span>{submissionError}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmitBulk}
            disabled={submitting}
            className="h-9 px-4 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs font-semibold rounded whitespace-nowrap self-end sm:self-auto"
          >
            Reintentar envío sin duplicar
          </button>
        </div>
      )}

      {submitting && progress && (
        <div className="bg-[#141414] border border-[#292929] rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-white">
            <span>Procesando lotes en Firestore...</span>
            <span className="font-mono tabular-nums">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="h-2 bg-[#080808] rounded overflow-hidden">
            <div
              className="h-full bg-[#ED1010] transition-all"
              style={{
                width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Submit Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          disabled={validation.validRows.length === 0}
          className="h-11 px-5 bg-[#1C1C1C] hover:bg-[#292929] disabled:opacity-40 border border-[#292929] text-white text-xs font-semibold rounded-md"
        >
          {previewOpen
            ? 'Ocultar Previsualización'
            : `Previsualizar Válidos (${validation.validRows.length})`}
        </button>

        <button
          type="button"
          onClick={handleSubmitBulk}
          disabled={submitting || validation.validRows.length === 0}
          className="h-11 px-6 bg-[#ED1010] hover:bg-[#c80d0d] disabled:opacity-40 text-white text-sm font-display uppercase tracking-wider font-bold rounded-md inline-flex items-center justify-center gap-2 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Procesando Envío Masivo...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Confirmar Envío Masivo ({validation.validRows.length} válidos)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
