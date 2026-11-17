import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingState } from './LoadingState';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, authorized, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoadingState label="Verificando credenciales de administrador..." rows={3} />
        </div>
      </div>
    );
  }

  if (!user || !authorized) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
