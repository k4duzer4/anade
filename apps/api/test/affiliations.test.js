import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import session from 'express-session';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { MemoryRepository, PgRepository } from '../src/repository.js';
import { AffiliationStore, affiliationForm, LEGAL_VERSION } from '../src/affiliation-store.js';
import { AffiliationDiscord, deliverAffiliation } from '../src/affiliation-discord.js';

const form = () => ({
  name: 'Pessoa do RPG',
  city: 'São Paulo',
  state: 'SP',
  age: 30,
  degrees: ['Direito'],
  legapp: '(11) 423-653',
  blue: '@personagem',
  email: 'personagem@legado.test',
  current: 'Social-democracia',
  plans: 'Participar do Legislativo.',
  contribution: 'Construir propostas.',
  accepted: true,
  legalVersion: LEGAL_VERSION,
  admin: true,
  office: 'presidente',
  member: true,
});
const now = () => new Date('2026-10-26T16:00:00Z');
async function api(t, affiliationBot) {
  const repo = new MemoryRepository();
  const store = new session.MemoryStore();
  const secret = 'test-affiliation-only-session-secret-32-characters';
  const cookies = {};
  for (const id of ['admin', 'applicant', 'other', 'legacy']) {
    await repo.account(id, id);
    if (id === 'admin') repo.admins.add(id);
    const sid = randomUUID();
    await new Promise((resolve, reject) =>
      store.set(
        sid,
        {
          cookie: { expires: new Date(Date.now() + 60000) },
          user: {
            id,
            discord: id,
            member: ['admin', 'legacy'].includes(id),
            admin: id === 'admin',
            expires: Date.now() + 60000,
          },
          csrf: 'test-csrf',
        },
        (e) => (e ? reject(e) : resolve()),
      ),
    );
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    cookies[id] = `anade.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
  }
  const server = createApp({ repo, store, secret, env: {}, affiliationBot, now }).listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (id, path, method = 'GET', body, extra = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        Cookie: cookies[id] || '',
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'test-csrf',
        ...extra,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { repo, call };
}
test('filiação: candidatura privada, aceite no servidor, concorrência e aprovação sem autopromoção', async (t) => {
  const { repo, call } = await api(t);
  assert.equal((await call('', '/api/affiliation/session')).status, 401);
  assert.equal((await call('applicant', '/api/state')).status, 403);
  assert.equal((await call('applicant', '/api/profile', 'PUT', form())).status, 403);
  assert.equal((await call('applicant', '/api/admin/affiliations')).status, 403);
  assert.equal(
    (await call('applicant', '/api/affiliation/requests', 'POST', form(), { 'X-CSRF-Token': '' }))
      .status,
    403,
  );
  assert.equal(
    (await call('applicant', '/api/affiliation/requests', 'POST', { ...form(), accepted: false }))
      .status,
    400,
  );
  assert.equal(
    (
      await call('applicant', '/api/affiliation/requests', 'POST', {
        ...form(),
        legalVersion: 'outdated',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('applicant', '/api/affiliation/requests', 'POST', form(), {
        Origin: 'https://evil.test',
      })
    ).status,
    403,
  );
  const simultaneous = await Promise.all([
    call('applicant', '/api/affiliation/requests', 'POST', form()),
    call('applicant', '/api/affiliation/requests', 'POST', form()),
  ]);
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [201, 409]);
  assert.equal(repo.data.members.length, 0);
  const own = await (await call('applicant', '/api/affiliation/session')).json();
  assert.equal(own.request.data.acceptedAt, now().toISOString());
  assert.equal(own.request.data.admin, undefined);
  assert.equal(own.request.deliveries, undefined);
  assert.equal((await (await call('other', '/api/affiliation/session')).json()).request, null);
  const id = own.request.id;
  assert.equal(
    (await call('other', `/api/affiliation/requests/${id}/withdraw`, 'POST', {})).status,
    404,
  );
  assert.equal(
    (
      await call('applicant', `/api/admin/affiliations/${id}/review`, 'POST', {
        decision: 'approved',
      })
    ).status,
    403,
  );
  const reviews = await Promise.all([
    call('admin', `/api/admin/affiliations/${id}/review`, 'POST', {
      decision: 'approved',
      note: 'Bem-vindo.',
    }),
    call('admin', `/api/admin/affiliations/${id}/review`, 'POST', { decision: 'approved' }),
  ]);
  assert.deepEqual(
    reviews.map((r) => r.status),
    [200, 200],
  );
  assert.equal(repo.data.members.length, 1);
  assert.equal(repo.data.members[0].email, undefined);
  assert.equal(repo.data.members[0].shareLegapp, false);
  assert.equal(repo.data.members[0].admin, undefined);
  const access = await (await call('applicant', '/api/access')).json();
  assert.equal(access.user.admin, false);
  assert.equal((await call('applicant', '/api/state')).status, 200);
  const queue = await (await call('admin', '/api/admin/affiliations?status=approved')).json();
  assert.equal(queue.requests[0].deliveries.role.error, 'BOT_NOT_CONFIGURED');
  assert.equal(queue.requests[0].deliveries.dm.state, 'pending');
  assert.equal(
    (await call('admin', `/api/admin/affiliations/${id}/review`, 'POST', { decision: 'rejected' }))
      .status,
    409,
  );
  assert.equal((await call('applicant', '/api/affiliation/requests', 'POST', form())).status, 409);
  assert.equal((await call('other', '/api/logout', 'POST', {})).status, 200);
});
test('retirada, nova solicitação, recusa e preservação de ficha preexistente', async (t) => {
  const { repo, call } = await api(t);
  await repo.saveProfile('applicant', { name: 'Nome anterior', bio: 'História preservada' });
  const first = await (await call('applicant', '/api/affiliation/requests', 'POST', form())).json();
  assert.equal(
    (await call('applicant', `/api/affiliation/requests/${first.id}/withdraw`, 'POST', {})).status,
    200,
  );
  const second = await (
    await call('applicant', '/api/affiliation/requests', 'POST', form())
  ).json();
  assert.equal(
    (await (await call('applicant', '/api/affiliation/session')).json()).request.id,
    second.id,
  );
  assert.equal(
    (
      await call('admin', `/api/admin/affiliations/${second.id}/review`, 'POST', {
        decision: 'rejected',
        note: 'Complete seus planos.',
      })
    ).status,
    200,
  );
  assert.equal((await call('applicant', '/api/access')).status, 403);
  const third = await (await call('applicant', '/api/affiliation/requests', 'POST', form())).json();
  assert.equal(
    (
      await call('admin', `/api/admin/affiliations/${third.id}/review`, 'POST', {
        decision: 'approved',
      })
    ).status,
    200,
  );
  assert.equal(repo.data.members[0].name, 'Nome anterior');
  assert.equal(repo.data.members[0].bio, 'História preservada');
});
test('PostgreSQL: persistência da candidatura, aceite, perfil e autorização entre instâncias', async () => {
  const db = newDb();
  for (const file of ['001_initial.sql', '007_account_admin.sql', '018_affiliations.sql'])
    db.public.none(
      (await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8')).split(
        'ALTER TABLE anade.affiliation_requests ENABLE',
      )[0],
    );
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  try {
    const repo = new PgRepository(pool);
    await repo.account('candidate', 'candidate');
    await repo.account('admin', 'admin');
    const first = new AffiliationStore(repo);
    const second = new AffiliationStore(new PgRepository(pool));
    const record = await first.submit(
      { id: 'candidate', discord: 'candidate', member: false },
      affiliationForm(form()),
      now(),
    );
    assert.equal((await second.latest('candidate')).data.legalVersion, LEGAL_VERSION);
    assert.equal((await second.list('pending', 0)).total, 1);
    await assert.rejects(
      first.decide(record.id, 'candidate', 'approved', '', now()),
      (e) => e.status === 403,
    );
    await second.decide(record.id, 'admin', 'approved', 'Aprovado', now());
    assert.equal(await first.access('candidate', false), true);
    assert.equal(
      (await pool.query('SELECT data FROM anade.profiles WHERE account_id=$1', ['candidate']))
        .rows[0].data.name,
      form().name,
    );
    await assert.rejects(
      first.decide(record.id, 'admin', 'rejected', '', now()),
      (e) => e.status === 409,
    );
  } finally {
    await pool.end();
  }
});
test('bot: cargo fixo, destinatário verificado, nonce e menções desativadas; sem segredo na mensagem', async () => {
  const calls = [];
  const bot = new AffiliationDiscord(
    {
      DISCORD_BOT_TOKEN: 'test-only-secret',
      DISCORD_GUILD_ID: 'guild',
      DISCORD_MEMBER_ROLE_ID: 'role',
    },
    'https://portal.test',
    async (url, options) => {
      calls.push({ url, ...options });
      return url.endsWith('/roles/role')
        ? new Response(null, { status: 204 })
        : Response.json(
            url.endsWith('/users/@me/channels') ? { id: '123456789012345678' } : { id: 'message' },
          );
    },
  );
  const record = {
    id: randomUUID(),
    accountId: '1545874999284473936',
    data: { name: '@everyone' },
  };
  await bot.send(record, 'role');
  await bot.send(record, 'dm');
  assert.match(calls[0].url, /guilds\/guild\/members\/1545874999284473936\/roles\/role$/);
  assert.deepEqual(JSON.parse(calls[1].body), { recipient_id: record.accountId });
  const message = JSON.parse(calls[2].body);
  assert.deepEqual(message.allowed_mentions, { parse: [] });
  assert.equal(message.enforce_nonce, true);
  assert.equal(message.nonce.length, 25);
  assert.ok(!message.content.includes('test-only-secret'));
  assert.ok(!message.content.includes('@everyone'));
});
test('entrega durável: concorrência não duplica; falha de DM não desfaz aprovação; timeout exige confirmação', async () => {
  const repo = new MemoryRepository();
  await repo.account('candidate', 'candidate');
  const store = new AffiliationStore(repo);
  const record = await store.submit(
    { id: 'candidate', discord: 'candidate' },
    affiliationForm(form()),
    now(),
  );
  await store.decide(record.id, 'admin', 'approved', '', now());
  const calls = [];
  const bot = {
    send: async (_record, kind) => {
      calls.push(kind);
      if (kind === 'dm')
        throw Object.assign(new Error('timeout'), { code: 'DELIVERY_UNCONFIRMED' });
      return {};
    },
  };
  await Promise.all([
    deliverAffiliation(store, bot, record.id, ['role', 'dm'], now),
    deliverAffiliation(store, bot, record.id, ['role', 'dm'], now),
  ]);
  assert.deepEqual(calls.sort(), ['dm', 'role']);
  assert.equal(await store.access('candidate', false), true);
  assert.equal((await store.get(record.id)).deliveries.dm.state, 'unknown');
  await deliverAffiliation(store, bot, record.id, ['role', 'dm'], now);
  assert.equal(calls.length, 2);
  await deliverAffiliation(store, bot, record.id, ['dm'], now, true);
  assert.equal(calls.length, 3);
});
test('Discord: 403 mensagens bloqueadas e 429 respeitam erro seguro e prazo', async () => {
  const env = {
    DISCORD_BOT_TOKEN: 'not-logged',
    DISCORD_GUILD_ID: 'guild',
    DISCORD_MEMBER_ROLE_ID: 'role',
  };
  const blocked = new AffiliationDiscord(env, 'https://portal.test', async () =>
    Response.json({ code: 50007, message: 'untrusted' }, { status: 403 }),
  );
  await assert.rejects(
    blocked.send({ accountId: 'candidate' }, 'dm'),
    (e) => e.code === 'DM_BLOCKED' && !e.message.includes('untrusted'),
  );
  const limited = new AffiliationDiscord(env, 'https://portal.test', async () =>
    Response.json({ retry_after: 2.5 }, { status: 429 }),
  );
  await assert.rejects(
    limited.send({ accountId: 'candidate' }, 'role'),
    (e) => e.code === 'DISCORD_RATE_LIMITED' && e.retryAfter === 2.5,
  );
});
