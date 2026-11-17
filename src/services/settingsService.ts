import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AdminRole, AuthorizedAdmin, GlobalSettings, UserProfile } from '../types/mego';
import { DEFAULT_GLOBAL_SETTINGS } from '../utils/defaultForm';
import { recordAuditLog } from './auditService';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export const BOOTSTRAP_ADMIN_EMAIL = 'belsyvargas99@gmail.com';

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function verifyAndSyncAdminAccess(user: {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}): Promise<{ authorized: boolean; role: AdminRole | null }> {
  if (!user.email || !user.emailVerified) {
    return { authorized: false, role: null };
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const isBootstrap = normalizedEmail === BOOTSTRAP_ADMIN_EMAIL;

  let role: AdminRole | null = isBootstrap ? 'super_admin' : null;

  if (!isBootstrap) {
    const allowPath = `authorizedAdmins/${normalizedEmail}`;
    try {
      const snap = await getDoc(doc(db, 'authorizedAdmins', normalizedEmail));
      if (!snap.exists()) {
        return { authorized: false, role: null };
      }
      const data = snap.data();
      if (data.active !== true) {
        return { authorized: false, role: null };
      }
      role = (data.role as AdminRole) || 'admin';
    } catch {
      return { authorized: false, role: null };
    }
  } else {
    // Ensure bootstrap admin also exists in authorizedAdmins for visibility in UI
    try {
      const allowRef = doc(db, 'authorizedAdmins', normalizedEmail);
      const allowSnap = await getDoc(allowRef);
      if (!allowSnap.exists()) {
        await setDoc(allowRef, {
          email: normalizedEmail,
          role: 'super_admin',
          active: true,
          addedBy: 'system_bootstrap',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal if rules handle bootstrap directly
    }
  }

  // Upsert user profile safely
  const userRef = doc(db, 'users', user.uid);
  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: normalizedEmail,
        displayName: (user.displayName || normalizedEmail.split('@')[0]).slice(0, 120),
        role,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: (user.displayName || normalizedEmail.split('@')[0]).slice(0, 120),
        role,
        active: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  return { authorized: true, role };
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const path = 'settings/global';
  try {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    if (!snap.exists()) {
      return DEFAULT_GLOBAL_SETTINGS;
    }
    const data = snap.data();
    return {
      ...DEFAULT_GLOBAL_SETTINGS,
      ...data,
      defaultSizes: Array.isArray(data.defaultSizes)
        ? data.defaultSizes
        : DEFAULT_GLOBAL_SETTINGS.defaultSizes,
      updatedAt: toIso(data.updatedAt),
    };
  } catch {
    return DEFAULT_GLOBAL_SETTINGS;
  }
}

export function subscribeGlobalSettings(callback: (settings: GlobalSettings) => void): () => void {
  const path = 'settings/global';
  return onSnapshot(
    doc(db, 'settings', 'global'),
    (snap) => {
      if (!snap.exists()) {
        callback(DEFAULT_GLOBAL_SETTINGS);
        return;
      }
      const data = snap.data();
      callback({
        ...DEFAULT_GLOBAL_SETTINGS,
        ...data,
        defaultSizes: Array.isArray(data.defaultSizes)
          ? data.defaultSizes
          : DEFAULT_GLOBAL_SETTINGS.defaultSizes,
        updatedAt: toIso(data.updatedAt),
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export async function saveGlobalSettings(
  settings: Omit<GlobalSettings, 'updatedAt'>,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const path = 'settings/global';
  try {
    await setDoc(doc(db, 'settings', 'global'), {
      brandName: settings.brandName.trim().slice(0, 100),
      logoUrl: (settings.logoUrl || '').slice(0, 2000),
      primaryColor: settings.primaryColor || '#080808',
      accentColor: settings.accentColor || '#ED1010',
      displayFont: settings.displayFont || 'Oswald',
      bodyFont: settings.bodyFont || 'DM Sans',
      contactEmail: settings.contactEmail || '',
      contactPhone: settings.contactPhone || '',
      defaultSizes: settings.defaultSizes.slice(0, 25),
      dateFormat: settings.dateFormat || 'dd/MM/yyyy HH:mm',
      timezone: settings.timezone || 'America/Caracas',
      privacyPolicyText: settings.privacyPolicyText.slice(0, 4000),
      defaultConfirmationMessage: (settings.defaultConfirmationMessage || '').slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'ACTUALIZAR_CONFIGURACION_GLOBAL',
      entityType: 'settings',
      entityId: 'global',
      changedFields: [{ field: 'globalSettings', oldValue: 'prev', newValue: 'updated' }],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeAuthorizedAdmins(callback: (admins: AuthorizedAdmin[]) => void): () => void {
  const path = 'authorizedAdmins';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      const items: AuthorizedAdmin[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          email: data.email || d.id,
          role: (data.role as AdminRole) || 'admin',
          active: data.active === true,
          addedBy: data.addedBy || '',
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        };
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export function subscribeUserProfiles(callback: (users: UserProfile[]) => void): () => void {
  const path = 'users';
  return onSnapshot(
    query(collection(db, path), orderBy('createdAt', 'desc')),
    (snap) => {
      const items: UserProfile[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: data.uid || d.id,
          email: data.email || '',
          displayName: data.displayName || '',
          role: (data.role as AdminRole) || 'admin',
          active: data.active === true,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        };
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function addAuthorizedAdmin(
  email: string,
  role: AdminRole,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const path = `authorizedAdmins/${cleanEmail}`;
  try {
    await setDoc(doc(db, 'authorizedAdmins', cleanEmail), {
      email: cleanEmail,
      role,
      active: true,
      addedBy: adminUser.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'AGREGAR_ADMIN_AUTORIZADO',
      entityType: 'user',
      entityId: cleanEmail.replace(/[^a-zA-Z0-9_\-]/g, '_'),
      changedFields: [{ field: 'email', oldValue: '', newValue: `${cleanEmail} (${role})` }],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAuthorizedAdmin(
  email: string,
  patch: { role: AdminRole; active: boolean },
  adminUser: { uid: string; email: string }
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const path = `authorizedAdmins/${cleanEmail}`;
  try {
    await updateDoc(doc(db, 'authorizedAdmins', cleanEmail), {
      role: patch.role,
      active: patch.active,
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'ACTUALIZAR_PERMISOS_ADMIN',
      entityType: 'user',
      entityId: cleanEmail.replace(/[^a-zA-Z0-9_\-]/g, '_'),
      changedFields: [
        { field: 'role', oldValue: '', newValue: patch.role },
        { field: 'active', oldValue: '', newValue: String(patch.active) },
      ],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeAuthorizedAdmin(
  email: string,
  adminUser: { uid: string; email: string }
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === BOOTSTRAP_ADMIN_EMAIL) {
    throw new Error('No se puede eliminar al administrador principal del sistema.');
  }
  const path = `authorizedAdmins/${cleanEmail}`;
  try {
    await deleteDoc(doc(db, 'authorizedAdmins', cleanEmail));
    await recordAuditLog({
      userId: adminUser.uid,
      userEmail: adminUser.email,
      action: 'ELIMINAR_ADMIN_AUTORIZADO',
      entityType: 'user',
      entityId: cleanEmail.replace(/[^a-zA-Z0-9_\-]/g, '_'),
      changedFields: [{ field: 'email', oldValue: cleanEmail, newValue: 'removed' }],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
