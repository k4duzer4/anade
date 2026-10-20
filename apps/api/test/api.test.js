import test from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { seed } from '../src/seed.js';
test('Express: acesso, CSRF, papéis, fichas, votação e revogação de cargos', async (t) => {
  const repo = new MemoryRepository(seed()),
    store = new session.MemoryStore();
  let roles = ['member-role', 'admin-role'];
  let checks = 0;
  const app = createApp({
    repo,
    store,
    secret: 'test-secret-with-at-least-thirty-two-characters',
    demo: true,
    origin: 'http://localhost:3000',
    env: {
      DISCORD_GUILD_ID: 'guild',
      DISCORD_MEMBER_ROLE_ID: 'member-role',
      DISCORD_ADMIN_ROLE_ID: 'admin-role',
    },
    discord: async () => {
      checks++;
      return { roles };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function call(path, method = 'GET', body, identity = {}, headers = {}) {
    const r = await fetch(url + path, {
      method,
      redirect: 'manual',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        ...(identity.cookie ? { Cookie: identity.cookie } : {}),
        ...(identity.csrf ? { 'X-CSRF-Token': identity.csrf } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: r.status,
      body: r.headers.get('content-type')?.includes('application/json') ? await r.json() : null,
      cookie: r.headers.get('set-cookie')?.split(';')[0],
      location: r.headers.get('location'),
    };
  }
  assert.equal((await call('/api/state')).status, 401);
  assert.equal((await call('/api/access')).status, 401);
  assert.equal((await call('/api/directors', 'POST', {})).status, 401);
  assert.equal(
    (await call('/api/demo-login', 'POST', { role: 'admin' }, {}, { Origin: 'https://evil.test' }))
      .status,
    403,
  );
  assert.match((await call('/auth/discord/callback?state=forged')).location, /authError/);
  const admin = { cookie: (await call('/api/demo-login', 'POST', { role: 'admin' })).cookie };
  let result = await call('/api/state', 'GET', undefined, admin);
  admin.csrf = result.body.csrf;
  const member = { cookie: (await call('/api/demo-login', 'POST', { role: 'member' })).cookie };
  result = await call('/api/state', 'GET', undefined, member);
  member.csrf = result.body.csrf;
  assert.equal((await call('/api/access', 'GET', undefined, member)).status, 200);
  assert.equal((await call('/api/meetings', 'POST', {}, member)).status, 403);
  const director = {
    memberId: 'demo-1',
    title: 'Secretaria de comunicação',
    responsibility: 'Comunicação com os filiados.',
    position: 4,
  };
  assert.equal((await call('/api/directors', 'POST', director, member)).status, 403);
  assert.equal(
    (await call('/api/directors', 'POST', director, admin, { 'X-CSRF-Token': 'wrong' })).status,
    403,
  );
  assert.equal(
    (await call('/api/directors', 'POST', { ...director, memberId: 'missing' }, admin)).status,
    400,
  );
  assert.equal(
    (await call('/api/directors', 'POST', { ...director, position: 0 }, admin)).status,
    400,
  );
  assert.equal(
    (await call('/api/directors', 'POST', { ...director, title: '' }, admin)).status,
    400,
  );
  assert.equal((await call('/api/directors', 'POST', director, admin)).status, 201);
  assert.equal((await call('/api/directors', 'POST', director, admin)).status, 409);
  result = await call('/api/state', 'GET', undefined, member);
  const savedDirector = result.body.directors.find((d) => d.title === director.title);
  assert.equal(savedDirector.memberId, director.memberId);
  assert.equal(
    (await call(`/api/directors/${savedDirector.id}`, 'PUT', director, member)).status,
    403,
  );
  assert.equal(
    (await call(`/api/directors/${savedDirector.id}`, 'DELETE', {}, member)).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/api/directors/${savedDirector.id}`,
        'PUT',
        { ...director, title: 'Comunicação nacional', position: 2 },
        admin,
      )
    ).status,
    200,
  );
  result = await call('/api/state', 'GET', undefined, member);
  assert.equal(
    result.body.directors.find((d) => d.id === savedDirector.id).title,
    'Comunicação nacional',
  );
  assert.equal((await call(`/api/directors/${savedDirector.id}`, 'DELETE', {}, admin)).status, 200);
  assert.equal(
    (await call(`/api/directors/${savedDirector.id}`, 'PUT', director, admin)).status,
    404,
  );
  result = await call('/api/state', 'GET', undefined, admin);
  assert.equal(
    result.body.directors.some((d) => d.id === savedDirector.id),
    false,
  );
  assert.equal(
    result.body.members.some((m) => m.id === director.memberId),
    true,
  );
  const meeting = {
    title: 'Reunião com Meet',
    date: new Date(Date.now() + 60000).toISOString(),
    agenda: ['Pauta 1'],
    meetUrl: 'https://meet.google.com/abc-defg-hij',
    docsUrl: 'https://docs.google.com/document/d/test-document/edit',
    minutes: 'Notas da direção',
  };
  assert.equal((await call('/api/meetings', 'POST', meeting, admin)).status, 201);
  result = await call('/api/state', 'GET', undefined, member);
  const saved = result.body.meetings.find((m) => m.title === meeting.title);
  assert.equal(saved.meetUrl, meeting.meetUrl);
  assert.equal(saved.docsUrl, meeting.docsUrl);
  assert.equal(
    (await call(`/api/meetings/${saved.id}`, 'PUT', { ...meeting, docsUrl: '' }, member)).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/api/meetings/${saved.id}/minutes`,
        'PUT',
        { minutes: 'Alteração indevida' },
        member,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        '/api/meetings',
        'POST',
        { ...meeting, meetUrl: 'https://meet.google.com.evil.test/abc-defg-hij' },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        `/api/meetings/${saved.id}`,
        'PUT',
        { ...meeting, docsUrl: 'javascript:alert(1)' },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        `/api/meetings/${saved.id}`,
        'PUT',
        {
          ...meeting,
          title: 'Título atualizado',
          docsUrl: 'https://docs.google.com/document/d/another-document/edit',
        },
        admin,
      )
    ).status,
    200,
  );
  result = await call('/api/state', 'GET', undefined, member);
  assert.equal(result.body.meetings.find((m) => m.id === saved.id).title, 'Título atualizado');
  assert.equal(
    result.body.meetings.find((m) => m.id === saved.id).docsUrl,
    'https://docs.google.com/document/d/another-document/edit',
  );
  assert.equal(
    (await call('/api/polls', 'POST', {}, admin, { 'X-CSRF-Token': 'wrong' })).status,
    403,
  );
  assert.equal(
    (
      await call(
        '/api/profile',
        'PUT',
        {
          name: 'Maria Silva',
          state: 'BA',
          ideology: 'Centro',
          age: 33,
          season: 'Temporada 1',
          degrees: [],
          legapp: '(71) 432-653',
          shareLegapp: false,
        },
        member,
      )
    ).status,
    200,
  );
  result = await call('/api/state', 'GET', undefined, admin);
  assert.equal(result.body.members.find((m) => m.id === 'demo-member').legapp, undefined);
  const pollId = result.body.polls[0].id;
  assert.equal(
    (await call(`/api/polls/${pollId}/vote`, 'POST', { option: 0 }, member)).status,
    200,
  );
  assert.equal(
    (await call(`/api/polls/${pollId}/vote`, 'POST', { option: 1 }, member)).status,
    409,
  );
  result = await call('/api/state', 'GET', undefined, admin);
  assert.equal(result.body.polls[0].counts, undefined);
  assert.equal(result.body.polls[0].votes, undefined);
  assert.equal(result.body.polls[0].ballots, undefined);
  assert.equal((await call(`/api/polls/${pollId}/close`, 'POST', {}, member)).status, 403);
  assert.equal((await call(`/api/polls/${pollId}/close`, 'POST', {}, admin)).status, 200);
  result = await call('/api/state', 'GET', undefined, member);
  assert.equal(result.body.polls[0].counts[0], 3);
  // Substitui apenas a sessão de teste para simular um usuário OAuth já autenticado.
  const sid = decodeURIComponent(admin.cookie.split('=')[1]).slice(2).split('.')[0];
  const sess = await new Promise((resolve, reject) =>
    store.get(sid, (e, s) => (e ? reject(e) : resolve(s))),
  );
  sess.user.demo = false;
  sess.user.accessToken = 'test-token';
  await new Promise((resolve, reject) => store.set(sid, sess, (e) => (e ? reject(e) : resolve())));
  roles = ['member-role'];
  assert.equal((await call('/api/meetings', 'POST', {}, admin)).status, 403);
  assert.equal(checks, 1);
  roles = [];
  assert.equal((await call('/api/state', 'GET', undefined, admin)).status, 403);
  assert.equal(checks, 2);
  assert.equal((await call('/api/access', 'GET', undefined, admin)).status, 403);
  assert.equal((await call('/api/logout', 'POST', {}, member)).status, 200);
  assert.equal((await call('/api/state', 'GET', undefined, member)).status, 401);
});
test('modo real não oferece entrada demonstrativa e produção recusa demonstração', async (t) => {
  assert.throws(
    () =>
      createApp({
        repo: new MemoryRepository(),
        demo: true,
        secret: 'x'.repeat(40),
        env: { NODE_ENV: 'production' },
      }),
    /produção/,
  );
  const app = createApp({ repo: new MemoryRepository(), secret: 'x'.repeat(40) });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/demo-login`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: '{"role":"admin"}',
  });
  assert.equal(r.status, 404);
});
