import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportContractToExcel, exportContractToPdf, type ExportOptions } from '../services/exportService';
import type { Contract, Registration } from '../types/mego';

interface ExportMenuProps {
  contract: Pick<Contract, 'contractCode' | 'title' | 'organizationName' | 'availableSizes'>;
  registrations: Registration[];
  options?: ExportOptions;
}

export function ExportMenu({
  contract,
  registrations,
  options = { scope: 'all' },
}: ExportMenuProps) {
  const handleExcel = () => {
    try {
      exportContractToExcel(contract, registrations, options);
      toast.success('Archivo Excel (.xlsx) generado.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al exportar Excel.');
    }
  };

  const handlePdf = () => {
    try {
      exportContractToPdf(contract, registrations, options);
      toast.success('Documento PDF generado.');
    } catch (err: any) {
      toast.error(err?.message || 'Error al exportar PDF.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={handleExcel}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-white text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap"
      >
        <FileSpreadsheet className="w-4 h-4 text-[#4ADE80]" />
        Exportar Excel (.xlsx)
      </button>
      <button
        type="button"
        onClick={handlePdf}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap"
      >
        <FileText className="w-4 h-4" />
        Exportar PDF
      </button>
    </div>
  );
}
