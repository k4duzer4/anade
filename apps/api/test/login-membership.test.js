import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { seed } from '../src/seed.js';

test('filiação é confirmada em cada login e não é consultada durante a sessão, inclusive ao salvar ficha', async (t) => {
  const http = globalThis.fetch.bind(globalThis);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://discord.com/api/v10/oauth2/token')
      return new Response(JSON.stringify({ access_token: 'test-only', expires_in: 3600 }), {
        status: 200,
      });
    return http(url, options);
  });
  let roles = ['member-role'],
    checks = 0,
    outage = false;
  const app = createApp({
    repo: new MemoryRepository(seed()),
    store: new session.MemoryStore(),
    secret: 'test-only-membership-session-secret-32-characters',
    env: {
      DISCORD_CLIENT_ID: 'client',
      DISCORD_CLIENT_SECRET: 'test-only',
      DISCORD_GUILD_ID: 'guild',
      DISCORD_MEMBER_ROLE_ID: 'member-role',
      DISCORD_REDIRECT_URI: 'http://localhost:3000/auth/discord/callback',
    },
    discord: async (path) => {
      if (outage) throw new Error('Discord indisponível durante a sessão de teste');
      if (path === '/users/@me') return { id: 'test-member', username: 'test-user' };
      checks++;
      return { roles };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, cookie, options = {}) =>
    http(base + path, {
      redirect: 'manual',
      ...options,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    });
  async function login(previousCookie) {
    const start = await call('/auth/discord', previousCookie);
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const cookie = start.headers.get('set-cookie').split(';')[0];
    const response = await call(`/auth/discord/callback?code=test&state=${state}`, cookie);
    return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] || cookie };
  }
  const first = await login();
  assert.equal(first.response.headers.get('location'), 'http://localhost:3000/painel');
  assert.equal(checks, 1);
  const state = await (await call('/api/state', first.cookie)).json();
  assert.equal(state.user.member, true);
  outage = true;
  assert.equal((await call('/api/access', first.cookie)).status, 200);
  const saved = await call('/api/profile', first.cookie, {
    method: 'PUT',
    headers: {
      Origin: 'http://localhost:3000',
      'Content-Type': 'application/json',
      'X-CSRF-Token': state.csrf,
    },
    body: JSON.stringify({
      name: 'Pessoa de teste',
      state: 'BA',
      ideology: 'Centro',
      age: 30,
      season: 'Temporada 1',
      degrees: [],
    }),
  });
  assert.equal(saved.status, 200);
  assert.equal((await call('/api/state', first.cookie)).status, 200);
  assert.equal(checks, 1);
  outage = false;
  roles = [];
  const second = await login(first.cookie);
  assert.equal(second.response.headers.get('location'), 'http://localhost:3000/filiacao');
  assert.equal(checks, 2);
  assert.equal((await call('/api/state', second.cookie)).status, 403);
  assert.equal((await call('/api/state', first.cookie)).status, 401);
});
