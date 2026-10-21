import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { seed } from '../src/seed.js';

test('gestão de administradores: autoriza somente admins, exige CSRF, valida ID e registra concessão idempotente', async (t) => {
  const secret = 'test-only-admin-management-session-secret-32-characters';
  const repo = new MemoryRepository(seed()),
    store = new session.MemoryStore();
  const actor = '111111111111111111',
    target = '222222222222222222',
    member = '333333333333333333';
  for (const [id, name] of [
    [actor, 'diretor'],
    [target, 'candidato'],
    [member, 'filiado'],
  ])
    await repo.account(id, name);
  await repo.saveProfile(target, {
    name: 'Pessoa candidata',
    legapp: 'PRIVATE-NUMBER',
    shareLegapp: false,
  });
  repo.admins.add(actor);
  const cookies = {};
  for (const id of [actor, target, member]) {
    const sid = 'test-session-' + id;
    await new Promise((resolve, reject) =>
      store.set(
        sid,
        {
          cookie: { expires: new Date(Date.now() + 60000), httpOnly: true },
          user: { id, member: true, admin: false, expires: Date.now() + 60000 },
          csrf: 'csrf-test',
        },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    cookies[id] = 'anade.sid=' + encodeURIComponent('s:' + sid + '.' + signature);
  }
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
  const call = (path, id, method = 'GET', body, headers = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(id ? { Cookie: cookies[id] } : {}),
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-test',
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal((await call('/api/admin/accounts')).status, 401);
  assert.equal((await call('/api/admin/accounts', member)).status, 403);
  assert.equal(
    (await call('/api/admin/admins', member, 'POST', { discordId: target })).status,
    403,
  );
  assert.equal(
    (await call('/api/admin/admins', actor, 'POST', { discordId: target }, { 'X-CSRF-Token': '' }))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        '/api/admin/admins',
        actor,
        'POST',
        { discordId: target },
        { Origin: 'https://evil.test' },
      )
    ).status,
    403,
  );
  for (const id of ['not-an-id', 222222222222222222, '1'.repeat(21)])
    assert.equal((await call('/api/admin/admins', actor, 'POST', { discordId: id })).status, 400);
  assert.equal(
    (await call('/api/admin/admins', actor, 'POST', { discordId: '999999999999999999' })).status,
    404,
  );
  const listing = await (await call('/api/admin/accounts', actor)).json();
  assert.equal(listing.accounts.find((a) => a.id === target).name, 'Pessoa candidata');
  assert(!JSON.stringify(listing).includes('PRIVATE-NUMBER'));
  const added = await call('/api/admin/admins', actor, 'POST', { discordId: target });
  assert.equal(added.status, 200);
  assert.deepEqual(await added.json(), { ok: true, changed: true });
  assert.equal((await (await call('/api/access', target)).json()).user.admin, true);
  assert.deepEqual(
    await (await call('/api/admin/admins', actor, 'POST', { discordId: target })).json(),
    { ok: true, changed: false },
  );
  assert.equal(repo.adminGrants.length, 1);
  assert.equal(repo.adminGrants[0].actorId, actor);
  assert.equal(repo.adminGrants[0].targetId, target);
});
