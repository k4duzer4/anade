import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac, randomUUID } from 'node:crypto';
import session from 'express-session';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { MemoryProofStorage, SupabaseProofStorage } from '../src/proof-storage.js';
import { brasiliaDay, checkinFilters } from '../src/checkins.js';

const ids = {
  admin: '111111111111111111',
  member: '222222222222222222',
  other: '333333333333333333',
};
const png = await sharp({ create: { width: 200, height: 140, channels: 3, background: '#09402b' } })
  .png()
  .toBuffer();

test('somente admin exclui ponto e comprovantes; ranking e unicidade refletem a exclusão', async (t) => {
  const { call, storage, repo } = await setup(t);
  const r = await call('/api/checkins', 'member', { body: submission() });
  assert.equal(r.status, 201);
  const id = (await r.json()).record.id;
  assert.equal((await call(`/api/checkins/${id}`, 'member', { method: 'DELETE' })).status, 403);
  assert.equal(
    (
      await call(`/api/checkins/${id}`, 'admin', {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': '' },
      })
    ).status,
    403,
  );
  assert.equal((await call(`/api/checkins/${id}`, 'admin', { method: 'DELETE' })).status, 200);
  assert.equal(repo.checkins.length, 0);
  assert.equal(storage.objects.size, 0);
  assert.equal((await call(`/api/checkins/${id}/proofs/actions`, 'admin')).status, 404);
  const ranking = await (await call('/api/admin/checkins/ranking?period=all', 'admin')).json();
  assert.equal(ranking.records.length, 0);
  assert.equal((await call('/api/checkins', 'member', { body: submission() })).status, 201);
});
async function setup(t, storage = new MemoryProofStorage()) {
  const secret = 'test-only-checkins-session-secret-more-than-32';
  const repo = new MemoryRepository();
  const store = new session.MemoryStore();
  const cookies = {};
  let current = new Date('2026-10-23T02:59:59Z');
  for (const [name, id] of Object.entries(ids)) {
    await repo.account(id, name);
    const sid = `checkin-test-${id}`;
    await new Promise((resolve, reject) =>
      store.set(
        sid,
        {
          cookie: { expires: new Date(Date.now() + 60000) },
          user: { id, member: true, expires: Date.now() + 60000 },
          csrf: 'csrf-checkin',
        },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    cookies[name] = `anade.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
  }
  repo.admins.add(ids.admin);
  await repo.saveProfile(ids.member, {
    name: 'Nome no RPG',
    blue: '@nome.blue',
    legapp: 'PRIVATE-LEGAPP',
  });
  const server = createApp({
    repo,
    store,
    secret,
    env: {},
    proofStorage: storage,
    now: () => current,
    discord: () => {
      throw new Error('Discord não deve ser consultado.');
    },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (path, actor, { body, headers = {}, method = body ? 'POST' : 'GET' } = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        ...(actor ? { Cookie: cookies[actor] } : {}),
        Origin: 'http://localhost:3000',
        'X-CSRF-Token': 'csrf-checkin',
        ...headers,
      },
      ...(body ? { body } : {}),
    });
  return {
    repo,
    storage,
    call,
    setNow: (value) => {
      current = new Date(value);
    },
  };
}
function submission({ actions = png, blue = png, office = '', confirmed = 'true' } = {}) {
  const form = new FormData();
  form.set('office', office);
  form.set('confirmed', confirmed);
  if (actions) form.set('actions', new Blob([actions], { type: 'image/png' }), 'acoes.png');
  if (blue) form.set('blue', new Blob([blue], { type: 'image/png' }), 'blue.png');
  return form;
}
test('ranking é exclusivo de administradores, conta dias, respeita Brasília e compartilha colocações em empate', async (t) => {
  const { call, repo } = await setup(t);
  const add = async (accountId, day) =>
    repo.createCheckin(
      {
        id: randomUUID(),
        accountId,
        day,
        createdAt: `${day}T15:00:00Z`,
        office: '',
        actionsPath: randomUUID(),
        bluePath: randomUUID(),
      },
      async () => {},
    );
  for (const day of ['2026-10-22', '2026-10-21', '2025-09-01']) await add(ids.member, day);
  for (const day of ['2026-10-22', '2026-10-16', '2026-10-01']) await add(ids.other, day);
  assert.equal((await call('/api/admin/checkins/ranking')).status, 401);
  assert.equal((await call('/api/admin/checkins/ranking', 'member')).status, 403);
  const week = await (await call('/api/admin/checkins/ranking?period=7', 'admin')).json();
  assert.equal(week.until, '2026-10-22');
  assert.equal(week.since, '2026-10-16');
  assert.deepEqual(week.summary, { points: 4, participants: 2 });
  assert.deepEqual(
    week.records.map((r) => r.points),
    [2, 2],
  );
  assert.deepEqual(
    week.records.map((r) => r.position),
    [1, 1],
  );
  assert.equal(JSON.stringify(week).includes('PRIVATE-LEGAPP'), false);
  assert.equal(JSON.stringify(week).includes('proofs'), false);
  const month = await (await call('/api/admin/checkins/ranking?period=30', 'admin')).json();
  assert.equal(month.summary.points, 5);
  assert.equal(month.records[0].memberId, ids.other);
  const all = await (await call('/api/admin/checkins/ranking?period=all', 'admin')).json();
  assert.equal(all.summary.points, 6);
  assert.equal(all.since, null);
  for (const query of ['period=8', 'period=7&period=30', 'page=-1', 'page=abc'])
    assert.equal((await call(`/api/admin/checkins/ranking?${query}`, 'admin')).status, 400);
  assert.equal('ranking' in (await (await call('/api/state', 'member')).json()), false);
});
test('ranking pagina sem omitir filiados empatados nem alterar a colocação entre páginas', async (t) => {
  const { call, repo } = await setup(t);
  for (let i = 0; i < 25; i++) {
    const accountId = `ranking-${String(i).padStart(2, '0')}`;
    await repo.account(accountId, accountId);
    await repo.createCheckin(
      {
        id: randomUUID(),
        accountId,
        day: '2026-10-22',
        createdAt: '2026-10-22T15:00:00Z',
        office: '',
        actionsPath: randomUUID(),
        bluePath: randomUUID(),
      },
      async () => {},
    );
  }
  const first = await (await call('/api/admin/checkins/ranking?page=0', 'admin')).json();
  const second = await (await call('/api/admin/checkins/ranking?page=1', 'admin')).json();
  assert.equal(first.records.length, 20);
  assert.equal(second.records.length, 5);
  assert.equal(first.hasMore, true);
  assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.records, ...second.records].map((row) => row.memberId)).size, 25);
  assert.ok([...first.records, ...second.records].every((row) => row.position === 1));
  assert.deepEqual(second.summary, { points: 25, participants: 25 });
});

test('ponto opcional de qualquer filiado: dois prints, privacidade, cargo oficial, CSRF e um registro por dia em Brasília', async (t) => {
  const { call, repo, storage, setNow } = await setup(t);
  assert.equal((await call('/api/checkins')).status, 401);
  assert.equal((await call('/api/admin/checkins', 'member')).status, 403);
  assert.equal(
    (await call('/api/checkins', 'member', { body: submission(), headers: { 'X-CSRF-Token': '' } }))
      .status,
    403,
  );
  assert.equal(
    (
      await call('/api/checkins', 'member', {
        body: submission(),
        headers: { Origin: 'https://evil.test' },
      })
    ).status,
    403,
  );
  const initial = await (await call('/api/checkins', 'member')).json();
  assert.equal(initial.today, '2026-10-22');
  assert.equal(initial.todayRecord, null);
  const response = await call('/api/checkins', 'member', { body: submission() });
  assert.equal(response.status, 201);
  const { record } = await response.json();
  assert.equal(record.memberId, ids.member);
  assert.equal(record.name, 'Nome no RPG');
  assert.equal(record.office, '');
  assert.equal(record.day, '2026-10-22');
  assert.equal(storage.objects.size, 2);
  const own = await (await call('/api/checkins', 'member')).json();
  assert.equal(own.todayRecord.id, record.id);
  assert.equal(
    (await (await call(`/api/checkins?memberId=${ids.member}`, 'other')).json()).records.length,
    0,
  );
  assert.equal((await call(record.proofs.actions)).status, 401);
  assert.equal((await call(record.proofs.actions, 'other')).status, 404);
  const proof = await call(record.proofs.actions, 'member');
  assert.equal(proof.status, 200);
  assert.equal(proof.headers.get('content-type'), 'image/webp');
  assert.equal(proof.headers.get('cache-control'), 'no-store');
  const metadata = await sharp(Buffer.from(await proof.arrayBuffer())).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.exif, undefined);
  assert.equal((await call(record.proofs.blue, 'admin')).status, 200);
  const admin = await (await call('/api/admin/checkins?day=2026-10-22', 'admin')).json();
  assert.equal(admin.records.length, 1);
  assert(!JSON.stringify(admin).includes('PRIVATE-LEGAPP'));
  assert(!JSON.stringify(admin).includes('actions_path'));
  assert.equal((await call('/api/checkins', 'member', { body: submission() })).status, 409);
  assert.equal(storage.objects.size, 2);
  setNow('2026-10-23T03:00:01Z');
  await repo.saveAssignment(
    ids.member,
    { office: 'Senador', officeState: 'SP', functions: [], functionState: '' },
    ids.admin,
  );
  assert.equal((await (await call('/api/checkins', 'member')).json()).todayRecord, null);
  assert.equal(
    (await call('/api/checkins', 'member', { body: submission({ office: 'Senador' }) })).status,
    201,
  );
  assert.equal(
    (await (await call('/api/admin/checkins?office=Senador', 'admin')).json()).records.length,
    1,
  );
  assert.equal(
    (await (await call(`/api/admin/checkins?memberId=${ids.other}`, 'admin')).json()).records
      .length,
    0,
  );
  const withoutProfile = await call('/api/checkins', 'other', { body: submission() });
  assert.equal(withoutProfile.status, 201);
  assert.equal((await withoutProfile.json()).record.name, 'other');
});

test('consulta pagina todos os pontos e mantém filtro de dono em cada página', async (t) => {
  const { call, repo } = await setup(t);
  for (let index = 0; index < 26; index++) {
    const date = new Date(Date.UTC(2026, 8, index + 1, 15));
    repo.checkins.push({
      id: `record-${index}`,
      account_id: index === 25 ? ids.other : ids.member,
      day: brasiliaDay(date),
      created_at: date.toISOString(),
      office: index % 2 ? 'Senador' : '',
      character_name: `Pessoa ${index}`,
      discord_username: 'pessoa',
      blue: '',
      actions_path: 'test/actions.webp',
      blue_path: 'test/blue.webp',
    });
  }
  const first = await (await call('/api/checkins', 'member')).json();
  const second = await (await call('/api/checkins?page=1', 'member')).json();
  assert.equal(first.records.length, 20);
  assert.equal(first.hasMore, true);
  assert.equal(second.records.length, 5);
  assert.equal(second.hasMore, false);
  assert([...first.records, ...second.records].every((record) => record.memberId === ids.member));
  const admin = await (await call('/api/admin/checkins?page=1', 'admin')).json();
  assert.equal(admin.records.length, 6);
  const filtered = await (
    await call(`/api/admin/checkins?memberId=${ids.other}&office=Senador&day=2026-09-26`, 'admin')
  ).json();
  assert.equal(filtered.records.length, 1);
});

test('ponto rejeita ausência de print, imagem forjada, SVG, falta de confirmação e arquivo extra', async (t) => {
  const { call, repo, storage } = await setup(t);
  const invalid = [
    submission({ actions: null }),
    submission({ actions: Buffer.from('not-an-image') }),
    submission({ actions: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') }),
    submission({ confirmed: 'false' }),
  ];
  const extra = submission();
  extra.set('extra', new Blob([png]), 'extra.png');
  invalid.push(extra);
  for (const body of invalid)
    assert.equal((await call('/api/checkins', 'member', { body })).status, 400);
  assert.equal(repo.checkins.length, 0);
  assert.equal(storage.objects.size, 0);
});

test('ponto limita tamanho dos prints antes de decodificar', async (t) => {
  const { call } = await setup(t);
  assert.equal(
    (
      await call('/api/checkins', 'member', {
        body: submission({ actions: Buffer.alloc(2 * 1024 * 1024 + 1) }),
      })
    ).status,
    413,
  );
});

test('dois envios simultâneos produzem um único ponto e apenas dois objetos', async (t) => {
  const { call, repo, storage } = await setup(t);
  const responses = await Promise.all([
    call('/api/checkins', 'member', { body: submission() }),
    call('/api/checkins', 'member', { body: submission() }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(repo.checkins.length, 1);
  assert.equal(storage.objects.size, 2);
});

test('falha no Storage não grava ponto incompleto e remove o outro print já enviado', async (t) => {
  const storage = new MemoryProofStorage();
  const put = storage.put.bind(storage);
  storage.put = async (path, buffer) => {
    if (path.endsWith('/blue.webp'))
      throw Object.assign(new Error('Falha de teste.'), { status: 503 });
    await put(path, buffer);
  };
  const { call, repo } = await setup(t, storage);
  assert.equal((await call('/api/checkins', 'member', { body: submission() })).status, 503);
  assert.equal(repo.checkins.length, 0);
  assert.equal(storage.objects.size, 0);
});

test('ausência de Storage desabilita somente o envio; consultas e portal continuam disponíveis', async (t) => {
  const { call } = await setup(t, new SupabaseProofStorage({}));
  assert.equal((await (await call('/api/checkins', 'member')).json()).storageReady, false);
  assert.equal((await call('/api/checkins', 'member', { body: submission() })).status, 503);
  assert.equal((await call('/api/state', 'member')).status, 200);
});

test('calendário do ponto usa Brasília e rejeita datas/páginas inválidas', () => {
  assert.equal(brasiliaDay(new Date('2026-10-23T02:59:59Z')), '2026-10-22');
  assert.equal(brasiliaDay(new Date('2026-10-23T03:00:00Z')), '2026-10-23');
  for (const query of [
    { day: '2026-02-30' },
    { day: 'invalid' },
    { page: -1 },
    { page: '1.5' },
    { day: ['2026-10-22'] },
  ])
    assert.throws(() => checkinFilters(query));
});

test('Storage recusa bucket público e nunca tenta enviar comprovantes nele', async () => {
  const calls = [];
  const storage = new SupabaseProofStorage(
    { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key' },
    async (url) => {
      calls.push(url);
      return Response.json({ public: true });
    },
  );
  await assert.rejects(storage.put('test/actions.webp', png), /privado/);
  assert.equal(calls.length, 1);
});

test('Storage prepara bucket privado sob demanda sem tornar objetos públicos', async () => {
  const calls = [];
  const storage = new SupabaseProofStorage(
    { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key' },
    async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1)
        return Response.json({ message: 'Bucket not found' }, { status: 400 });
      if (url.endsWith('/bucket') && options.method === 'POST')
        return Response.json({ name: 'anade-checkins' });
      if (url.endsWith('/bucket/anade-checkins')) return Response.json({ public: false });
      return Response.json({ ok: true });
    },
  );
  await storage.put('test/actions.webp', png);
  assert.equal(JSON.parse(calls[1].options.body).public, false);
  assert.equal(JSON.parse(calls[1].options.body).file_size_limit, 1024 * 1024);
  assert.equal(calls[3].options.headers['x-upsert'], 'false');
});

test('Storage aceita a Secret key atual no header apikey sem tentar usá-la como JWT', async () => {
  const calls = [];
  const storage = new SupabaseProofStorage(
    {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test-only-fixture',
    },
    async (_url, options) => {
      calls.push(options);
      return Response.json({ public: false });
    },
  );
  await storage.put('test/actions.webp', png);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.apikey, 'sb_secret_test-only-fixture');
  assert.equal(calls[1].headers.Authorization, undefined);
});
