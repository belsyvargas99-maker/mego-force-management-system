import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWithFallback } from './uploadFallback';

test('si el primario responde, no se usa el respaldo', async () => {
  let fallbackCalls = 0;
  const out = await runWithFallback(
    async () => 'storage',
    async () => {
      fallbackCalls++;
      return 'servidor';
    },
    50
  );
  assert.equal(out, 'storage');
  assert.equal(fallbackCalls, 0);
});

test('si el primario falla, se usa el respaldo', async () => {
  const out = await runWithFallback(
    async () => {
      throw new Error('storage/unauthorized');
    },
    async () => 'servidor',
    50
  );
  assert.equal(out, 'servidor');
});

test('si el primario se cuelga (bucket inexistente), el respaldo entra al agotarse el tiempo', async () => {
  const started = Date.now();
  const out = await runWithFallback(
    () => new Promise<string>(() => {}),
    async () => 'servidor',
    40
  );
  assert.equal(out, 'servidor');
  assert.ok(Date.now() - started < 1000);
});

test('si el respaldo también falla, el error llega al llamador', async () => {
  await assert.rejects(
    runWithFallback(
      async () => {
        throw new Error('a');
      },
      async () => {
        throw new Error('El servidor rechazó la imagen.');
      },
      50
    ),
    /rechazó/
  );
});
