import React, { useMemo, useState } from 'react';
import { ArrowUpDown, CheckCircle2, Clock, Edit3, Trash2, XCircle } from 'lucide-react';
import type { Contract, PaymentVerificationStatus, Registration } from '../types/mego';
import { Pagination } from './Pagination';
import { PaymentStatusBadge } from './PaymentStatusBadge';

interface RegistrationTableProps {
  registrations: Registration[];
  contractsMap?: Map<string, Contract>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onEdit: (reg: Registration) => void;
  onDelete: (reg: Registration) => void;
  onQuickVerify: (reg: Registration, status: PaymentVerificationStatus) => void;
}

type SortField = 'fullName' | 'size' | 'registrationTimestamp';

export function RegistrationTable({
  registrations,
  contractsMap,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  onQuickVerify,
}: RegistrationTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 20;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPageIndex(0);
  };

  const sortedRegistrations = useMemo(() => {
    if (!sortField) return registrations;
    const copy = [...registrations];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'registrationTimestamp') {
        const ta = new Date(a.registrationTimestamp || a.createdAt).getTime() || 0;
        const tb = new Date(b.registrationTimestamp || b.createdAt).getTime() || 0;
        cmp = ta - tb;
      } else {
        cmp = (a[sortField] || '').localeCompare(b[sortField] || '', 'es', {
          sensitivity: 'base',
        });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [registrations, sortField, sortDir]);

  const safePageCount = Math.max(1, Math.ceil(sortedRegistrations.length / pageSize));
  const clampedPageIndex = Math.min(pageIndex, safePageCount - 1);
  const pageStart = clampedPageIndex * pageSize;
  const rows = sortedRegistrations.slice(pageStart, pageStart + pageSize);

  const allSelected =
    registrations.length > 0 && registrations.every((r) => selectedIds.has(r.registrationId));

  return (
    <div className="space-y-4">
      {/* Desktop Data Table */}
      <div className="hidden md:block bg-[#141414] border border-[#292929] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#292929] bg-[#0E0E0E]">
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos los registros"
                    checked={allSelected}
                    onChange={() =>
                      onToggleSelectAll(
                        allSelected ? [] : registrations.map((r) => r.registrationId)
                      )
                    }
                    className="w-4 h-4 accent-[#ED1010]"
                  />
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  #
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('fullName')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    Nombre completo
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  Cédula
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('size')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    Talla
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  Seudónimo
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  Teléfono
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  Instagram
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  Modalidad y Verificación
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort('registrationTimestamp')}
                    className="inline-flex items-center gap-1 hover:text-white"
                  >
                    Fecha
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#888888] whitespace-nowrap">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222] text-sm">
              {rows.map((r, idx) => {
                const dt = new Date(r.registrationTimestamp || r.createdAt);
                return (
                  <tr
                    key={r.registrationId}
                    className="hover:bg-[#191919] transition-colors"
                  >
                    <td className="px-3.5 py-3 align-middle">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar a ${r.fullName}`}
                        checked={selectedIds.has(r.registrationId)}
                        onChange={() => onToggleSelect(r.registrationId)}
                        className="w-4 h-4 accent-[#ED1010]"
                      />
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <span className="font-mono text-xs text-[#888888] tabular-nums">
                        {pageStart + idx + 1}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <div>
                        <p className="font-medium text-white">{r.fullName}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#888888]">
                          {contractsMap && (
                            <span className="truncate max-w-[140px]">
                              {contractsMap.get(r.contractId)?.contractCode || ''}
                            </span>
                          )}
                          <span
                            className={`uppercase font-semibold ${
                              r.registrationMode === 'bulk' || r.source === 'bulk_representative'
                                ? 'text-[#38BDF8]'
                                : 'text-[#888888]'
                            }`}
                          >
                            {r.registrationMode === 'bulk' || r.source === 'bulk_representative'
                              ? `Masivo${r.representativeName ? ` · ${r.representativeName}` : ''}`
                              : 'Individual'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <span className="font-mono text-xs tabular-nums text-[#E5E5E5]">
                        {r.identificationNumber}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <span className="font-display text-sm font-bold text-white px-2 py-0.5 bg-[#1C1C1C] border border-[#292929] rounded">
                        {r.size}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <span className="text-xs font-medium text-[#D4D4D4]">
                        {r.nickname || '-'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <span className="font-mono text-xs tabular-nums text-[#D4D4D4]">
                        {r.phone}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <span className="text-xs text-[#888888]">{r.instagram || '-'}</span>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <PaymentStatusBadge
                        selection={r.paymentSelection}
                        verificationStatus={r.paymentVerificationStatus}
                      />
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <span className="font-mono text-xs tabular-nums text-[#888888] whitespace-nowrap">
                        {isNaN(dt.getTime()) ? '-' : dt.toLocaleString('es-ES')}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <div className="flex items-center gap-1">
                        {r.paymentVerificationStatus !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => onQuickVerify(r, 'verified')}
                            title="Verificar pago"
                            aria-label={`Verificar pago de ${r.fullName}`}
                            className="p-1.5 rounded bg-[#16A34A]/15 text-[#4ADE80] hover:bg-[#16A34A]/30"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {r.paymentVerificationStatus !== 'pending' && (
                          <button
                            type="button"
                            onClick={() => onQuickVerify(r, 'pending')}
                            title="Marcar pendiente"
                            aria-label={`Marcar pago pendiente para ${r.fullName}`}
                            className="p-1.5 rounded bg-[#D97706]/15 text-[#FBBF24] hover:bg-[#D97706]/30"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {r.paymentVerificationStatus !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => onQuickVerify(r, 'rejected')}
                            title="Rechazar pago"
                            aria-label={`Rechazar pago de ${r.fullName}`}
                            className="p-1.5 rounded bg-[#ED1010]/15 text-[#F87171] hover:bg-[#ED1010]/30"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEdit(r)}
                          title="Editar participante"
                          aria-label={`Editar a ${r.fullName}`}
                          className="p-1.5 rounded bg-[#1C1C1C] hover:bg-[#292929] text-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(r)}
                          title="Eliminar participante"
                          aria-label={`Eliminar a ${r.fullName}`}
                          className="p-1.5 rounded bg-[#1C1C1C] hover:bg-[#ED1010]/20 text-[#F87171]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View (Zero Horizontal Overflow) */}
      <div className="md:hidden space-y-3">
        {rows.map((r, idx) => (
          <div
            key={r.registrationId}
            className="bg-[#141414] border border-[#292929] rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar a ${r.fullName}`}
                  checked={selectedIds.has(r.registrationId)}
                  onChange={() => onToggleSelect(r.registrationId)}
                  className="w-4 h-4 accent-[#ED1010]"
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    #{pageStart + idx + 1} · {r.fullName}
                  </p>
                  <p className="font-mono text-xs text-[#888888] tabular-nums">
                    CI: {r.identificationNumber} · {r.phone}
                  </p>
                </div>
              </div>
              <span className="font-display text-base font-bold px-2.5 py-0.5 bg-[#ED1010] text-white rounded">
                {r.size}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <span className="text-[#D4D4D4] block">
                  Seudónimo: <strong>{r.nickname || '-'}</strong>
                </span>
                <span className="text-[11px] text-[#888888] uppercase">
                  Registro:{' '}
                  {r.registrationMode === 'bulk' || r.source === 'bulk_representative'
                    ? `Masivo (${r.representativeName || 'Org.'})`
                    : 'Individual'}
                </span>
              </div>
              <PaymentStatusBadge
                selection={r.paymentSelection}
                verificationStatus={r.paymentVerificationStatus}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#222222]">
              <button
                type="button"
                onClick={() => onQuickVerify(r, 'verified')}
                className="px-2.5 py-1.5 bg-[#16A34A]/15 text-[#4ADE80] rounded text-xs font-medium"
              >
                Verificar
              </button>
              <button
                type="button"
                onClick={() => onEdit(r)}
                className="px-2.5 py-1.5 bg-[#1C1C1C] text-white rounded text-xs font-medium"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onDelete(r)}
                className="px-2.5 py-1.5 bg-[#ED1010]/15 text-[#F87171] rounded text-xs font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      <Pagination
        page={clampedPageIndex + 1}
        pageSize={pageSize}
        totalItems={sortedRegistrations.length}
        onPageChange={(p) => setPageIndex(p - 1)}
      />
    </div>
  );
}
