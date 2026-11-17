import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Ruler,
  Factory,
  CreditCard,
  BarChart3,
  Sliders,
  Image as ImageIcon,
  Download,
  Settings,
  ShieldCheck,
  BookOpen,
  X,
  LogOut,
} from 'lucide-react';
import { MegoLogo } from './MegoLogo';

interface SidebarProps {
  brandName?: string;
  logoUrl?: string;
  userEmail?: string | null;
  role?: string | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/contracts', label: 'Contratos', icon: FileText },
  { to: '/admin/registrations', label: 'Participantes', icon: Users },
  { to: '/admin/registrations/by-size', label: 'Por talla', icon: Ruler },
  { to: '/admin/production', label: 'Producción Mego Force', icon: Factory },
  { to: '/admin/payments', label: 'Pagos', icon: CreditCard },
  { to: '/admin/stats', label: 'Estadísticas', icon: BarChart3 },
  { to: '/admin/forms', label: 'Formularios', icon: Sliders },
  { to: '/admin/mockups', label: 'Presentación / Mockups', icon: ImageIcon },
  { to: '/admin/exports', label: 'Exportaciones', icon: Download },
  { to: '/admin/methodology', label: 'Metodología y Soporte', icon: BookOpen },
  { to: '/admin/settings', label: 'Configuración', icon: Settings },
  { to: '/admin/users', label: 'Administradores', icon: ShieldCheck },
];

export function Sidebar({
  brandName,
  logoUrl,
  userEmail,
  role,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full bg-[#0D0D0D] border-r border-[#292929]">
      <div className="h-16 px-5 flex items-center justify-between border-b border-[#292929]">
        <MegoLogo brandName={brandName} logoUrl={logoUrl} size="sm" />
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Cerrar menú lateral"
          className="lg:hidden p-1.5 text-[#888888] hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menú principal administrativo">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#ED1010] text-white'
                    : 'text-[#B5B5B5] hover:text-white hover:bg-[#1C1C1C]'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#292929] space-y-3">
        <div className="text-xs">
          <p className="text-white font-medium truncate">{userEmail || 'Administrador'}</p>
          <p className="text-[#888888] mt-0.5 capitalize">{role?.replace('_', ' ') || 'Admin'}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1C1C1C] hover:bg-[#292929] border border-[#292929] text-xs font-medium text-white rounded-md transition-colors whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
}
