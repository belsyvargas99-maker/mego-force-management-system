/**
 * Intenta `primary` (p. ej. Firebase Storage) con un tiempo máximo y, si falla o se
 * cuelga, usa `fallback` (subida al servidor propio).
 *
 * Por qué hace falta el tiempo máximo: si el bucket de Storage no existe, el
 * navegador recibe un error de red (el preflight CORS falla) y el SDK de Firebase lo
 * trata como reintentable: reintenta hasta 10 minutos. Mientras tanto la pantalla se
 * queda en "Subiendo mockups..." sin llegar nunca al respaldo.
 */
export const STORAGE_UPLOAD_TIMEOUT_MS = 8000;

export async function runWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  timeoutMs: number = STORAGE_UPLOAD_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tiempo de espera agotado.')), timeoutMs);
    });
    return await Promise.race([primary(), timeout]);
  } catch {
    return fallback();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
