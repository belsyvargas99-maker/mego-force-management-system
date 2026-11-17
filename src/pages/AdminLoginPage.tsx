import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { MegoLogo } from '../components/MegoLogo';
import { useAuth } from '../hooks/useAuth';
import { IS_PUBLIC_PORTAL_ENABLED, publicUrl } from '../config/appMode';

export function AdminLoginPage() {
  const { user, authorized, loading, authError, signIn } = useAuth();

  if (!loading && user && authorized) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="min-h-screen mego-carbon-bg text-white flex flex-col justify-between p-4 sm:p-8">
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <MegoLogo size="md" showTagline />
        {IS_PUBLIC_PORTAL_ENABLED ? (
          <Link
            to="/"
            className="text-xs text-[#888888] hover:text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Portal Participantes
          </Link>
        ) : (
          <a
            href={publicUrl('/')}
            className="text-xs text-[#888888] hover:text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Portal Participantes
          </a>
        )}
      </div>

      <main className="max-w-md w-full mx-auto bg-[#141414] border border-[#292929] rounded-lg p-6 sm:p-8 space-y-6 my-8">
        <div className="space-y-2">
          <div className="w-11 h-11 rounded-md bg-[#ED1010]/15 border border-[#ED1010]/40 flex items-center justify-center text-[#ED1010]">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="font-display text-3xl uppercase tracking-wide text-white pt-1">
            Acceso Administrativo
          </h1>
          <p className="text-sm text-[#888888] leading-relaxed">
            Área privada exclusiva para administradores autorizados de MEGO FORCE. No existe registro público de cuentas administrativas.
          </p>
        </div>

        {authError && (
          <div
            className="p-4 rounded-md bg-[#ED1010]/15 border border-[#ED1010]/50 flex items-start gap-3 text-xs sm:text-sm text-white"
            role="alert"
          >
            <ShieldAlert className="w-5 h-5 text-[#ED1010] shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={() => signIn()}
          className="w-full h-12 px-4 bg-white hover:bg-neutral-100 disabled:opacity-60 text-[#1F1F1F] rounded-md font-medium text-sm flex items-center justify-center gap-3 transition-colors shadow-sm"
        >
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            className="w-5 h-5 shrink-0"
            aria-hidden="true"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span>{loading ? 'Verificando acceso...' : 'Sign in with Google'}</span>
        </button>

        <div className="pt-4 border-t border-[#292929] text-xs text-[#888888] space-y-2">
          <p>
            Correo corporativo principal vinculado:{' '}
            <span className="font-mono text-white">belsyvargas99@gmail.com</span>
          </p>
          <p>
            El acceso usa únicamente validación estándar de Google Sign-In. La conexión con Google Sheets se solicita aparte cuando decidas sincronizar hojas.
          </p>
        </div>
      </main>

      <footer className="text-center text-xs text-[#666666]">
        MEGO FORCE · Seguridad basada en roles y verificación de correo
      </footer>
    </div>
  );
}
