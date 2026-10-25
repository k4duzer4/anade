import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { kmeetAdmission, kmeetProvider } from '../src/kmeet.js';
import { PlenaryStore } from '../src/plenary-store.js';
import { OrganizationStore } from '../src/organization-store.js';
import { readFile } from 'node:fs/promises';
import { newDb } from 'pg-mem';
import { PgRepository } from '../src/repository.js';
const env = {};
async function setup(t, options = {}) {
  const repo = new MemoryRepository(),
    store = new session.MemoryStore(),
    secret = 'plenary-session-secret-for-tests-only-32-chars',
    cookies = {};
  for (const id of [
    'admin',
    'member',
    'other',
    ...Array.from({ length: options.extraCount || 10 }, (_, i) => `extra${i}`),
  ]) {
    await repo.account(id, id);
    await repo.saveProfile(id, { name: `Nome ${id}`, state: 'SP' });
    const sid = `plenary-${id}`;
    await new Promise((ok) =>
      store.set(
        sid,
        {
          cookie: { expires: new Date(Date.now() + 120000) },
          user: { id, member: true, expires: Date.now() + 120000 },
          csrf: 'csrf',
        },
        ok,
      ),
    );
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    cookies[id] = `anade.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
  }
  repo.admins.add('admin');
  const server = createApp({ repo, store, secret, env, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((ok) => server.close(ok)));
  const call = (path, actor = 'admin', method = 'GET', body, csrf = 'csrf') =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        ...(actor ? { Cookie: cookies[actor] } : {}),
        Origin: 'http://localhost:3000',
        'X-CSRF-Token': csrf,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const created = await call('/api/meetings', 'admin', 'POST', {
    title: 'Plenário de teste',
    conference: 'plenary',
    date: new Date(Date.now() + 3600000).toISOString(),
    agenda: ['Educação', 'Saúde'],
  });
  assert.equal(created.status, 201);
  const id = repo.data.meetings[0].id,
    base = `/api/plenaries/${id}`;
  const configure = () =>
    call(base, 'admin', 'PUT', {
      capacity: 10,
      quorumPercent: 50,
      electorIds: ['member', 'other'],
      moderatorIds: [],
      sharedModerationAccepted: true,
    });
  const prepare = async () => ({ status: 200 });
  const open = () => call(`${base}/open`, 'admin', 'POST', {});
  return { repo, call, id, base, configure, prepare, open };
}

test('kMeet: origem fixa, sala imprevisível e nenhum segredo de provedor ou papel falso', () => {
  assert.equal(kmeetProvider({}).configured, true);
  assert.equal(kmeetProvider({ KMEET_ENABLED: 'false' }).configured, false);
  assert.equal(kmeetProvider({}).maxCapacity, 40);
  const a = kmeetAdmission(
    { roomKey: '10000000-0000-4000-8000-000000000001' },
    { name: 'Personagem', canModerate: false },
  );
  assert.equal(a.domain, 'kmeet.infomaniak.com');
  assert.equal(a.moderation, 'shared');
  assert.equal(a.canModerate, false);
  assert.equal(a.roomName, 'anade10000000000040008000000000000001');
  assert.throws(
    () => kmeetAdmission({ roomKey: 'https://evil.example' }, { name: 'X' }),
    /inválida/,
  );
});

test('plenário: regras, autenticação, CSRF, sala oculta e controle de capacidade', async (t) => {
  const { call, base, configure, open } = await setup(t);
  assert.equal((await call(base, null)).status, 401);
  assert.equal((await call(base, 'member', 'PUT', {})).status, 403);
  assert.equal((await call(base, 'admin', 'PUT', {}, '')).status, 403);
  assert.equal((await configure()).status, 200);

  const serialized = await (await call(base, 'member')).text();
  assert.ok(!serialized.includes('roomName'));
  assert.equal((await call(`${base}/join`, 'member', 'POST', {})).status, 409);
  assert.ok(!serialized.includes('roomKey'));
  assert.equal((await open()).status, 200);
  const directory = await (await call('/api/plenaries', 'member')).json();
  assert.equal(directory.records[0].sessionStatus, 'open');
  assert.equal(directory.records[0].electorate, 2);
  assert.ok(!JSON.stringify(directory).includes('roomKey'));
  assert.equal((await configure()).status, 409);
  const participant = await (
    await call(`${base}/join`, 'member', 'POST', {
      role: 1,
      canHost: true,
      userName: 'Admin forjado',
    })
  ).json();
  assert.equal(participant.canModerate, false);
  assert.equal(participant.moderation, 'shared');
  assert.equal(participant.userName, 'Nome member');
  const host = await (await call(`${base}/join`, 'admin', 'POST', {})).json();
  assert.equal(host.canModerate, true);
  assert.equal(host.roomName, participant.roomName);
  assert.equal((await call(`${base}/join`, 'member', 'POST', {})).status, 409);
  const attempts = await Promise.all(
    Array.from({ length: 10 }, (_, i) => call(`${base}/join`, `extra${i}`, 'POST', {})),
  );
  assert.equal(attempts.filter((r) => r.status === 200).length, 8);
  assert.equal(attempts.filter((r) => r.status === 409).length, 2);
  assert.equal((await call(`${base}/leave`, 'member', 'POST', {})).status, 200);
  const denied = attempts.findIndex((r) => r.status === 409);
  assert.equal((await call(`${base}/join`, `extra${denied}`, 'POST', {})).status, 200);
});

test('plenário: quórum, pauta ativa, sigilo e votação exigem presença; encerramento bloqueia novos votos', async (t) => {
  const { call, base, repo, id, configure, prepare, open } = await setup(t);
  await configure();
  await prepare();
  await open();
  const poll = {
    title: 'Decisão ao vivo',
    options: ['Sim', 'Não'],
    deadline: new Date(Date.now() + 600000).toISOString(),
    secret: true,
    quorumPercent: 50,
    approvalRule: 'plurality',
  };
  assert.equal((await call(`${base}/polls`, 'admin', 'POST', poll)).status, 409);
  assert.equal(
    (await call(`${base}/presence`, 'member', 'PUT', { connected: true, handRaised: false }))
      .status,
    403,
  );
  await call(`${base}/join`, 'member', 'POST', {});
  assert.equal((await (await call(base)).json()).present, 0);
  await call(`${base}/presence`, 'member', 'PUT', { connected: true, handRaised: true });
  let state = await (await call(base)).json();
  assert.equal(state.present, 0);
  assert.equal(
    (await call(`${base}/attendees/member`, 'member', 'PUT', { verified: true })).status,
    403,
  );
  assert.equal((await call(`${base}/polls`, 'admin', 'POST', poll)).status, 409);
  assert.equal(
    (await call(`${base}/attendees/member`, 'admin', 'PUT', { verified: true })).status,
    200,
  );
  state = await (await call(base)).json();
  assert.equal(state.present, 1);
  assert.equal(state.quorum, 1);
  assert.equal(state.quorumReached, true);
  assert.equal(state.attendees[0].handRaised, true);
  assert.equal((await call(`${base}/topic`, 'member', 'PUT', { index: 1 })).status, 403);
  assert.equal((await call(`${base}/topic`, 'admin', 'PUT', { index: 1 })).status, 200);
  assert.equal((await call(`/api/meetings/${id}`, 'admin', 'DELETE', {})).status, 409);
  const created = await call(`${base}/polls`, 'admin', 'POST', poll);
  assert.equal(created.status, 201);
  const { id: pollId } = await created.json();
  assert.equal(
    (await call(`/api/polls/${pollId}/vote`, 'other', 'POST', { option: 0 })).status,
    403,
  );
  assert.equal(
    (await call(`/api/polls/${pollId}/vote`, 'member', 'POST', { option: 0 })).status,
    200,
  );
  state = await (await call(base, 'other')).json();
  assert.equal(state.polls[0].counts, undefined);
  assert.equal(state.polls[0].ballots, undefined);
  assert.equal(
    (await call(`${base}/attendees/member`, 'other', 'PUT', { excluded: true })).status,
    403,
  );
  assert.equal((await call(`${base}/close`, 'member', 'POST', {})).status, 403);
  assert.equal((await call(`${base}/close`, 'admin', 'POST', {})).status, 200);
  assert.equal((await call(`${base}/join`, 'other', 'POST', {})).status, 409);
  assert.equal(
    (await call(`/api/polls/${pollId}/vote`, 'other', 'POST', { option: 0 })).status,
    409,
  );
  state = await (await call(base)).json();
  assert.equal(state.session.status, 'closed');
  assert.equal(state.present, 0);
  assert.equal(state.quorumReached, false);
  assert.deepEqual(state.polls[0].counts, [1, 0, 0]);
  assert.equal(repo.data.polls[0].governance.plenaryMeetingId, id);
});

test('plenário: 40 admissões concorrentes, 41ª bloqueada e entrada suspensa não recupera presença', async (t) => {
  const { repo, call, base, open } = await setup(t, { extraCount: 41 });
  assert.equal(
    (
      await call(base, 'admin', 'PUT', {
        capacity: 41,
        quorumPercent: 50,
        electorIds: ['member'],
        moderatorIds: [],
        sharedModerationAccepted: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(base, 'admin', 'PUT', {
        capacity: 40,
        quorumPercent: 50,
        electorIds: ['member'],
        moderatorIds: [],
        sharedModerationAccepted: true,
      })
    ).status,
    200,
  );
  await open();
  const attempts = await Promise.all(
    Array.from({ length: 41 }, (_, i) => call(`${base}/join`, `extra${i}`, 'POST', {})),
  );
  assert.equal(attempts.filter((r) => r.status === 200).length, 40);
  assert.equal(attempts.filter((r) => r.status === 409).length, 1);
  const entered = attempts.findIndex((r) => r.status === 200),
    actor = `extra${entered}`;
  assert.equal(
    (await call(`${base}/attendees/${actor}`, 'admin', 'PUT', { excluded: true })).status,
    200,
  );
  assert.equal((await call(`${base}/join`, actor, 'POST', {})).status, 403);
  assert.equal(
    (await call(`${base}/presence`, actor, 'PUT', { connected: true, handRaised: false })).status,
    403,
  );
  assert.equal([...repo.plenaryAttendees.values()].find((a) => a.id === actor).verified, false);
});

test('plenário: bancada exige cargo atual; moderador adicional perde acesso ao sair do grupo', async (t) => {
  const { repo, call, base, id } = await setup(t);
  const groupId = '10000000-0000-4000-8000-000000000001';
  repo.assignments.set('member', {
    office: 'Deputado federal',
    officeState: 'SP',
    functions: ['Líder da bancada da Câmara'],
    functionState: '',
  });
  repo.assignments.set('other', {
    office: 'Deputado federal',
    officeState: 'SP',
    functions: [],
    functionState: '',
  });
  repo.data.meetings.find((m) => m.id === id).groupId = groupId;
  assert.equal((await call(base, 'extra0')).status, 404);
  assert.equal((await call(`${base}/join`, 'extra0', 'POST', {})).status, 404);
  assert.equal(
    (
      await call(base, 'member', 'PUT', {
        capacity: 10,
        quorumPercent: 50,
        electorIds: ['member', 'other'],
        moderatorIds: ['other'],
        sharedModerationAccepted: true,
      })
    ).status,
    200,
  );
  assert.equal((await call(`${base}/open`, 'member', 'POST', {})).status, 200);
  assert.equal((await call(`${base}/join`, 'other', 'POST', {})).status, 200);
  await call(`${base}/presence`, 'other', 'PUT', { connected: true, handRaised: false });
  await call(`${base}/attendees/other`, 'member', 'PUT', { verified: true });
  const created = await call(`${base}/polls`, 'member', 'POST', {
    title: 'Liderança',
    options: ['Sim', 'Não'],
    deadline: new Date(Date.now() + 600000).toISOString(),
    secret: true,
  });
  assert.equal(created.status, 201);
  const pollId = (await created.json()).id;
  assert.equal(
    repo.data.polls.find((p) => p.id === pollId).governance.requiredOffice,
    'Deputado federal',
  );
  repo.assignments.delete('other');
  assert.equal((await call(`${base}/topic`, 'other', 'PUT', { index: 1 })).status, 404);
  assert.equal(
    (await call(`/api/polls/${pollId}/vote`, 'other', 'POST', { option: 0 })).status,
    403,
  );
});

test('PostgreSQL: presença confirmada é persistida, reinício exige reconfirmação e exclusão da reunião faz cascata', async () => {
  const db = newDb();
  for (const file of ['001_initial.sql', '004_meeting_links.sql', '017_plenary.sql']) {
    const sql = await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8');
    db.public.none(file === '017_plenary.sql' ? sql.split('ALTER TABLE')[0] : sql);
  }
  db.public.none('ALTER TABLE anade.meetings ADD COLUMN group_id uuid');
  const { Pool } = db.adapters.createPg(),
    pool = new Pool(),
    repo = new PgRepository(pool),
    store = new PlenaryStore(repo);
  const id = '30000000-0000-4000-8000-000000000001';
  try {
    await repo.account('a', 'mesa');
    await repo.account('b', 'filiado');
    await repo.createMeeting(
      {
        id,
        title: 'Plenário',
        date: new Date().toISOString(),
        location: 'Plenário virtual',
        agenda: [],
      },
      'a',
    );
    await store.save(id, {
      status: 'open',
      electorIds: ['b'],
      moderatorIds: [],
      capacity: 40,
      quorumPercent: 50,
    });
    await store.enter(id, 'b', new Date());
    const summary = (await store.summaries([id])).get(id);
    assert.deepEqual(summary, { sessionStatus: 'open', capacity: 40, electorate: 1 });
    assert.ok(!JSON.stringify(summary).includes('roomKey'));
    await store.updateAttendee(
      id,
      'b',
      { connected: true, verified: true, verifiedBy: 'a' },
      new Date(),
    );
    let rows = await store.attendees(id);
    assert.equal(rows[0].verified, true);
    assert.equal(rows[0].verifiedBy, 'a');
    assert.ok(rows[0].confirmedAt);
    await store.enter(id, 'b', new Date());
    rows = await store.attendees(id);
    assert.equal(rows[0].verified, false);
    assert.ok(rows[0].confirmedAt);
    await assert.rejects(store.enter(id, 'missing', new Date()), /foreign key/i);
    await pool.query('DELETE FROM anade.meetings WHERE id=$1', [id]);
    assert.equal(await store.get(id), null);
    assert.deepEqual(await store.attendees(id), []);
  } finally {
    await pool.end();
  }
});

test('memória: falha de transação reverte composição e presença do plenário', async () => {
  const repo = new MemoryRepository(),
    org = new OrganizationStore(repo),
    store = new PlenaryStore(repo);
  await store.save('meeting', { status: 'draft' });
  await assert.rejects(
    org.atomic(async () => {
      await store.save('meeting', { status: 'open' });
      await store.enter('meeting', 'person', new Date());
      throw new Error('rollback');
    }),
    /rollback/,
  );
  assert.equal((await store.get('meeting')).status, 'draft');
  assert.deepEqual(await store.attendees('meeting'), []);
});
