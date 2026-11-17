import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  getGoogleAccessToken,
  signInWithGoogleAdmin,
  signOutAdmin,
  subscribeAuthChanges,
} from '../config/firebase';
import { verifyAndSyncAdminAccess } from '../services/settingsService';
import type { AdminRole } from '../types/mego';

interface AuthContextValue {
  user: User | null;
  role: AdminRole | null;
  authorized: boolean;
  loading: boolean;
  hasGoogleSheetsToken: boolean;
  authError: string | null;
  signIn: () => Promise<boolean>;
  reconnectSheets: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasGoogleSheetsToken, setHasGoogleSheetsToken] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAuthChanges(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setAuthorized(false);
        setHasGoogleSheetsToken(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await verifyAndSyncAdminAccess({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
          displayName: firebaseUser.displayName,
        });

        if (!res.authorized) {
          setAuthError(
            `Acceso denegado: la cuenta ${firebaseUser.email || ''} no está autorizada en la lista de administradores de MEGO FORCE.`
          );
          await signOutAdmin();
          setUser(null);
          setRole(null);
          setAuthorized(false);
          setHasGoogleSheetsToken(false);
        } else {
          setUser(firebaseUser);
          setRole(res.role);
          setAuthorized(true);
          setHasGoogleSheetsToken(Boolean(getGoogleAccessToken()));
          setAuthError(null);
        }
      } catch (err: any) {
        setAuthError(err?.message || 'Error al verificar permisos administrativos.');
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (withWorkspaceScopes = false): Promise<boolean> => {
    setAuthError(null);
    setLoading(true);
    try {
      const { user: signedUser, accessToken } = await signInWithGoogleAdmin(withWorkspaceScopes);
      const res = await verifyAndSyncAdminAccess({
        uid: signedUser.uid,
        email: signedUser.email,
        emailVerified: signedUser.emailVerified,
        displayName: signedUser.displayName,
      });

      if (!res.authorized) {
        setAuthError(
          `La cuenta ${signedUser.email || ''} no tiene permisos administrativos en MEGO FORCE.`
        );
        await signOutAdmin();
        setUser(null);
        setRole(null);
        setAuthorized(false);
        setHasGoogleSheetsToken(false);
        return false;
      }

      setUser(signedUser);
      setRole(res.role);
      setAuthorized(true);
      setHasGoogleSheetsToken(Boolean(accessToken || getGoogleAccessToken()));
      return true;
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Inicio de sesión cancelado.');
      } else if (err?.code === 'auth/popup-blocked') {
        setAuthError(
          'Tu navegador bloqueó la ventana emergente de Google. Permite popups o abre la aplicación en una pestaña nueva.'
        );
      } else if (err?.code === 'auth/unauthorized-domain') {
        setAuthError(
          'Este dominio no está autorizado aún en Firebase Auth. Abre la URL oficial de la app o agrega este dominio en Firebase Console > Authentication.'
        );
      } else {
        setAuthError(err?.message || 'No se pudo completar el inicio de sesión con Google.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reconnectSheets = async (): Promise<boolean> => {
    return signIn(true);
  };

  const logout = async (): Promise<void> => {
    await signOutAdmin();
    setUser(null);
    setRole(null);
    setAuthorized(false);
    setHasGoogleSheetsToken(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        authorized,
        loading,
        hasGoogleSheetsToken,
        authError,
        signIn,
        reconnectSheets,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
