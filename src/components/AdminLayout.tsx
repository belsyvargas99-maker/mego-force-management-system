import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { subscribeGlobalSettings } from '../services/settingsService';
import type { GlobalSettings } from '../types/mego';
import { DEFAULT_GLOBAL_SETTINGS } from '../utils/defaultForm';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface AdminLayoutProps {
  title: string;
  breadcrumb?: string;
  children: React.ReactNode;
}

export function AdminLayout({ title, breadcrumb, children }: AdminLayoutProps) {
  const { user, role, hasGoogleSheetsToken, reconnectSheets, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);

  useEffect(() => {
    const unsub = subscribeGlobalSettings(setSettings);
    return () => unsub();
  }, []);

  const handleConnectSheets = async () => {
    const ok = await reconnectSheets();
    if (ok) {
      toast.success('Permisos de Google Sheets actualizados para esta sesión.');
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex">
      <Sidebar
        brandName={settings.brandName}
        logoUrl={settings.logoUrl}
        userEmail={user?.email}
        role={role}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={logout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          title={title}
          breadcrumb={breadcrumb}
          hasGoogleSheetsToken={hasGoogleSheetsToken}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onConnectSheets={handleConnectSheets}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
