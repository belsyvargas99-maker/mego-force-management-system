import React from 'react';
import { Menu, FileSpreadsheet, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  title: string;
  breadcrumb?: string;
  hasGoogleSheetsToken: boolean;
  onOpenMobileMenu: () => void;
  onConnectSheets: () => void;
}

export function Header({
  title,
  breadcrumb = 'Panel Administrativo',
  hasGoogleSheetsToken,
  onOpenMobileMenu,
  onConnectSheets,
}: HeaderProps) {
  return (
    <header className="h-16 bg-[#0B0B0B]/95 backdrop-blur-md border-b border-[#292929] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menú de navegación"
          className="lg:hidden p-2 -ml-2 text-white hover:bg-[#1C1C1C] rounded-md"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] text-[#888888] tracking-wide uppercase truncate">
            {breadcrumb}
          </p>
          <h1 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wide text-white truncate">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onConnectSheets}
          title={
            hasGoogleSheetsToken
              ? 'Google Sheets conectado en esta sesión'
              : 'Conectar sesión con Google Sheets'
          }
          className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
            hasGoogleSheetsToken
              ? 'bg-[#141414] border-[#16A34A]/50 text-[#4ADE80]'
              : 'bg-[#141414] border-[#292929] text-[#B5B5B5] hover:border-[#ED1010] hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>{hasGoogleSheetsToken ? 'Sheets Conectado' : 'Autorizar Sheets'}</span>
        </button>

        <Link
          to="/admin/contracts/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Contrato</span>
        </Link>
      </div>
    </header>
  );
}
