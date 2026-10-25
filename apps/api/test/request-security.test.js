import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
import express from 'express';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { sensitiveRequestLimits } from '../src/request-security.js';

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
test('JSON comprimido, malformado e grande demais não derruba a API nem expõe o corpo recebido', async (t) => {
  const app = createApp({
      repo: new MemoryRepository(),
      secret: 'security-test-secret-thirty-two-characters',
      env: {},
    }),
    url = await serve(t, app);
  const encoded = await fetch(`${url}/api/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    body: gzipSync('{"role":"admin"}'),
  });
  assert.equal(encoded.status, 415);
  const malformed = await fetch(`${url}/api/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"private-secret": ',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'JSON inválido.' });
  const oversized = await fetch(`${url}/api/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(140000) }),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await fetch(`${url}/api/health`)).status, 200);
});
test('limites de alteração são por conta, preservam leituras e não bloqueiam outra pessoa no mesmo IP', async (t) => {
  const app = express();
  app.use((req, res, next) => {
    res.locals.user = { id: req.get('x-actor') || 'alice' };
    next();
  });
  app.use(...sensitiveRequestLimits());
  app.all('/change', (_req, res) => res.json({ ok: true }));
  const url = await serve(t, app);
  for (let i = 0; i < 60; i++)
    assert.equal((await fetch(`${url}/change`, { method: 'POST' })).status, 200);
  const limited = await fetch(`${url}/change`, { method: 'POST' });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
  assert.equal((await fetch(`${url}/change`)).status, 200);
  assert.equal(
    (await fetch(`${url}/change`, { method: 'POST', headers: { 'X-Actor': 'bob' } })).status,
    200,
  );
});
test('limite de uploads impede processamento simultâneo excessivo e libera a vaga ao concluir', async (t) => {
  const app = express();
  app.use((_req, res, next) => {
    res.locals.user = { id: 'alice' };
    next();
  });
  app.use(...sensitiveRequestLimits({ maxConcurrentUploads: 1 }));
  let finish, started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  app.post('/upload', (req, res) => {
    if (req.get('x-hold')) {
      finish = () => res.json({ ok: true });
      started();
    } else res.json({ ok: true });
  });
  const url = await serve(t, app),
    headers = { 'Content-Type': 'multipart/form-data; boundary=test' };
  const first = fetch(`${url}/upload`, {
    method: 'POST',
    headers: { ...headers, 'X-Hold': 'yes' },
    body: '--test--',
  });
  await ready;
  const busy = await fetch(`${url}/upload`, { method: 'POST', headers, body: '--test--' });
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get('retry-after'), '5');
  finish();
  assert.equal((await first).status, 200);
  assert.equal(
    (await fetch(`${url}/upload`, { method: 'POST', headers, body: '--test--' })).status,
    200,
  );
});
