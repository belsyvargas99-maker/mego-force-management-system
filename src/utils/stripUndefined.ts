/**
 * Elimina recursivamente las propiedades con valor `undefined` de objetos planos y arrays,
 * para que Firestore no rechace la escritura ("Unsupported field value: undefined").
 *
 * Solo recorre objetos planos (prototipo Object o null) y arrays. No toca Date, Timestamp,
 * FieldValue (serverTimestamp, increment...), referencias ni ningun otro objeto de clase.
 * Conserva null, 0, false y "". En un array, un undefined se convierte en null para no
 * desplazar posiciones (Firestore tampoco admite undefined dentro de arrays).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stripUndefined(item))) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      out[key] = stripUndefined(val);
    }
    return out as T;
  }
  return value;
}
