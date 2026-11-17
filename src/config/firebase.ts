import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const app = initializeApp(firebaseConfig);
const databaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Plain Google Sign-In provider for Firebase Authentication (avoids blocking login on Workspace Drive/Sheets consent)
export const firebaseAuthProvider = new GoogleAuthProvider();
firebaseAuthProvider.setCustomParameters({ prompt: 'select_account' });

// Elevated Google Workspace OAuth provider requested explicitly when syncing Google Sheets
export const sheetsGoogleProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => sheetsGoogleProvider.addScope(scope));
sheetsGoogleProvider.setCustomParameters({ prompt: 'consent select_account' });

// Strictly in-memory OAuth token cache (never stored in localStorage/sessionStorage)
let cachedGoogleAccessToken: string | null = null;
let isSigningIn = false;

export function getGoogleAccessToken(): string | null {
  return cachedGoogleAccessToken;
}

export function clearGoogleAccessToken(): void {
  cachedGoogleAccessToken = null;
}

export function isSignInInProgress(): boolean {
  return isSigningIn;
}

export async function signInWithGoogleAdmin(withWorkspaceScopes = false): Promise<{
  user: User;
  accessToken: string | null;
}> {
  isSigningIn = true;
  try {
    const provider = withWorkspaceScopes ? sheetsGoogleProvider : firebaseAuthProvider;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken && withWorkspaceScopes) {
      cachedGoogleAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedGoogleAccessToken };
  } finally {
    isSigningIn = false;
  }
}

/**
 * Cabecera Authorization con el Firebase ID token del admin conectado.
 * El servidor la exige en /api/uploads/mockup, /api/import/parse y
 * /api/contracts/reconcile-schedules. getIdToken() renueva el token si está por vencer.
 */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Tu sesión de administrador expiró. Vuelve a iniciar sesión.');
  }
  const idToken = await user.getIdToken();
  return { Authorization: `Bearer ${idToken}` };
}

export async function signOutAdmin(): Promise<void> {
  cachedGoogleAccessToken = null;
  await signOut(auth);
}

export function subscribeAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedGoogleAccessToken = null;
    }
    callback(user);
  });
}

// Required Firestore startup connectivity check
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore connection error: the client is offline.');
    }
  }
}

void testConnection();
