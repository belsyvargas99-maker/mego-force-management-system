import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { Contract } from '../types/mego';
import { SearchBar } from './SearchBar';

export interface RegistrationFilters {
  search: string;
  contractId: string;
  size: string;
  paymentSelection: string;
  paymentVerificationStatus: string;
  registrationMode: string;
  dateFrom: string;
  dateTo: string;
}

export const INITIAL_FILTERS: RegistrationFilters = {
  search: '',
  contractId: 'all',
  size: 'all',
  paymentSelection: 'all',
  paymentVerificationStatus: 'all',
  registrationMode: 'all',
  dateFrom: '',
  dateTo: '',
};

interface FilterPanelProps {
  filters: RegistrationFilters;
  onChange: (next: RegistrationFilters) => void;
  contracts?: Contract[];
  sizes?: string[];
  hideContractFilter?: boolean;
}

export function FilterPanel({
  filters,
  onChange,
  contracts = [],
  sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  hideContractFilter = false,
}: FilterPanelProps) {
  const update = (key: keyof RegistrationFilters, val: string) => {
    onChange({ ...filters, [key]: val });
  };

  const hasActiveFilters =
    filters.search !== '' ||
    (!hideContractFilter && filters.contractId !== 'all') ||
    filters.size !== 'all' ||
    filters.paymentSelection !== 'all' ||
    filters.paymentVerificationStatus !== 'all' ||
    filters.registrationMode !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  return (
    <div className="bg-[#141414] border border-[#292929] rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="lg:col-span-2">
          <SearchBar
            value={filters.search}
            onChange={(v) => update('search', v)}
            placeholder="Buscar por nombre, cédula, seudónimo o código..."
          />
        </div>

        {!hideContractFilter && (
          <select
            value={filters.contractId}
            onChange={(e) => update('contractId', e.target.value)}
            aria-label="Filtrar por contrato"
            className="h-10 px-3 bg-[#0F0F0F] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
          >
            <option value="all">Todos los contratos</option>
            {contracts.map((c) => (
              <option key={c.contractId} value={c.contractId}>
                {c.contractCode} · {c.title}
              </option>
            ))}
          </select>
        )}

        <select
          value={filters.size}
          onChange={(e) => update('size', e.target.value)}
          aria-label="Filtrar por talla"
          className="h-10 px-3 bg-[#0F0F0F] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
        >
          <option value="all">Todas las tallas</option>
          {sizes.map((s) => (
            <option key={s} value={s}>
              Talla {s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center">
        <select
          value={filters.registrationMode}
          onChange={(e) => update('registrationMode', e.target.value)}
          aria-label="Filtrar por tipo de registro"
          className="h-10 px-3 bg-[#0F0F0F] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
        >
          <option value="all">Tipo: Todos</option>
          <option value="individual">Individual</option>
          <option value="bulk">Masivo (Org.)</option>
        </select>

        <select
          value={filters.paymentSelection}
          onChange={(e) => update('paymentSelection', e.target.value)}
          aria-label="Filtrar por modalidad de pago"
          className="h-10 px-3 bg-[#0F0F0F] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
        >
          <option value="all">Cualquier modalidad</option>
          <option value="PAGO COMPLETO">Pago Completo</option>
          <option value="PAGO PARCIAL">Pago Parcial</option>
        </select>

        <select
          value={filters.paymentVerificationStatus}
          onChange={(e) => update('paymentVerificationStatus', e.target.value)}
          aria-label="Filtrar por estado de verificación"
          className="h-10 px-3 bg-[#0F0F0F] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
        >
          <option value="all">Cualquier verificación</option>
          <option value="pending">Verificación Pendiente</option>
          <option value="verified">Pago Verificado</option>
          <option value="rejected">Pago Rechazado</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update('dateFrom', e.target.value)}
          aria-label="Desde fecha"
          className="h-10 px-3 bg-[#0F0F0F] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
        />

        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update('dateTo', e.target.value)}
          aria-label="Hasta fecha"
          className="h-10 px-3 bg-[#0F0F0F] border border-[#292929] focus:border-[#ED1010] rounded-md text-sm text-white outline-none"
        />

        <button
          type="button"
          onClick={() => onChange(INITIAL_FILTERS)}
          disabled={!hasActiveFilters}
          className="h-10 inline-flex items-center justify-center gap-2 px-3 bg-[#1C1C1C] hover:bg-[#292929] disabled:opacity-40 border border-[#292929] rounded-md text-xs font-medium text-white transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
