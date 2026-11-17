import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, getAdminAuthHeaders, storage } from '../config/firebase';
import type { MockupImage } from '../types/mego';
import { generateEntityId } from '../utils/normalizers';
import { runWithFallback } from '../utils/uploadFallback';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadMockupImage(
  file: File,
  contractId: string,
  order: number,
  isPrimary = false
): Promise<MockupImage> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Formato no compatible. Usa PNG, JPG, WEBP o SVG.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen supera el límite permitido de 5 MB.');
  }

  const assetId = generateEntityId('ast');
  let downloadURL = '';
  let storagePath = `mockups/${contractId}/${assetId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  // Firebase Storage primero (con tiempo máximo) y, si falla o se cuelga, subida al
  // servidor propio (/api/uploads/mockup, solo administradores).
  const uploadToServer = async () => {
    const dataUrl = await readFileAsDataUrl(file);
    const authHeaders = await getAdminAuthHeaders();
    const res = await fetch('/api/uploads/mockup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ fileName: file.name, dataUrl }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        json?.error ||
          (res.status === 413
            ? 'La imagen es demasiado grande para subirla.'
            : `No se pudo subir la imagen (error ${res.status}).`)
      );
    }
    if (!json?.url) {
      throw new Error('El servidor no devolvió la dirección de la imagen.');
    }
    return { url: String(json.url), path: String(json.storagePath || storagePath) };
  };

  const stored = await runWithFallback(
    async () => {
      const storageRef = ref(storage, storagePath);
      const uploadResult = await uploadBytes(storageRef, file, { contentType: file.type });
      return { url: await getDownloadURL(uploadResult.ref), path: storagePath };
    },
    uploadToServer
  );
  downloadURL = stored.url;
  storagePath = stored.path;

  // Record asset metadata in Firestore if contractId is already persisted
  if (contractId && !contractId.startsWith('draft_')) {
    try {
      await setDoc(doc(db, 'assets', assetId), {
        assetId,
        contractId,
        storagePath,
        downloadURL,
        fileType: file.type || 'image/png',
        caption: file.name.replace(/\.[^.]+$/, ''),
        order,
        isPrimary,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal metadata log error
    }
  }

  return {
    id: assetId,
    url: downloadURL,
    storagePath,
    caption: file.name.replace(/\.[^.]+$/, ''),
    isPrimary,
    order,
  };
}
