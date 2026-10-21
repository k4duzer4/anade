import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { seed } from '../src/seed.js';

test('administrador local independe de cargo Discord, revoga na sessão atual e não pode se autopromover pela ficha', async (t) => {
  const secret = 'test-only-local-administrator-session-secret-32-characters';
  const repo = new MemoryRepository(seed());
  const store = new session.MemoryStore();
  await repo.account('local-member', 'filiado');
  const sid = 'local-admin-test-session';
  await new Promise((resolve, reject) =>
    store.set(
      sid,
      {
        cookie: { expires: new Date(Date.now() + 60000), httpOnly: true },
        user: {
          id: 'local-member',
          discord: 'filiado',
          member: true,
          admin: false,
          expires: Date.now() + 60000,
        },
        csrf: 'csrf-test',
      },
      (error) => (error ? reject(error) : resolve()),
    ),
  );
  const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
  const app = createApp({
    repo,
    store,
    secret,
    env: {},
    discord: async () => {
      throw new Error('Não deve consultar Discord.');
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, method = 'GET', body) =>
    fetch(base + path, {
      method,
      headers: {
        Cookie: `anade.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`,
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-test',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await call('/api/directors', 'POST', {})).status, 403);
  repo.admins.add('local-member');
  assert.equal((await (await call('/api/access')).json()).user.admin, true);
  assert.equal((await call('/api/directors', 'POST', {})).status, 400);
  repo.admins.delete('local-member');
  assert.equal((await (await call('/api/access')).json()).user.admin, false);
  assert.equal((await call('/api/directors', 'POST', {})).status, 403);
  const profile = {
    name: 'Pessoa de teste',
    state: 'BA',
    ideology: 'Centro',
    age: 30,
    season: 'Temporada 1',
    degrees: [],
    is_admin: true,
    admin: true,
  };
  assert.equal((await call('/api/profile', 'PUT', profile)).status, 200);
  assert.equal((await (await call('/api/access')).json()).user.admin, false);
});
