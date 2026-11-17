/**
 * Pure normalization, masking, hashing, and secure token helpers.
 * Designed to preserve leading zeros in identification numbers and phones.
 */

export function normalizeIdentificationDisplay(raw: string): string {
  return String(raw ?? '').trim().replace(/\s+/g, '');
}

export function normalizeIdentificationKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s.\-]/g, '');
}

export function maskIdentification(raw: string): string {
  const clean = normalizeIdentificationDisplay(raw);
  if (clean.length <= 4) {
    return '••••' + clean;
  }
  return '•'.repeat(Math.max(4, clean.length - 4)) + clean.slice(-4);
}

export function normalizePhone(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  if (!digitsOnly) return '';
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

export function normalizeInstagram(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  const withoutAt = trimmed.replace(/^@+/, '').replace(/\s+/g, '');
  if (!withoutAt) return '';
  return `@${withoutAt.toLowerCase()}`;
}

export function normalizeNickname(raw: string, maxLength = 20): string {
  const cleaned = String(raw ?? '').trim().replace(/\s+/g, ' ');
  return cleaned.slice(0, maxLength);
}

export function generatePublicToken(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let token = '';
  for (let i = 0; i < length; i++) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}

export function generateRegistrationCode(prefix = 'MF'): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${year}-${suffix}`;
}

export function generateEntityId(prefix = 'id'): string {
  const rand = generatePublicToken(10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export async function computeIdentificationHash(
  contractId: string,
  rawIdentification: string
): Promise<string> {
  const normalized = normalizeIdentificationKey(rawIdentification);
  const input = `${contractId}:${normalized}`;
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('Web Crypto API (crypto.subtle) is required for SHA-256 hashing.');
}
