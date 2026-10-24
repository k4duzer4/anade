import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';

async function setup(t, options = {}) {
  const repo = new MemoryRepository(),
    store = new session.MemoryStore(),
    secret = 'community-test-secret-more-than-thirty-two-characters',
    cookies = {};
  for (const id of ['admin', 'member', 'other']) {
    await repo.account(id, id);
    const sid = `community-${id}`;
    await new Promise((resolve, reject) =>
      store.set(
        sid,
        {
          cookie: { expires: new Date(Date.now() + 120000) },
          user: { id, member: true, expires: Date.now() + 120000 },
          csrf: 'community-csrf',
        },
        (e) => (e ? reject(e) : resolve()),
      ),
    );
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    cookies[id] = `anade.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
  }
  repo.admins.add('admin');
  await repo.saveProfile('member', {
    name: 'José RPG',
    blue: '@jose',
    legapp: 'SUPERPRIVATE',
    shareLegapp: false,
  });
  const server = createApp({ repo, store, secret, env: {}, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (path, id = 'member', method = 'GET', body, csrf = 'community-csrf') =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        ...(id ? { Cookie: cookies[id] } : {}),
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  return { call, repo };
}

test('mural de divulgação: só filiados, autoria e CSRF, links HTTPS e limpeza na virada das 8h', async (t) => {
  let date = new Date('2026-10-24T10:59:59Z');
  const { call, repo } = await setup(t, { now: () => date });
  const publication = {
    type: 'post',
    title: 'Meu post',
    url: 'https://legado.planalto.fun/blue/post/123',
    ownerId: 'admin',
  };
  assert.equal((await call('/api/publications', null)).status, 401);
  assert.equal((await call('/api/publications', 'member', 'POST', publication, '')).status, 403);
  assert.equal(
    (
      await call('/api/publications', 'member', 'POST', {
        ...publication,
        url: 'javascript:alert(1)',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('/api/publications', 'member', 'POST', {
        ...publication,
        url: 'https://user:password@example.com',
      })
    ).status,
    400,
  );
  const created = await call('/api/publications', 'member', 'POST', publication);
  assert.equal(created.status, 201);
  const { id } = await created.json();
  let feed = await (await call('/api/publications', 'other')).json();
  assert.equal(feed.records[0].ownerId, 'member');
  assert.equal(feed.resetsAt, '2026-10-24T11:00:00.000Z');
  assert.equal((await call(`/api/publications/${id}`, 'other', 'DELETE', {})).status, 403);
  assert.equal((await call('/api/publications', 'member', 'POST', publication)).status, 409);
  date = new Date('2026-10-24T11:00:00Z');
  feed = await (await call('/api/publications')).json();
  assert.equal(feed.records.length, 0);
  assert.equal(repo.publications.size, 0);
  assert.equal(feed.resetsAt, '2026-10-25T11:00:00.000Z');
  const current = await call('/api/publications', 'member', 'POST', {
    ...publication,
    type: 'materia',
  });
  assert.equal(current.status, 201);
  const currentId = (await current.json()).id;
  assert.equal((await call(`/api/publications/${currentId}`, 'member', 'DELETE', {})).status, 200);
  assert.equal((await (await call('/api/publications')).json()).records.length, 0);
  assert.equal((await call('/api/publications?page=-1')).status, 400);
});

test('estatuto: começa em elaboração, somente ADM mantém rascunho e publica sem vazar texto privado', async (t) => {
  const { call } = await setup(t);
  const draft = {
    title: 'Estatuto da ANADE',
    body: 'Texto em revisão privada',
    url: '',
    published: false,
  };
  assert.equal((await call('/api/statute', null)).status, 401);
  assert.equal((await (await call('/api/statute')).json()).published, false);
  assert.equal((await call('/api/statute', 'member', 'PUT', draft)).status, 403);
  assert.equal((await call('/api/statute', 'admin', 'PUT', draft, '')).status, 403);
  assert.equal((await call('/api/statute', 'admin', 'PUT', draft)).status, 200);
  assert.equal((await (await call('/api/statute', 'member')).json()).body, '');
  assert.equal((await (await call('/api/statute', 'admin')).json()).body, draft.body);
  assert.equal(
    (await call('/api/statute', 'admin', 'PUT', { ...draft, body: '', published: true })).status,
    400,
  );
  assert.equal(
    (await call('/api/statute', 'admin', 'PUT', { ...draft, published: true })).status,
    200,
  );
  assert.equal((await (await call('/api/statute', 'other')).json()).body, draft.body);
  assert.equal((await call('/api/statute', 'admin', 'PUT', draft)).status, 200);
  assert.equal((await (await call('/api/statute', 'other')).json()).body, '');
});
test('propostas: filiação, CSRF, autoria, apoio idempotente, comentários e encaminhamento único com abstenção', async (t) => {
  const { call, repo } = await setup(t);
  assert.equal((await call('/api/proposals', null)).status, 401);
  assert.equal(
    (await call('/api/proposals', 'member', 'POST', { title: 'Ideia', body: 'Educação' }, ''))
      .status,
    403,
  );
  const fullContext = 'Mais ensino técnico ' + 'á'.repeat(3200);
  const { id } = await (
    await call('/api/proposals', 'member', 'POST', {
      title: 'Educação',
      body: fullContext,
      ownerId: 'admin',
      pollId: 'forged',
    })
  ).json();
  assert.equal(
    (await call(`/api/proposals/${id}`, 'other', 'PUT', { title: 'Ataque', body: 'Alterar' }))
      .status,
    403,
  );
  await Promise.all([
    call(`/api/proposals/${id}/support`, 'other', 'PUT', { enabled: true }),
    call(`/api/proposals/${id}/support`, 'other', 'PUT', { enabled: true }),
  ]);
  let item = await (await call(`/api/proposals/${id}`, 'other')).json();
  assert.equal(item.ownerId, 'member');
  assert.equal(item.pollId, undefined);
  assert.equal(item.supports, 1);
  assert.equal(item.supported, true);
  await call(`/api/proposals/${id}/comments`, 'other', 'POST', { body: 'Apoio esta ideia.' });
  assert.equal(
    (await (await call(`/api/proposals/${id}/comments`)).json()).records[0].body,
    'Apoio esta ideia.',
  );
  const poll = {
    options: ['Aprovar', 'Rejeitar'],
    secret: true,
    deadline: new Date(Date.now() + 86400000).toISOString(),
  };
  assert.equal((await call(`/api/proposals/${id}/poll`, 'other', 'POST', poll)).status, 403);
  const results = await Promise.all([
    call(`/api/proposals/${id}/poll`, 'admin', 'POST', poll),
    call(`/api/proposals/${id}/poll`, 'admin', 'POST', poll),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(repo.data.polls.length, 1);
  assert.equal(repo.data.polls[0].description, fullContext);
  assert.equal(repo.data.polls[0].options.at(-1), 'Abstenção');
  assert.equal(
    (await call(`/api/proposals/${id}`, 'member', 'PUT', { title: 'Mudei', body: 'Outra ideia' }))
      .status,
    409,
  );
});
test('comunicados: somente administrador publica, fixação tem prioridade, leitura é individual e edições exigem nova leitura', async (t) => {
  const { call } = await setup(t);
  assert.equal(
    (await call('/api/announcements', 'member', 'POST', { title: 'Aviso', body: 'Texto' })).status,
    403,
  );
  const data = {
    title: 'Importante',
    body: 'Leia o programa',
    pinned: true,
    dueDate: '2026-12-31',
  };
  const { id } = await (await call('/api/announcements', 'admin', 'POST', data)).json();
  await call('/api/announcements', 'admin', 'POST', {
    title: 'Recente',
    body: 'Texto',
    pinned: false,
  });
  await call(`/api/announcements/${id}/read`, 'member', 'PUT', {});
  await call(`/api/announcements/${id}/read`, 'member', 'PUT', {});
  let items = (await (await call('/api/announcements')).json()).records;
  assert.equal(items[0].id, id);
  assert.equal(items[0].read, true);
  assert.equal(items[0].reads, 1);
  assert.equal((await (await call('/api/announcements', 'other')).json()).records[0].read, false);
  await call(`/api/announcements/${id}`, 'admin', 'PUT', { ...data, body: 'Programa atualizado' });
  items = (await (await call('/api/announcements')).json()).records;
  assert.equal(items[0].read, false);
  assert.equal(items[0].reads, 0);
});
test('campanha começa fechada, só admin abre/fecha, protege entradas na busca e valida autoria e links', async (t) => {
  const { call } = await setup(t);
  const entry = {
    title: 'Futuro do Brasil',
    body: 'Pré-candidatura',
    office: 'Deputado federal',
    state: 'SP',
    materials: [],
  };
  const offices = await (await call('/api/config')).json();
  entry.office = offices.electoralOffices.find((office) =>
    office.toLowerCase().includes('deputado'),
  );
  assert.equal((await (await call('/api/campaigns')).json()).open, false);
  assert.equal((await call('/api/campaigns', 'member', 'POST', entry)).status, 403);
  assert.equal(
    (await call('/api/admin/campaigns/status', 'member', 'PUT', { open: true })).status,
    403,
  );
  await call('/api/admin/campaigns/status', 'admin', 'PUT', { open: true });
  assert.equal(
    (
      await call('/api/campaigns', 'member', 'POST', {
        ...entry,
        materials: ['javascript:alert(1)'],
      })
    ).status,
    400,
  );
  const { id } = await (await call('/api/campaigns', 'member', 'POST', entry)).json();
  assert.ok(id);
  assert.equal((await call(`/api/campaigns/${id}`, 'other', 'PUT', entry)).status, 403);
  assert.equal((await call('/api/campaigns', 'member', 'POST', entry)).status, 409);
  await call('/api/admin/campaigns/status', 'admin', 'PUT', { open: false });
  assert.equal((await (await call('/api/campaigns')).json()).records.length, 0);
  assert.equal((await (await call('/api/campaigns', 'admin')).json()).records.length, 1);
  assert.equal((await (await call('/api/search?q=Futuro')).json()).results.length, 0);
  assert.equal((await (await call('/api/search?q=Futuro', 'admin')).json()).results.length, 1);
});
test('linha do tempo é declarada pelo dono e busca nunca indexa LegApp privado', async (t) => {
  const { call } = await setup(t);
  const data = {
    title: 'Mandato de deputado',
    body: 'Contribuição no RPG',
    type: 'mandato',
    start: '2026-10-01',
    end: '',
  };
  const { id } = await (await call('/api/profile/timeline', 'member', 'POST', data)).json();
  assert.equal((await call(`/api/profile/timeline/${id}`, 'admin', 'PUT', data)).status, 403);
  assert.equal((await call(`/api/profile/timeline/${id}`, 'other', 'DELETE')).status, 403);
  assert.equal(
    (await (await call('/api/members/member/timeline', 'other')).json()).records[0].title,
    data.title,
  );
  assert.equal(
    (await call('/api/profile/timeline', 'member', 'POST', { ...data, start: '2026-02-31' }))
      .status,
    400,
  );
  const results = await (await call('/api/search?q=SUPERPRIVATE', 'other')).json();
  assert.equal(results.results.length, 0);
  assert.equal(
    (await (await call('/api/search?q=Jose', 'other')).json()).results[0].title,
    'José RPG',
  );
});
