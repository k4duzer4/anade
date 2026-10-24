import { assert, text, states } from './domain.js';
import { electoralOffices } from './checkins.js';
import { CommunityStore } from './community-store.js';
import { OrganizationStore, seesMeeting, seesPoll } from './organization-store.js';
import { votingRules } from './governance.js';
import { hasFunction } from './assignments.js';

const validId = (id) =>
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    'Registro não encontrado.',
    404,
  );
const date = (value, required = false) => {
  const day = text(value ?? '', 10, required);
  assert(
    !day ||
      (/^\d{4}-\d{2}-\d{2}$/.test(day) &&
        !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) &&
        new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day),
    'Informe uma data válida.',
  );
  return day;
};
const pageOf = (query) => {
  const page = Number(query.page ?? 0);
  assert(Number.isInteger(page) && page >= 0 && page <= 10000, 'Página inválida.');
  return page;
};
const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
function link(value) {
  const clean = text(value, 2048);
  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    assert(false, 'Informe um link HTTPS válido.');
  }
  assert(
    parsed.protocol === 'https:' && !parsed.username && !parsed.password,
    'Use um link HTTPS sem credenciais.',
  );
  return parsed.toString();
}
function details(kind, input) {
  if (kind === 'proposal') return { title: text(input.title, 200), body: text(input.body, 6000) };
  if (kind === 'announcement')
    return {
      title: text(input.title, 200),
      body: text(input.body, 6000),
      pinned: input.pinned === true,
      dueDate: date(input.dueDate),
    };
  if (kind === 'timeline') {
    const type = text(input.type, 30);
    assert(
      ['cargo', 'candidatura', 'mandato', 'contribuicao'].includes(type),
      'Escolha o tipo de registro.',
    );
    const start = date(input.start, true),
      end = date(input.end);
    assert(!end || end >= start, 'O término deve ser posterior ao início.');
    return {
      title: text(input.title, 160),
      body: text(input.body ?? '', 2000, false),
      type,
      start,
      end,
    };
  }
  assert(electoralOffices.includes(input.office), 'Escolha um cargo válido.');
  assert(states.includes(input.state), 'Escolha um estado do Legado.');
  assert(
    Array.isArray(input.materials) && input.materials.length <= 10,
    'Inclua até dez links de materiais.',
  );
  return {
    office: input.office,
    state: input.state,
    title: text(input.title, 200),
    body: text(input.body, 6000),
    commitments: text(input.commitments ?? '', 4000, false),
    materials: input.materials.map(link),
  };
}
export function communityRoutes(app, repo, admin) {
  const store = new CommunityStore(repo);
  const actor = (res) => res.locals.user;
  const list = async (kind, req, res, extra = {}) => {
    const page = pageOf(req.query);
    const id = req.query.id;
    if (id) validId(id);
    const records = await store.list(kind, {
      page,
      viewer: actor(res).id,
      ...(id ? { id } : {}),
      ...extra,
    });
    res.json({ records: records.slice(0, 20), hasMore: records.length > 20, page });
  };
  const own = (item, res) =>
    assert(item.ownerId === actor(res).id, 'Você só pode alterar seus próprios registros.', 403);
  app.get('/api/proposals', (req, res) => list('proposal', req, res));
  app.post('/api/proposals', async (req, res) => {
    const id = await store.save('proposal', actor(res).id, details('proposal', req.body));
    res.status(201).json({ id });
  });
  app.get('/api/proposals/:id', async (req, res) => {
    validId(req.params.id);
    res.json(await store.get('proposal', req.params.id, actor(res).id));
  });
  app.put('/api/proposals/:id', async (req, res) => {
    validId(req.params.id);
    const data = details('proposal', req.body);
    await store.atomic(async (s) => {
      const item = await s.get('proposal', req.params.id, '', true);
      own(item, res);
      assert(!item.pollId, 'Proposta encaminhada não pode ser alterada.', 409);
      await s.save('proposal', item.ownerId, data, { id: item.id });
    });
    res.json({ ok: true });
  });
  app.put('/api/proposals/:id/support', async (req, res) => {
    validId(req.params.id);
    assert(typeof req.body.enabled === 'boolean', 'Apoio inválido.');
    await store.atomic(async (s) => {
      await s.get('proposal', req.params.id, '', true);
      await s.action(req.params.id, actor(res).id, 'support', req.body.enabled);
    });
    res.json({ ok: true });
  });
  app.get('/api/proposals/:id/comments', async (req, res) => {
    validId(req.params.id);
    await store.get('proposal', req.params.id);
    await list('comment', req, res, { parentId: req.params.id });
  });
  app.post('/api/proposals/:id/comments', async (req, res) => {
    validId(req.params.id);
    const body = text(req.body.body, 2000);
    await store.atomic(async (s) => {
      await s.get('proposal', req.params.id, '', true);
      await s.save('comment', actor(res).id, { body }, { parentId: req.params.id });
    });
    res.status(201).json({ ok: true });
  });
  app.post('/api/proposals/:id/poll', admin, async (req, res) => {
    validId(req.params.id);
    const organization = new OrganizationStore(repo);
    const group = req.body.groupId ? await organization.get('group', req.body.groupId) : null;
    const available = (await repo.snapshot()).members
      .map((m) => m.id)
      .filter((id) => !group || group.memberIds.includes(id));
    const governance = votingRules(req.body, available, group);
    const id = await store.forward(req.params.id, req.body, actor(res).id, governance);
    res.status(201).json({ id });
  });
  app.get('/api/announcements', (req, res) => list('announcement', req, res));
  const communications = (req, res, next) => {
    assert(
      actor(res).admin || hasFunction(actor(res), 'Comunicação'),
      'Somente a administração e a comunicação podem publicar avisos.',
      403,
    );
    next();
  };
  app.post('/api/announcements', communications, async (req, res) => {
    const id = await store.save('announcement', actor(res).id, details('announcement', req.body));
    res.status(201).json({ id });
  });
  app.put('/api/announcements/:id', communications, async (req, res) => {
    validId(req.params.id);
    const data = details('announcement', req.body);
    await store.atomic(async (s) => {
      const item = await s.get('announcement', req.params.id, '', true);
      if (item.title !== data.title || item.body !== data.body || item.dueDate !== data.dueDate)
        await s.resetReads(item.id);
      await s.save('announcement', item.ownerId, data, { id: item.id });
    });
    res.json({ ok: true });
  });
  app.put('/api/announcements/:id/read', async (req, res) => {
    validId(req.params.id);
    await store.atomic(async (s) => {
      await s.get('announcement', req.params.id, '', true);
      await s.action(req.params.id, actor(res).id, 'read');
    });
    res.json({ ok: true });
  });
  app.get('/api/campaigns', async (req, res) => {
    const open = await store.open();
    const page = pageOf(req.query);
    const id = req.query.id;
    if (id) validId(id);
    const records =
      open || actor(res).admin
        ? await store.list('campaign', { page, viewer: actor(res).id, ...(id ? { id } : {}) })
        : [];
    const mine =
      open || actor(res).admin
        ? (await store.list('campaign', { ownerId: actor(res).id, limit: 1 }))[0] || null
        : null;
    res.json({ open, mine, records: records.slice(0, 20), hasMore: records.length > 20, page });
  });
  app.put('/api/admin/campaigns/status', admin, async (req, res) => {
    assert(typeof req.body.open === 'boolean', 'Estado inválido.');
    await store.atomic(async (s) => {
      await s.open(true);
      await s.setOpen(req.body.open);
    });
    res.json({ ok: true });
  });
  app.post('/api/campaigns', async (req, res) => {
    const data = details('campaign', req.body);
    const id = await store.atomic(async (s) => {
      assert(await s.open(true), 'A Central de campanha está fechada.', 403);
      return s.save('campaign', actor(res).id, data);
    });
    res.status(201).json({ id });
  });
  app.put('/api/campaigns/:id', async (req, res) => {
    validId(req.params.id);
    const data = details('campaign', req.body);
    await store.atomic(async (s) => {
      assert(await s.open(true), 'A Central de campanha está fechada.', 403);
      const item = await s.get('campaign', req.params.id, '', true);
      own(item, res);
      await s.save('campaign', item.ownerId, data, { id: item.id });
    });
    res.json({ ok: true });
  });
  app.get('/api/members/:id/timeline', async (req, res) => {
    text(req.params.id, 100);
    await list('timeline', req, res, { ownerId: req.params.id });
  });
  app.post('/api/profile/timeline', async (req, res) => {
    const id = await store.save('timeline', actor(res).id, details('timeline', req.body));
    res.status(201).json({ id });
  });
  app.put('/api/profile/timeline/:id', async (req, res) => {
    validId(req.params.id);
    const data = details('timeline', req.body);
    await store.atomic(async (s) => {
      const item = await s.get('timeline', req.params.id, '', true);
      own(item, res);
      await s.save('timeline', item.ownerId, data, { id: item.id });
    });
    res.json({ ok: true });
  });
  app.delete('/api/profile/timeline/:id', async (req, res) => {
    validId(req.params.id);
    await store.atomic(async (s) => {
      const item = await s.get('timeline', req.params.id, '', true);
      own(item, res);
      await s.remove(item.id);
    });
    res.json({ ok: true });
  });
  app.get('/api/search', async (req, res) => {
    const q = normalize(text(req.query.q, 100));
    assert(q.length >= 2, 'Digite pelo menos dois caracteres.');
    const snapshot = await repo.snapshot();
    const groups = await new OrganizationStore(repo).list('group');
    const results = [];
    const add = (type, id, title, body, href) => {
      if (normalize(`${title} ${body}`).includes(q))
        results.push({ type, id, title, excerpt: String(body).slice(0, 160), href });
    };
    snapshot.members.forEach((m) =>
      add(
        'Filiado',
        m.id,
        m.name,
        [m.blue, m.city, m.state, m.office, m.ideology].filter(Boolean).join(' · '),
        `/filiados/${encodeURIComponent(m.id)}`,
      ),
    );
    snapshot.meetings
      .filter((m) => seesMeeting(m, actor(res), groups))
      .forEach((m) => {
        add(
          'Reunião',
          m.id,
          m.title,
          [...m.agenda, m.location].join(' · '),
          `/agenda?encontro=${m.id}#encontro-${m.id}`,
        );
        if (m.docsUrl || m.minutes)
          add(
            'Documento',
            `ata-${m.id}`,
            `Ata · ${m.title}`,
            m.minutes || 'Ata da reunião no Google Docs',
            m.docsUrl || `/agenda?encontro=${m.id}#encontro-${m.id}`,
          );
      });
    snapshot.polls
      .filter((p) => seesPoll(p, actor(res), groups))
      .forEach((p) =>
        add('Votação', p.id, p.title, p.description, `/votacoes?votacao=${p.id}#votacao-${p.id}`),
      );
    const kinds = ['proposal', 'announcement'];
    if (actor(res).admin || (await store.open())) kinds.push('campaign');
    const entries = await store.search(q, kinds);
    entries.forEach((item) => {
      const type =
        item.kind === 'proposal'
          ? 'Proposta'
          : item.kind === 'announcement'
            ? 'Comunicado'
            : 'Pré-candidatura';
      results.push({
        type,
        id: item.id,
        title: item.title,
        excerpt: String(item.body).slice(0, 160),
        href: `/${item.kind === 'proposal' ? 'propostas' : item.kind === 'announcement' ? 'comunicados' : 'campanha'}?registro=${item.id}#registro-${item.id}`,
      });
    });
    res.json({ results: results.slice(0, 60), limited: results.length > 60 });
  });
}
