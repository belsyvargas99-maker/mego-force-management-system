import type { PaymentSelection } from '../types/mego';
import {
  normalizeIdentificationDisplay,
  normalizeIdentificationKey,
  normalizeInstagram,
  normalizeNickname,
  normalizePhone,
} from './normalizers';

export interface BulkRowDraft {
  rowId: string;
  fullName: string;
  identificationNumber: string;
  size: string;
  nickname: string;
  phone: string;
  instagram: string;
  paymentSelection: PaymentSelection;
  garmentItems?: { garment: string; size: string; nickname?: string }[];
}

export interface BulkRowValidationResult {
  rowId: string;
  rowIndex: number;
  isValid: boolean;
  errors: Partial<Record<keyof BulkRowDraft, string>>;
  isDuplicateInBatch: boolean;
  isDuplicateExisting: boolean;
  normalized: {
    fullName: string;
    identificationNumber: string;
    identificationKey: string;
    size: string;
    nickname: string;
    phone: string;
    instagram: string;
    paymentSelection: PaymentSelection;
    garmentItems?: { garment: string; size: string; nickname?: string }[];
  };
}

export function createEmptyBulkRow(defaultSize = 'M'): BulkRowDraft {
  return {
    rowId: `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    fullName: '',
    identificationNumber: '',
    size: defaultSize,
    nickname: '',
    phone: '',
    instagram: '',
    paymentSelection: 'PAGO COMPLETO',
  };
}

export function validateBulkRows(
  rows: readonly BulkRowDraft[],
  availableSizes: readonly string[],
  existingIdKeys: ReadonlySet<string> = new Set(),
  options: { nicknameMaxLength?: number } = {}
): {
  results: BulkRowValidationResult[];
  validRows: BulkRowValidationResult[];
  errorRows: BulkRowValidationResult[];
} {
  const allowedSizes = new Set(availableSizes.map((s) => s.trim().toUpperCase()));
  const seenKeys = new Map<string, number>();

  rows.forEach((r) => {
    const key = normalizeIdentificationKey(r.identificationNumber);
    if (key.length >= 3) {
      seenKeys.set(key, (seenKeys.get(key) || 0) + 1);
    }
  });

  const results: BulkRowValidationResult[] = [];
  const validRows: BulkRowValidationResult[] = [];
  const errorRows: BulkRowValidationResult[] = [];

  rows.forEach((row, idx) => {
    const errors: Partial<Record<keyof BulkRowDraft, string>> = {};
    const fullName = row.fullName.trim().replace(/\s+/g, ' ');
    const idDisplay = normalizeIdentificationDisplay(row.identificationNumber);
    const idKey = normalizeIdentificationKey(row.identificationNumber);
    const size = row.size.trim().toUpperCase();
    const nickname = normalizeNickname(row.nickname || '', options.nicknameMaxLength || 40);
    const phone = normalizePhone(row.phone || '');
    const instagram = normalizeInstagram(row.instagram || '');
    const paymentSelection: PaymentSelection =
      row.paymentSelection === 'PAGO PARCIAL' ? 'PAGO PARCIAL' : 'PAGO COMPLETO';

    if (fullName.length < 2) {
      errors.fullName = 'Nombre y apellido obligatorio (mín. 2 caracteres).';
    }
    if (idKey.length < 3) {
      errors.identificationNumber = 'Cédula obligatoria (mín. 3 caracteres).';
    }
    if (!size || (allowedSizes.size > 0 && !allowedSizes.has(size))) {
      errors.size = 'Selecciona una talla válida del contrato.';
    }
    if (phone.replace(/\D/g, '').length < 6) {
      errors.phone = 'Teléfono inválido (mín. 6 dígitos).';
    }

    const isDuplicateInBatch = idKey.length >= 3 && (seenKeys.get(idKey) || 0) > 1;
    const isDuplicateExisting = idKey.length >= 3 && existingIdKeys.has(idKey);

    if (isDuplicateInBatch) {
      errors.identificationNumber = 'Cédula duplicada dentro de esta tabla.';
    } else if (isDuplicateExisting) {
      errors.identificationNumber = 'Esta cédula ya está registrada en el contrato.';
    }

    const normalizedExtra = Array.isArray(row.garmentItems)
      ? row.garmentItems
          .filter((g) => g && g.garment && g.size)
          .map((g) => ({
            garment: String(g.garment).trim(),
            size: String(g.size).trim().toUpperCase(),
            nickname: g.nickname ? normalizeNickname(g.nickname, 40) : '',
          }))
      : undefined;

    const isValid = Object.keys(errors).length === 0;
    const item: BulkRowValidationResult = {
      rowId: row.rowId,
      rowIndex: idx,
      isValid,
      errors,
      isDuplicateInBatch,
      isDuplicateExisting,
      normalized: {
        fullName,
        identificationNumber: idDisplay,
        identificationKey: idKey,
        size,
        nickname,
        phone,
        instagram,
        paymentSelection,
        ...(normalizedExtra && normalizedExtra.length > 0 ? { garmentItems: normalizedExtra } : {}),
      },
    };
    results.push(item);
    if (isValid) validRows.push(item);
    else errorRows.push(item);
  });

  return { results, validRows, errorRows };
}

export interface BulkColumnMapping {
  fullName: string;
  identificationNumber: string;
  size: string;
  nickname: string;
  phone: string;
  instagram: string;
  paymentSelection: string;
}

/**
 * Automatically maps arbitrary spreadsheet header names (even differing labels) to MEGO FORCE fields.
 */
export function autoDetectColumnMapping(headers: readonly string[]): BulkColumnMapping {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const findHeader = (keywords: string[], exclude: string[] = []): string => {
    for (const kw of keywords) {
      const hit = headers.find((h) => {
        const n = norm(h);
        if (exclude.some((ex) => n === ex)) return false;
        return n === kw || n.includes(kw);
      });
      if (hit) return hit;
    }
    return '';
  };

  return {
    fullName: findHeader(['nombre y apellido', 'nombre completo', 'nombre', 'participante', 'atleta', 'jugador', 'full name', 'name']),
    identificationNumber: findHeader(['cedula', 'identificacion', 'documento', 'dni', 'ci', 'rut', 'pasaporte', 'id']),
    size: findHeader(['talla', 'medida', 'tamano', 'size']),
    nickname: findHeader(['seudonimo', 'apodo', 'alias', 'camiseta', 'nombre en prenda', 'dorsal', 'nick']),
    phone: findHeader(['telefono', 'celular', 'whatsapp', 'movil', 'contacto', 'tlf', 'phone']),
    instagram: findHeader(['instagram', 'insta', 'red social', 'ig']),
    paymentSelection: findHeader(['modalidad', 'pago', 'abono', 'payment']),
  };
}

export function mapRawRowsToBulkDrafts(
  rawRows: readonly Record<string, unknown>[],
  mapping: BulkColumnMapping,
  defaultSize = 'M'
): BulkRowDraft[] {
  return rawRows.map((raw) => {
    const pick = (col: string) => (col ? String(raw[col] ?? '').trim() : '');
    const payRaw = pick(mapping.paymentSelection).toUpperCase();
    const sizeRaw = pick(mapping.size).toUpperCase();
    return {
      ...createEmptyBulkRow(defaultSize),
      fullName: pick(mapping.fullName),
      identificationNumber: pick(mapping.identificationNumber),
      size: sizeRaw || defaultSize,
      nickname: pick(mapping.nickname),
      phone: pick(mapping.phone),
      instagram: pick(mapping.instagram),
      paymentSelection: payRaw.includes('PARCIAL') ? 'PAGO PARCIAL' : 'PAGO COMPLETO',
    };
  });
}

/**
 * Splits items into bounded chunks so each Firestore batch stays well below 500 writes.
 */
export function chunkItems<T>(items: readonly T[], chunkSize = 80): T[][] {
  if (chunkSize <= 0) return [Array.from(items)];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
