import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { newDb, DataType } from 'pg-mem';
import { createVercelHandler } from '../src/vercel.js';
import { membershipFixture } from './helpers/memberships.js';
import { assignmentsFixture } from './helpers/assignments.js';

async function serve(t, handler) {
  const app = express();
  app.use(handler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('Vercel: sessão PostgreSQL entre instâncias, OAuth HTTPS e autorização da sessão', async (t) => {
  const db = newDb();
  // pg-mem não converte timestamp/timestamptz implicitamente como PostgreSQL real.
  const migration = await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8');
  db.public.none(migration.replace('expire timestamp', 'expire timestamptz'));
  db.public.none(await readFile(new URL('../db/007_account_admin.sql', import.meta.url), 'utf8'));
  await membershipFixture(db);
  await assignmentsFixture(db);
  db.public.registerFunction({
    name: 'to_timestamp',
    args: [DataType.float],
    returns: DataType.timestamptz,
    implementation: (value) => new Date(value * 1000),
  });
  const { Pool } = db.adapters.createPg();
  const pools = [];
  let attachments = 0;
  let roles = ['member-role'];
  const env = {
    APP_ORIGIN: 'https://anade.example.vercel.app',
    DATABASE_URL: 'postgresql://local-test-only',
    SESSION_SECRET: 'test-only-vercel-session-secret-at-least-32-characters',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_CLIENT_SECRET: 'test-only',
    DISCORD_GUILD_ID: 'guild',
    DISCORD_MEMBER_ROLE_ID: 'member-role',
  };
  const handler = () =>
    createVercelHandler({
      env,
      poolFactory: (_url, options) => {
        assert.deepEqual(options, { max: 2, idleTimeoutMillis: 5000, transactionPooler: true });
        const pool = new Pool();
        const query = pool.query.bind(pool);
        // O emulador exige casts JSON explícitos nas consultas do connect-pg-simple.
        pool.query = (sql, ...args) =>
          query(
            sql
              .replace('SELECT $1, to_timestamp', 'SELECT $1::json, to_timestamp')
              .replace('sess=$1', 'sess=$1::json'),
            ...args,
          );
        pools.push(pool);
        return pool;
      },
      attachPool: () => {
        attachments++;
      },
      discord: async () => ({ roles }),
    });
  t.after(async () => {
    for (const pool of pools) await pool.end();
  });
  const first = await serve(t, handler());
  const second = await serve(t, handler());
  const call = (base, path, cookie, options = {}) =>
    fetch(base + path, {
      redirect: 'manual',
      ...options,
      headers: {
        'X-Forwarded-Proto': 'https',
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers,
      },
    });
  assert.equal((await call(first, '/api/access')).status, 401);
  const login = await call(first, '/auth/discord');
  assert.equal(login.status, 302);
  const location = new URL(login.headers.get('location'));
  assert.equal(
    location.searchParams.get('redirect_uri'),
    `${env.APP_ORIGIN}/auth/discord/callback`,
  );
  assert.equal(location.searchParams.get('scope'), 'identify guilds.members.read');
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  const cookie = setCookie.split(';')[0];
  assert.equal(attachments, 2);
  const [saved] = db.public.many('SELECT sid, sess FROM anade.session');
  assert.equal(saved.sess.oauth.state, location.searchParams.get('state'));
  const forged = await call(second, '/auth/discord/callback?state=forged&code=test', cookie);
  assert.equal(forged.status, 302);
  assert.match(forged.headers.get('location'), /authError=/);
  assert.equal(attachments, 2);
  assert.equal(db.public.one('SELECT sess FROM anade.session').sess.oauth, undefined);
  await pools[0].query('UPDATE anade.session SET sess=$1 WHERE sid=$2', [
    JSON.stringify({
      cookie: saved.sess.cookie,
      user: {
        id: 'member',
        member: true,
        accessToken: 'test-only',
        admin: true,
        expires: Date.now() + 60000,
      },
      csrf: 'test-csrf',
    }),
    saved.sid,
  ]);
  const access = await call(second, '/api/access', cookie);
  assert.equal(access.status, 200);
  assert.deepEqual(await access.json(), { user: { id: 'member', admin: false } });
  await pools[0].query('UPDATE anade.session SET sess=$1 WHERE sid=$2', [
    JSON.stringify({
      cookie: saved.sess.cookie,
      user: { id: 'member', expires: Date.now() + 60000 },
      csrf: 'test-csrf',
    }),
    saved.sid,
  ]);
  assert.equal((await call(first, '/api/access', cookie)).status, 403);
  await pools[0].query('UPDATE anade.session SET sess=$1 WHERE sid=$2', [
    JSON.stringify({
      cookie: saved.sess.cookie,
      user: { id: 'member', member: true, expires: Date.now() + 60000 },
      csrf: 'test-csrf',
    }),
    saved.sid,
  ]);
  roles = [];
  await pools[0].query('UPDATE anade.discord_memberships SET valid_until=$1', [
    new Date(Date.now() - 1),
  ]);
  assert.equal((await call(first, '/api/access', cookie)).status, 200);
  assert.equal(
    (
      await call(first, '/api/demo-login', undefined, {
        method: 'POST',
        headers: { Origin: env.APP_ORIGIN },
      })
    ).status,
    404,
  );
});

test('Vercel: configuração incompleta falha sem expor credenciais ou criar conexões', async (t) => {
  const logs = t.mock.method(console, 'error', () => {});
  const url = await serve(
    t,
    createVercelHandler({
      env: { APP_ORIGIN: 'https://anade.example.vercel.app', SESSION_SECRET: 'short' },
      poolFactory: () => {
        throw new Error('Não deve criar conexão.');
      },
    }),
  );
  const response = await fetch(`${url}/api/config`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'O portal está temporariamente indisponível.' });
  assert.deepEqual(logs.mock.calls.at(-1).arguments, ['API Vercel:', 'CONFIG_SESSION_SECRET']);
});
