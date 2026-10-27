import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import session from 'express-session';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { MemoryRepository, PgRepository } from '../src/repository.js';
import { GuestAccess } from '../src/guest-access.js';
const ids = {
  admin: '100000000000000001',
  guest: '100000000000000002',
  member: '100000000000000003',
  other: '100000000000000004',
};
async function fixture(t) {
  const repo = new MemoryRepository({
    members: [{ id: ids.member, name: 'NOME INTERNO PRIVADO', legapp: 'CONTATO PRIVADO' }],
    meetings: [
      {
        id: randomUUID(),
        title: 'PAUTA SIGILOSA',
        agenda: ['TEXTO INTERNO'],
        date: new Date().toISOString(),
      },
    ],
    polls: [],
    directors: [],
  });
  const store = new session.MemoryStore(),
    secret = 'test-only-guest-session-secret-longer-than-32-characters',
    cookies = {};
  for (const [role, id] of Object.entries(ids)) {
    await repo.account(id, `conta_${role}`);
    if (role === 'admin') repo.admins.add(id);
    const sid = randomUUID();
    await new Promise((resolve, reject) =>
      store.set(
        sid,
        {
          cookie: { expires: new Date(Date.now() + 3600000) },
          csrf: 'csrf-test',
          user: {
            id,
            discord: `conta_${role}`,
            member: ['admin', 'member'].includes(role),
            admin: role === 'admin',
            expires: Date.now() + 3600000,
          },
        },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    cookies[role] = `anade.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
  }
  const server = createApp({
    repo,
    store,
    secret,
    env: {},
    discord: () => {
      throw new Error('Não consultar Discord durante navegação.');
    },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (role, path, method = 'GET', body, headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        Cookie: cookies[role] || '',
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-test',
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { repo, call };
}
test('convidado: somente ADM concede/revoga, sem filiação automática, sem autopromoção e com CSRF', async (t) => {
  const { repo, call } = await fixture(t);
  const input = { discordId: ids.guest, enabled: true };
  assert.equal((await call('guest', '/api/access')).status, 403);
  assert.equal((await call('member', '/api/admin/guests', 'PUT', input)).status, 403);
  assert.equal(
    (await call('admin', '/api/admin/guests', 'PUT', input, { 'X-CSRF-Token': '' })).status,
    403,
  );
  assert.equal(
    (await call('admin', '/api/admin/guests', 'PUT', { ...input, enabled: 'true' })).status,
    400,
  );
  assert.equal(
    (await call('admin', '/api/admin/guests', 'PUT', { ...input, discordId: ids.admin })).status,
    403,
  );
  assert.equal((await call('admin', '/api/admin/guests', 'PUT', input)).status, 200);
  assert.equal((await call('admin', '/api/admin/guests', 'PUT', input)).status, 200);
  assert.equal(repo.guestAccess.history.length, 1);
  assert.deepEqual((await (await call('guest', '/api/access')).json()).user, {
    id: ids.guest,
    admin: false,
    guest: true,
  });
  assert.equal(
    (await call('guest', '/api/admin/guests', 'PUT', { discordId: ids.guest, enabled: false }))
      .status,
    403,
  );
  assert.equal(
    (await call('admin', '/api/admin/admins', 'POST', { discordId: ids.guest })).status,
    409,
  );
  assert.equal(
    (await call('admin', '/api/admin/guests', 'PUT', { ...input, enabled: false })).status,
    200,
  );
  assert.equal((await call('guest', '/api/access')).status, 403);
  assert.equal(repo.guestAccess.history.length, 2);
  assert.equal(
    repo.data.members.some((member) => member.id === ids.guest),
    false,
  );
});
test('convidado: nenhum conteúdo, contagem ou arquivo sai da API, nem por URL direta; estado é construído sem snapshot', async (t) => {
  const { repo, call } = await fixture(t);
  await call('admin', '/api/admin/guests', 'PUT', { discordId: ids.guest, enabled: true });
  const snapshot = t.mock.method(repo, 'snapshot', () => {
    throw new Error('Convidado não deve consultar registros.');
  });
  const state = await (await call('guest', '/api/state?userId=' + ids.member)).json();
  for (const key of ['members', 'meetings', 'polls', 'directors']) assert.deepEqual(state[key], []);
  assert.equal(state.user.guest, true);
  assert.equal(state.user.admin, false);
  assert.equal(state.user.member, false);
  assert.deepEqual(state.user.permissions, { legal: false, finance: false, communications: false });
  assert.equal(snapshot.mock.callCount(), 0);
  const paths = [
    '/api/admin/accounts',
    '/api/admin/affiliations',
    '/api/affiliation/session',
    '/api/groups',
    '/api/plenaries',
    '/api/finance',
    '/api/legal',
    '/api/notifications',
    '/api/activity',
    '/api/search?q=PRIVADO',
    '/api/checkins',
    '/api/admin/checkins/ranking',
    '/api/profile/media/avatar',
    '/api/documents/unknown',
    '/api/checkins/unknown/actions',
    '/api/plenaries/unknown',
    '/api/state/private',
  ];
  for (const path of paths) {
    const response = await call('guest', path);
    assert.equal(response.status, 403, path);
    const value = await response.text();
    assert.ok(!/NOME INTERNO|PAUTA SIGILOSA|CONTATO PRIVADO/.test(value), path);
  }
  for (const [path, method, body] of [
    ['/api/profile', 'PUT', { name: 'tentativa', admin: true }],
    ['/api/polls/unknown/vote', 'POST', { option: 0 }],
    ['/api/affiliation/requests', 'POST', { accepted: true }],
    ['/api/activity/seen', 'PUT', { keys: [] }],
    ['/api/plenaries/unknown/join', 'POST', {}],
  ])
    assert.equal((await call('guest', path, method, body)).status, 403, path);
  assert.equal(snapshot.mock.callCount(), 0);
  assert.equal((await call('guest', '/api/logout', 'POST', {})).status, 200);
  assert.equal((await call('guest', '/api/access')).status, 401);
});
test('convidado prevalece sobre filiação na sessão e revogação recupera somente os direitos anteriores', async (t) => {
  const { call } = await fixture(t);
  assert.equal((await call('member', '/api/state')).status, 200);
  await call('admin', '/api/admin/guests', 'PUT', { discordId: ids.member, enabled: true });
  assert.deepEqual((await (await call('member', '/api/state')).json()).members, []);
  await call('admin', '/api/admin/guests', 'PUT', { discordId: ids.member, enabled: false });
  const after = await (await call('member', '/api/state')).json();
  assert.equal(after.members[0].name, 'NOME INTERNO PRIVADO');
  assert.equal(after.user.admin, false);
});
test('PostgreSQL: permissão e auditoria de convidado persistem entre instâncias, com decisão idempotente', async () => {
  const db = newDb();
  for (const file of ['001_initial.sql', '007_account_admin.sql', '019_guest_access.sql'])
    db.public.none(
      (await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8')).split(
        'ALTER TABLE anade.guest_access ENABLE',
      )[0],
    );
  const { Pool } = db.adapters.createPg(),
    pool = new Pool();
  try {
    const repo = new PgRepository(pool);
    await repo.account(ids.admin, 'admin');
    await repo.account(ids.guest, 'guest');
    await repo.account(ids.other, 'other_admin');
    await pool.query('UPDATE anade.accounts SET is_admin=true WHERE id=$1', [ids.other]);
    const first = new GuestAccess(repo),
      second = new GuestAccess(new PgRepository(pool));
    await assert.rejects(first.set(ids.other, true, ids.admin), (error) => error.status === 409);
    assert.equal(await first.set(ids.guest, true, ids.admin), true);
    assert.equal(await second.enabled(ids.guest), true);
    assert.equal(await second.set(ids.guest, true, ids.admin), false);
    assert.deepEqual(await second.activeIds(), [ids.guest]);
    await second.set(ids.guest, false, ids.admin);
    assert.equal(await first.enabled(ids.guest), false);
    assert.equal((await pool.query('SELECT * FROM anade.guest_access_history')).rows.length, 2);
  } finally {
    await pool.end();
  }
});
test('OAuth encaminha convidado sem cargo de filiado para o portal vazio', async (t) => {
  const http = globalThis.fetch.bind(globalThis);
  t.mock.method(globalThis, 'fetch', async (url, options) =>
    url === 'https://discord.com/api/v10/oauth2/token'
      ? Response.json({ access_token: 'test-only', expires_in: 3600 })
      : http(url, options),
  );
  const repo = new MemoryRepository();
  await repo.account(ids.admin, 'admin');
  await repo.account(ids.guest, 'guest');
  await new GuestAccess(repo).set(ids.guest, true, ids.admin);
  const app = createApp({
    repo,
    store: new session.MemoryStore(),
    secret: 'test-only-guest-oauth-secret-more-than-32-characters',
    env: {
      DISCORD_CLIENT_ID: 'test-client',
      DISCORD_CLIENT_SECRET: 'test-only',
      DISCORD_GUILD_ID: 'guild',
      DISCORD_MEMBER_ROLE_ID: 'member-role',
      DISCORD_REDIRECT_URI: 'http://localhost:3000/auth/discord/callback',
    },
    discord: async (path) =>
      path === '/users/@me' ? { id: ids.guest, username: 'guest' } : { roles: [] },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = await http(base + '/auth/discord', { redirect: 'manual' });
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const response = await http(base + `/auth/discord/callback?code=test&state=${state}`, {
    redirect: 'manual',
    headers: { Cookie: start.headers.get('set-cookie').split(';')[0] },
  });
  assert.equal(response.headers.get('location'), 'http://localhost:3000/painel');
  const empty = await (
    await http(base + '/api/state', {
      headers: { Cookie: response.headers.get('set-cookie').split(';')[0] },
    })
  ).json();
  assert.equal(empty.user.guest, true);
  assert.deepEqual(empty.members, []);
  assert.equal(repo.data.members.length, 0);
});
