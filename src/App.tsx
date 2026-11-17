import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminGuard } from './components/AdminGuard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastNotifications } from './components/ToastNotifications';
import { AuthProvider } from './hooks/useAuth';
import { AdminContractDetailPage } from './pages/AdminContractDetailPage';
import { AdminContractEditorPage } from './pages/AdminContractEditorPage';
import { AdminContractsPage } from './pages/AdminContractsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminExportsPage } from './pages/AdminExportsPage';
import { AdminFormsPage } from './pages/AdminFormsPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminMethodologyPage } from './pages/AdminMethodologyPage';
import { AdminMockupsPage } from './pages/AdminMockupsPage';
import { AdminPaymentsPage } from './pages/AdminPaymentsPage';
import { AdminProductionOrderDetailPage } from './pages/AdminProductionOrderDetailPage';
import { AdminProductionPage } from './pages/AdminProductionPage';
import { AdminRegistrationsPage } from './pages/AdminRegistrationsPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { AdminStatsPage } from './pages/AdminStatsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { HomePortalPage } from './pages/HomePortalPage';
import { PublicBulkRegistrationPage } from './pages/PublicBulkRegistrationPage';
import { PublicConfirmationPage } from './pages/PublicConfirmationPage';
import { PublicContractPage } from './pages/PublicContractPage';
import { PublicLookupPage } from './pages/PublicLookupPage';
import { IS_ADMIN_ENABLED, IS_PUBLIC_PORTAL_ENABLED } from './config/appMode';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <ToastNotifications />
          <Routes>
            {/* Portada: en el host admin "/" lleva al login (o al dashboard si ya hay sesión) */}
            {IS_PUBLIC_PORTAL_ENABLED ? (
              <Route path="/" element={<HomePortalPage />} />
            ) : (
              <Route path="/" element={<Navigate to="/admin/login" replace />} />
            )}

            {/* Enlaces de clientes por token (disponibles en ambos hosts para que un enlace viejo no se rompa) */}
            <Route path="/registro/:token" element={<PublicContractPage />} />
            <Route path="/registro/:token/masivo" element={<PublicBulkRegistrationPage />} />
            <Route path="/registro-masivo/:bulkToken" element={<PublicBulkRegistrationPage />} />
            <Route path="/registro/:token/confirmacion" element={<PublicConfirmationPage />} />
            <Route path="/registro/:token/consulta" element={<PublicLookupPage />} />

            {/* Panel administrativo: solo existe en el host admin (o en local). En el host público no se registra ninguna ruta /admin/* */}
            {IS_ADMIN_ENABLED && (
            <>
            {/* Admin Auth */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            {/* Guarded Admin Workspace (All 20 Screens) */}
            <Route
              path="/admin/dashboard"
              element={
                <AdminGuard>
                  <AdminDashboardPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/contracts"
              element={
                <AdminGuard>
                  <AdminContractsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/contracts/new"
              element={
                <AdminGuard>
                  <AdminContractEditorPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/contracts/:id"
              element={
                <AdminGuard>
                  <AdminContractDetailPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/contracts/:id/edit"
              element={
                <AdminGuard>
                  <AdminContractEditorPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/contracts/:id/registrations"
              element={
                <AdminGuard>
                  <AdminRegistrationsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/contracts/:id/production"
              element={
                <AdminGuard>
                  <AdminProductionPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/registrations"
              element={
                <AdminGuard>
                  <AdminRegistrationsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/registrations/by-size"
              element={
                <AdminGuard>
                  <AdminRegistrationsPage defaultView="by_size" />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/production"
              element={
                <AdminGuard>
                  <AdminProductionPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/production/:orderId"
              element={
                <AdminGuard>
                  <AdminProductionOrderDetailPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/payments"
              element={
                <AdminGuard>
                  <AdminPaymentsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/stats"
              element={
                <AdminGuard>
                  <AdminStatsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/forms"
              element={
                <AdminGuard>
                  <AdminFormsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/forms/preview"
              element={
                <AdminGuard>
                  <AdminFormsPage defaultPreview />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/mockups"
              element={
                <AdminGuard>
                  <AdminMockupsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/exports"
              element={
                <AdminGuard>
                  <AdminExportsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminGuard>
                  <AdminSettingsPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminGuard>
                  <AdminUsersPage />
                </AdminGuard>
              }
            />
            <Route
              path="/admin/methodology"
              element={
                <AdminGuard>
                  <AdminMethodologyPage />
                </AdminGuard>
              }
            />

            </>
            )}

            {/* Fallback: cualquier ruta desconocida (incluido /admin/* en el host público) vuelve a "/" */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
