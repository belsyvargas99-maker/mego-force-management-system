import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stripUndefined } from './stripUndefined';
import { createDefaultFormConfig } from './defaultForm';

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).some(hasUndefined);
  }
  return false;
}

test('elimina undefined a cualquier nivel, tambien dentro de arrays', () => {
  const input = {
    a: undefined,
    b: { c: undefined, d: { e: undefined, f: 1 } },
    list: [{ x: undefined, y: 'ok' }, undefined, [{ z: undefined }]],
  };
  const out = stripUndefined(input);
  assert.equal('a' in out, false);
  assert.deepEqual(out.b, { d: { f: 1 } });
  assert.deepEqual(out.list, [{ y: 'ok' }, null, [{}]]);
  assert.equal(hasUndefined(out), false);
});

test('conserva null, 0, false, cadena vacia y fechas', () => {
  const date = new Date('2026-01-02T03:04:05Z');
  const out = stripUndefined({ n: null, zero: 0, no: false, empty: '', date, nested: { date } });
  assert.deepEqual(Object.keys(out).sort(), ['date', 'empty', 'n', 'nested', 'no', 'zero']);
  assert.equal(out.n, null);
  assert.equal(out.zero, 0);
  assert.equal(out.no, false);
  assert.equal(out.empty, '');
  assert.equal(out.date, date);
  assert.equal(out.nested.date, date);
});

test('no toca objetos de clase (Timestamp, FieldValue) ni modifica el original', () => {
  class FieldValueLike {
    marker: undefined = undefined;
  }
  const sentinel = new FieldValueLike();
  const input = { updatedAt: sentinel, gone: undefined };
  const out = stripUndefined(input);
  assert.equal(out.updatedAt, sentinel);
  assert.equal('gone' in input, true);
  assert.equal('gone' in out, false);
});

test('un contrato con campos opcionales sin rellenar queda sin undefined', () => {
  const formConfig = createDefaultFormConfig();
  const contract = {
    contractId: 'ctr_1',
    title: 'Contrato',
    description: '',
    unitPrice: undefined,
    closedAt: undefined,
    sheetsConfig: { enabled: false, autoRetry: true, spreadsheetId: undefined },
    mockupImages: [{ id: 'm1', url: 'u', storagePath: undefined, caption: '', isPrimary: true, order: 1 }],
    formConfig: { ...formConfig, fields: formConfig.fields.map((f) => ({ ...f, placeholder: undefined })) },
    totalParticipants: 0,
  };
  const out = stripUndefined(contract);
  assert.equal(hasUndefined(out), false);
  assert.equal(out.description, '');
  assert.equal(out.totalParticipants, 0);
  assert.equal(out.formConfig.fields.length, formConfig.fields.length);
});

test('la configuracion de formulario por defecto ya no trae undefined', () => {
  assert.equal(hasUndefined(createDefaultFormConfig()), false);
});
