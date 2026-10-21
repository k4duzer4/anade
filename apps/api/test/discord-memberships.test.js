import test from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { PgRepository } from '../src/repository.js';
import { discordRequest } from '../src/app.js';
import { membershipFixture } from './helpers/memberships.js';

test('filiação: cache compartilhado, expiração, revogação e cooldown sem usar confirmação vencida', async () => {
  const db = newDb();
  await membershipFixture(db);
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const first = new PgRepository(pool),
    second = new PgRepository(pool);
  let clock = Date.now(),
    calls = 0,
    roles = ['member'];
  const load = async () => {
    calls++;
    return { roles };
  };
  const options = { now: () => clock };
  try {
    assert.deepEqual(await first.discordMember('guild', 'user', load, options), {
      roles: ['member'],
    });
    roles = [];
    assert.deepEqual(await second.discordMember('guild', 'user', load, options), {
      roles: ['member'],
    });
    assert.equal(calls, 1);
    clock += 120001;
    assert.deepEqual(await second.discordMember('guild', 'user', load, options), { roles: [] });
    assert.equal(calls, 2);
    clock += 120001;
    const limited = async () => {
      calls++;
      throw Object.assign(new Error('limited'), { code: 'DISCORD_RATE_LIMITED', retryAfter: 90 });
    };
    await assert.rejects(first.discordMember('guild', 'user', limited, options), {
      code: 'DISCORD_RATE_LIMITED',
      status: 503,
      retryAfter: 90,
    });
    roles = ['member'];
    await assert.rejects(second.discordMember('guild', 'user', load, options), {
      code: 'DISCORD_RATE_LIMITED',
    });
    assert.equal(calls, 3);
    clock += 90001;
    assert.deepEqual(await second.discordMember('guild', 'user', load, options), {
      roles: ['member'],
    });
    assert.equal(calls, 4);
    roles = [];
    assert.deepEqual(
      await second.discordMember('guild', 'user', load, { ...options, refresh: true }),
      { roles: [] },
    );
    assert.equal(calls, 5);
    await first.discordMember('other-guild', 'user', load, options);
    assert.equal(calls, 6);
  } finally {
    await pool.end();
  }
});

test('Discord 429: usa o maior prazo informado e preserva a negação de acesso', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ retry_after: 17.651 }), {
        status: 429,
        headers: { 'Retry-After': '258', 'X-RateLimit-Reset-After': '257.651' },
      }),
  );
  await assert.rejects(discordRequest('/users/@me/guilds/guild/member', 'test-only'), {
    status: 503,
    code: 'DISCORD_RATE_LIMITED',
    retryAfter: 258,
  });
});
