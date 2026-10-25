import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import session from 'express-session';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { OrganizationStore } from '../src/organization-store.js';
import { MemoryProofStorage } from '../src/proof-storage.js';
import { legadoCalendar, publicSeason } from '../src/legado-calendar.js';
import { pollOutcome } from '../src/governance.js';

const chamber = '10000000-0000-4000-8000-000000000001',
  legalGroup = '10000000-0000-4000-8000-000000000004';

test('contadores e prévias não revelam grupos, documentos sigilosos, caixas privados ou campanha fechada', async (t) => {
  const { call, repo, group } = await setup(t);
  await group(['deputy']);
  const store = new OrganizationStore(repo);
  await store.save('note', {
    groupId: chamber,
    title: 'Pauta parlamentar sigilosa',
    body: 'Restrito',
    status: 'pendente',
    mentionIds: [],
    assignedId: '',
  });
  await store.save('legal', {
    title: 'Processo reservado',
    visibility: 'restricted',
    memberIds: ['lawyer'],
    status: 'aberto',
  });
  await call('/api/meetings', 'admin', 'POST', {
    title: 'Reunião reservada',
    date: new Date(Date.now() + 3600000).toISOString(),
    agenda: ['Pauta'],
    groupId: chamber,
  });
  const other = await (await call('/api/activity', 'other')).json();
  assert.equal(other.sections[`/grupos/${chamber}`], undefined);
  assert.equal(other.sections['/financeiro'], undefined);
  assert.equal(other.sections['/juridico'], undefined);
  assert.equal(other.sections['/campanha'], undefined);
  assert.ok(!JSON.stringify(other).includes('sigilosa'));
  assert.ok(!JSON.stringify(other).includes('Processo reservado'));
  assert.ok(!JSON.stringify(other).includes('Reunião reservada'));
  const deputy = await (await call('/api/activity', 'deputy')).json();
  assert.ok(deputy.sections[`/grupos/${chamber}`].unseen >= 2);
  assert.equal(deputy.sections['/financeiro'].total, 2);
  const lawyer = await (await call('/api/activity', 'lawyer')).json();
  assert.equal(lawyer.sections['/juridico'].latest[0].title, 'Processo reservado');
  // Recibos forjados de um conteúdo privado não concedem leitura nem gravam chaves.
  const keys = deputy.sections[`/grupos/${chamber}`].keys;
  const response = await call('/api/activity/seen', 'other', 'PUT', {
    path: `/grupos/${chamber}`,
    keys,
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).keys, []);
  assert.equal(repo.activitySeen.get('other')?.size || 0, 0);
});
async function setup(t) {
  const repo = new MemoryRepository(),
    store = new session.MemoryStore(),
    secret = 'organization-secret-more-than-thirty-two-characters',
    cookies = {};
  for (const id of ['admin', 'deputy', 'other', 'lawyer']) {
    await repo.account(id, id);
    await repo.saveProfile(id, { name: id, blue: `@${id}`, state: 'SP' });
    const sid = `organization-${id}`;
    await new Promise((ok, fail) =>
      store.set(
        sid,
        {
          cookie: { expires: new Date(Date.now() + 120000) },
          user: { id, member: true, expires: Date.now() + 120000 },
          csrf: 'csrf',
        },
        (e) => (e ? fail(e) : ok()),
      ),
    );
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    cookies[id] = `anade.sid=${encodeURIComponent(`s:${sid}.${signature}`)}`;
  }
  repo.admins.add('admin');
  await repo.saveAssignment(
    'admin',
    { office: '', officeState: '', functions: ['Jurídico', 'Financeiro'], functionState: '' },
    'admin',
  );
  await repo.saveAssignment(
    'deputy',
    { office: '', officeState: '', functions: ['Financeiro'], functionState: '' },
    'admin',
  );
  await repo.saveAssignment(
    'lawyer',
    { office: '', officeState: '', functions: ['Jurídico'], functionState: '' },
    'admin',
  );
  const proof = new MemoryProofStorage();
  const server = createApp({
    repo,
    store,
    secret,
    env: {},
    organizationStorage: proof,
    seasonRequest: async () => new Response('', { status: 302, headers: { location: '/' } }),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((ok) => server.close(ok)));
  const call = (path, id = 'admin', method = 'GET', body, csrf = 'csrf') =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        ...(id ? { Cookie: cookies[id] } : {}),
        Origin: 'http://localhost:3000',
        'X-CSRF-Token': csrf,
        ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  const group = async (memberIds = ['deputy'], id = chamber, type = 'camara') => {
    if (type === 'camara')
      for (const accountId of ['deputy', 'other'])
        await repo.saveAssignment(
          accountId,
          {
            ...(await repo.memberAssignment(accountId)),
            office: memberIds.includes(accountId) ? 'Deputado federal' : '',
          },
          'admin',
        );
    return call(`/api/groups/${id}`, 'admin', 'PUT', {
      name: type === 'camara' ? 'Câmara' : 'Jurídico',
      type,
      description: 'Equipe de teste',
      memberIds,
      leaderId: memberIds[0] || '',
    });
  };
  return { repo, call, group, proof };
}
test('grupos: somente admin define participantes; notas, menções e reuniões não vazam pela API ou busca', async (t) => {
  const { call, group } = await setup(t);
  assert.equal((await call('/api/groups', null)).status, 401);
  assert.equal((await call('/api/groups', 'deputy', 'POST', { name: 'autopromocao' })).status, 403);
  assert.equal((await call('/api/groups', 'admin', 'POST', {}, '')).status, 403);
  assert.equal((await group()).status, 200);
  assert.equal((await call(`/api/groups/${chamber}/notes`, 'other')).status, 403);
  const response = await call(`/api/groups/${chamber}/notes`, 'deputy', 'POST', {
    title: 'Pauta confidencial',
    type: 'orientacao',
    body: 'Voto da bancada',
    assignedId: 'deputy',
    mentionIds: ['deputy'],
    dueDate: '2026-01-01',
  });
  assert.equal(response.status, 201);
  assert.equal((await call(`/api/groups/${chamber}/notes`, 'deputy')).status, 200);
  const meeting = {
    title: 'Reunião confidencial',
    groupId: chamber,
    date: new Date(Date.now() + 3600000).toISOString(),
    agenda: ['Pauta'],
    meetUrl: 'https://meet.google.com/abc-defg-hij',
    docsUrl: '',
  };
  assert.equal((await call('/api/meetings', 'admin', 'POST', meeting)).status, 201);
  const state = await (await call('/api/state', 'other')).json();
  assert.equal(state.meetings.length, 0);
  const search = await (await call('/api/search?q=confidencial', 'other')).json();
  assert.equal(search.results.length, 0);
  const mid = (await (await call('/api/state', 'deputy')).json()).meetings[0].id;
  assert.equal(
    (await call(`/api/meetings/${mid}/attendance`, 'other', 'POST', { confirm: true })).status,
    404,
  );
  let notifications = await (await call('/api/notifications', 'deputy')).json();
  assert.ok(notifications.records.some((n) => n.type === 'mencao'));
  assert.ok(notifications.records.some((n) => n.title.startsWith('Reunião:')));
  const key = notifications.records[0].key;
  await call('/api/notifications/read', 'deputy', 'PUT', { keys: [key] });
  notifications = await (await call('/api/notifications', 'deputy')).json();
  assert.ok(notifications.records.find((n) => n.key === key).read);
  assert.equal(
    (await call('/api/notifications/read', 'other', 'PUT', { keys: [key] })).status,
    400,
  );
  await group([]);
  assert.equal((await (await call('/api/notifications', 'deputy')).json()).records.length, 0);
});
test('votações: eleitores congelados, abertura, quórum, sigilo e regras; admin não vota fora da lista', async (t) => {
  const { call, group, repo } = await setup(t);
  await group();
  const input = {
    title: 'Liderança da Câmara',
    options: ['Ana', 'Bruno'],
    description: 'Eleição',
    deadline: new Date(Date.now() + 3600000).toISOString(),
    secret: true,
    groupId: chamber,
    electorIds: ['deputy'],
    quorumPercent: 100,
    approvalRule: 'absolute',
  };
  assert.equal(
    (await call('/api/polls', 'admin', 'POST', { ...input, electorIds: ['other'] })).status,
    400,
  );
  assert.equal((await call('/api/polls', 'admin', 'POST', input)).status, 201);
  const poll = repo.data.polls[0];
  assert.equal(
    (await call(`/api/polls/${poll.id}/vote`, 'admin', 'POST', { option: 0 })).status,
    403,
  );
  assert.equal((await (await call('/api/state', 'other')).json()).polls.length, 0);
  await group(['deputy', 'other']);
  assert.equal(
    (await call(`/api/polls/${poll.id}/vote`, 'other', 'POST', { option: 0 })).status,
    403,
  );
  assert.equal(
    (await call(`/api/polls/${poll.id}/vote`, 'deputy', 'POST', { option: 0 })).status,
    200,
  );
  const secret = (await (await call('/api/state', 'other')).json()).polls[0];
  assert.equal(secret.counts, undefined);
  assert.equal(secret.ballots, undefined);
  assert.equal(secret.canVote, false);
  assert.equal(
    (await call(`/api/polls/${poll.id}/vote`, 'deputy', 'POST', { option: 1 })).status,
    409,
  );
  await call(`/api/polls/${poll.id}/close`, 'admin', 'POST', {});
  const closed = (await (await call('/api/state', 'deputy')).json()).polls[0];
  assert.equal(closed.outcome.winner, 0);
  assert.equal(closed.outcome.quorum, 1);
  assert.equal(
    (
      await call('/api/polls', 'admin', 'POST', {
        ...input,
        opensAt: new Date(Date.now() + 600000).toISOString(),
      })
    ).status,
    201,
  );
  assert.equal(
    (await call(`/api/polls/${repo.data.polls[1].id}/vote`, 'deputy', 'POST', { option: 0 }))
      .status,
    409,
  );
});
test('apuração diferencia abstenção, empate, quórum, maioria absoluta e dois terços do eleitorado', () => {
  const p = {
    options: ['A', 'B', 'Abstenção'],
    governance: { electorIds: ['a', 'b', 'c', 'd', 'e'], quorumPercent: 60, rule: 'absolute' },
  };
  assert.equal(pollOutcome(p, [2, 0, 1]).winner, null);
  assert.equal(pollOutcome(p, [3, 0, 0]).winner, 0);
  p.governance.rule = 'two_thirds';
  assert.equal(pollOutcome(p, [3, 0, 0]).winner, null);
  assert.equal(pollOutcome(p, [4, 0, 0]).winner, 0);
  p.governance.rule = 'plurality';
  assert.equal(pollOutcome(p, [2, 2, 1]).reason, 'Sem vencedor único');
  assert.equal(pollOutcome(p, [2, 0, 0]).reason, 'Quórum não atingido');
});
test('financeiro: caixa privado, centavos, reservas, liberação e gastos concorrentes não deixam saldo negativo', async (t) => {
  const { call } = await setup(t);
  const { id: walletId } = await (
    await call('/api/finance/wallets', 'admin', 'POST', {
      name: 'Campanha SP',
      type: 'campanha',
      memberIds: ['deputy'],
    })
  ).json();
  assert.equal((await (await call('/api/finance', 'other')).json()).wallets.length, 0);
  const entry = (type, amountCents, extra = {}) => ({
    walletId,
    title: 'Lançamento',
    type,
    amountCents,
    date: '2026-10-24',
    ...extra,
  });
  assert.equal(
    (await call('/api/finance/entries', 'other', 'POST', entry('receita', 10000))).status,
    403,
  );
  assert.equal(
    (await call('/api/finance/entries', 'deputy', 'POST', entry('receita', 0.5))).status,
    400,
  );
  await call('/api/finance/entries', 'deputy', 'POST', entry('receita', 10000));
  const { id: reservationId } = await (
    await call('/api/finance/entries', 'deputy', 'POST', entry('reserva', 6000))
  ).json();
  assert.equal(
    (await call('/api/finance/entries', 'deputy', 'POST', entry('despesa', 5000))).status,
    409,
  );
  await call('/api/finance/entries', 'deputy', 'POST', entry('despesa', 2000, { reservationId }));
  await call('/api/finance/entries', 'deputy', 'POST', entry('liberacao', 4000, { reservationId }));
  assert.equal(
    (await call('/api/finance/entries', 'deputy', 'POST', entry('liberacao', 1, { reservationId })))
      .status,
    409,
  );
  const results = await Promise.all([
    call('/api/finance/entries', 'deputy', 'POST', entry('despesa', 7000)),
    call('/api/finance/entries', 'deputy', 'POST', entry('despesa', 7000)),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const w = (await (await call('/api/finance', 'deputy')).json()).wallets.find(
    (w) => w.id === walletId,
  );
  assert.equal(w.balance, 1000);
  assert.equal(w.available, 1000);
  assert.equal(w.reserved, 0);
  assert.equal(
    (await call('/api/finance/wallets', 'other', 'POST', { name: 'forged' })).status,
    403,
  );
});
test('jurídico: sigilo por função, publicação aos filiados e documentos revalidam visibilidade', async (t) => {
  const { call, repo, proof } = await setup(t);
  assert.equal((await call('/api/legal', 'deputy', 'POST', { title: 'forjado' })).status, 403);
  const input = {
    title: 'Processo',
    type: 'processo',
    visibility: 'legal_team',
    memberIds: [],
    assignedId: 'lawyer',
  };
  const created = await call('/api/legal', 'lawyer', 'POST', input);
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal((await (await call('/api/legal', 'other')).json()).records.length, 0);
  const fd = new FormData();
  fd.set('file', new Blob(['%PDF-1.7\nTeste'], { type: 'application/pdf' }), 'intimacao.pdf');
  fd.set('memberIds', '["lawyer"]');
  assert.equal(
    (await call(`/api/organization/legal/${id}/files`, 'lawyer', 'POST', fd)).status,
    201,
  );
  const files = await (await call(`/api/organization/legal/${id}/files`, 'lawyer')).json();
  assert.equal(files.records.length, 1);
  assert.equal(files.records[0].path, undefined);
  assert.equal((await call(files.records[0].url, 'other')).status, 404);
  assert.equal(
    (await call(`/api/legal/${id}`, 'lawyer', 'PUT', { ...input, visibility: 'members' })).status,
    200,
  );
  assert.equal((await (await call('/api/legal', 'other')).json()).records.length, 1);
  assert.equal(
    (await call(`/api/legal/${id}`, 'other', 'PUT', { ...input, visibility: 'members' })).status,
    403,
  );
  assert.equal((await call(files.records[0].url, 'other')).status, 404);
  await repo.saveAssignment(
    'lawyer',
    { office: '', officeState: '', functions: [], functionState: '' },
    'admin',
  );
  assert.equal((await call(`/api/legal/${id}`, 'lawyer', 'PUT', input)).status, 403);
  assert.equal(
    (await call(`/api/legal/${id}`, 'admin', 'PUT', { ...input, assignedId: '' })).status,
    200,
  );
  assert.equal((await call(files.records[0].url, 'lawyer')).status, 404);
  assert.equal(proof.objects.size, 1);
});

test('documentos: revogação durante o upload impede publicação e remove o objeto pendente', async (t) => {
  const { call, group, proof, repo } = await setup(t);
  await group(['lawyer'], legalGroup, 'juridico');
  const { id } = await (
    await call('/api/legal', 'admin', 'POST', {
      title: 'Contrato',
      type: 'contrato',
      visibility: 'restricted',
      memberIds: ['lawyer', 'admin'],
      assignedId: 'lawyer',
    })
  ).json();
  const put = proof.put.bind(proof);
  proof.put = async (...args) => {
    await put(...args);
    repo.organization.records.get(id).memberIds = ['deputy'];
  };
  const fd = new FormData();
  fd.set('file', new Blob(['%PDF-1.7\nTeste'], { type: 'application/pdf' }), 'contrato.pdf');
  fd.set('memberIds', '["lawyer"]');
  assert.equal(
    (await call(`/api/organization/legal/${id}/files`, 'lawyer', 'POST', fd)).status,
    404,
  );
  assert.equal(proof.objects.size, 0);
  assert.equal([...repo.organization.records.values()].filter((r) => r.kind === 'file').length, 0);
});
test('atribuições oficiais: só ADM altera, ficha não promove, cargos controlam bancadas e funções controlam equipes', async (t) => {
  const { call, repo } = await setup(t);
  const roles = {
    office: 'Deputado federal',
    officeState: 'SP',
    functions: ['Líder da bancada da Câmara'],
    functionState: '',
  };
  assert.equal((await call('/api/admin/assignments/other', 'other', 'PUT', roles)).status, 403);
  assert.equal(
    (
      await call('/api/profile', 'other', 'PUT', {
        name: 'Other',
        age: 35,
        state: 'SP',
        ideology: 'Centro',
        season: '1',
        degrees: [],
        office: 'Deputado federal',
        functions: ['Jurídico', 'Financeiro'],
      })
    ).status,
    200,
  );
  let member = (await (await call('/api/state', 'other')).json()).members.find(
    (m) => m.id === 'other',
  );
  assert.equal(member.office, '');
  assert.deepEqual(member.functions, []);
  assert.equal((await call('/api/admin/assignments/other', 'admin', 'PUT', roles)).status, 200);
  member = (await (await call('/api/state', 'other')).json()).members.find((m) => m.id === 'other');
  assert.equal(member.office, 'Deputado federal');
  assert.deepEqual(member.functions, roles.functions);
  const groups = (await (await call('/api/groups', 'other')).json()).records;
  assert.ok(groups.find((g) => g.id === chamber).memberIds.includes('other'));
  assert.equal(groups.find((g) => g.id === chamber).leaderId, 'other');
  const poll = {
    title: 'Liderança',
    options: ['A', 'B'],
    deadline: new Date(Date.now() + 3600000).toISOString(),
    groupId: chamber,
    electorIds: ['other'],
    secret: true,
  };
  assert.equal((await call('/api/polls', 'admin', 'POST', poll)).status, 201);
  const id = repo.data.polls.at(-1).id;
  assert.equal(
    (
      await call('/api/admin/assignments/other', 'admin', 'PUT', {
        office: 'Senador',
        officeState: 'SP',
        functions: [],
        functionState: '',
      })
    ).status,
    200,
  );
  assert.equal((await call(`/api/polls/${id}/vote`, 'other', 'POST', { option: 0 })).status, 403);
  assert.ok(repo.assignmentHistory.some((h) => h.accountId === 'other' && h.actorId === 'admin'));
  await repo.saveAssignment(
    'admin',
    { office: '', officeState: '', functions: [], functionState: '' },
    'admin',
  );
  assert.equal(
    (await call('/api/legal', 'admin', 'POST', { title: 'Não permitido', type: 'processo' }))
      .status,
    403,
  );
  assert.equal(
    (
      await call('/api/finance/entries', 'admin', 'POST', {
        walletId: '20000000-0000-4000-8000-000000000001',
      })
    ).status,
    403,
  );
  const privateCase = await call('/api/legal', 'lawyer', 'POST', {
    title: 'Reservado ao jurídico',
    type: 'processo',
    visibility: 'legal_team',
    memberIds: [],
  });
  assert.equal(privateCase.status, 201);
  assert.equal((await (await call('/api/legal', 'admin')).json()).records.length, 0);
});
test('calendário usa Brasília e tick das 8h; importação que exige login não sobrescreve a temporada', async (t) => {
  const before = legadoCalendar(
    { startDate: '2026-10-01', duration: 90 },
    new Date('2026-10-08T10:59:59Z'),
  );
  const after = legadoCalendar(
    { startDate: '2026-10-01', duration: 90 },
    new Date('2026-10-08T11:00:00Z'),
  );
  assert.equal(before.day, 7);
  assert.equal(after.day, 8);
  assert.equal(after.nextTick, '2026-10-09T11:00:00.000Z');
  assert.ok(
    after.milestones.some(
      (x) => x.title.startsWith('1º turno') && x.date === '2026-10-08T13:00:00.000Z',
    ),
  );
  assert.equal(legadoCalendar().day, null);
  assert.equal(await publicSeason(async () => new Response('', { status: 302 })), null);
  const { call } = await setup(t);
  assert.equal(
    (await call('/api/legado/calendar', 'other', 'PUT', { startDate: '2026-10-01' })).status,
    403,
  );
  await call('/api/legado/calendar', 'admin', 'PUT', { startDate: '2026-10-01', duration: 90 });
  assert.equal((await call('/api/legado/calendar/import', 'admin', 'POST', {})).status, 422);
  assert.equal((await (await call('/api/legado/calendar')).json()).config.startDate, '2026-10-01');
});
