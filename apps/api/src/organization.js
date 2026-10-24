import { randomUUID } from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { assert, text, states } from './domain.js';
import { OrganizationStore, belongs, seesMeeting, seesPoll } from './organization-store.js';
import { legadoCalendar, publicSeason } from './legado-calendar.js';

const groupTypes = [
  'camara',
  'senado',
  'direcao',
  'estadual',
  'juridico',
  'comunicacao',
  'tesouraria',
  'outro',
];
const noteTypes = ['prioridade', 'pauta', 'negociacao', 'orientacao', 'tarefa', 'aviso'];
const enumOf = (value, options) => {
  assert(options.includes(value), 'Escolha uma opção válida.');
  return value;
};
const day = (value, required = false) => {
  const s = text(value ?? '', 10, required);
  assert(
    !s ||
      (/^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(`${s}T12:00Z`)) &&
        new Date(`${s}T12:00Z`).toISOString().slice(0, 10) === s),
    'Informe uma data válida.',
  );
  return s;
};
const instant = (value) => {
  assert(Number.isFinite(Date.parse(value)), 'Informe data e horário válidos.');
  return new Date(value).toISOString();
};
const ids = (value, available) => {
  assert(
    Array.isArray(value) &&
      value.length <= 5000 &&
      new Set(value).size === value.length &&
      value.every((id) => available.includes(id)),
    'Escolha participantes cadastrados e autorizados.',
  );
  return [...value];
};
const money = (value) => {
  const n = Number(value);
  assert(
    Number.isSafeInteger(n) && n > 0 && n <= 100000000000,
    'Informe um valor positivo de até um bilhão, em centavos.',
  );
  return n;
};
const page = (records, query) => {
  const p = Number(query.page || 0);
  assert(Number.isInteger(p) && p >= 0 && p <= 10000, 'Página inválida.');
  return {
    records: records.slice(p * 20, p * 20 + 20),
    page: p,
    hasMore: records.length > (p + 1) * 20,
    total: records.length,
  };
};
const author = (res) => res.locals.user;
const permitted = (record, user) => user.admin || record.memberIds.includes(user.id);
export function walletTotals(entries) {
  const balance = entries.reduce(
    (a, e) =>
      a + (e.type === 'receita' ? e.amountCents : e.type === 'despesa' ? -e.amountCents : 0),
    0,
  );
  const reservations = entries
    .filter((e) => e.type === 'reserva')
    .map((e) => ({
      ...e,
      remaining:
        e.amountCents -
        entries.filter((x) => x.reservationId === e.id).reduce((a, x) => a + x.amountCents, 0),
    }));
  const reserved = reservations.reduce((a, r) => a + r.remaining, 0);
  return { balance, reserved, available: balance - reserved, reservations };
}
export function organizationRoutes(app, repo, admin, storage, { seasonRequest = fetch } = {}) {
  const store = new OrganizationStore(repo);
  const memberIds = async () => (await repo.snapshot()).members.map((x) => x.id);
  const group = async (s, id, user) => {
    const g = await s.get('group', id);
    assert(belongs(g, user), 'Este grupo é restrito aos participantes.', 403);
    return g;
  };
  const legalTeam = async (user, s = store) =>
    user.admin ||
    (await s.list('group')).some((g) => g.type === 'juridico' && g.memberIds.includes(user.id));
  const caseAccess = async (s, id, user, edit = false) => {
    const item = await s.get('legal', id);
    assert(permitted(item, user), 'Caso não encontrado.', 404);
    if (edit) assert(await legalTeam(user, s), 'A edição é restrita à equipe jurídica.', 403);
    return item;
  };
  const notify = async (s, targets, title, href, resourceKind, resourceId, type = 'atribuicao') => {
    for (const targetId of new Set(targets))
      await s.save('notification', { targetId, title, href, resourceKind, resourceId, type });
  };
  app.get('/api/groups', async (_req, res) => {
    const user = author(res);
    res.json({
      records: (await store.list('group')).map((g) => ({ ...g, canAccess: belongs(g, user) })),
    });
  });
  const saveGroup = async (req, res) => {
    const user = author(res);
    const available = await memberIds();
    const type = enumOf(req.body.type, groupTypes),
      members = ids(req.body.memberIds, available);
    const leaderId = text(req.body.leaderId ?? '', 30, false);
    assert(!leaderId || members.includes(leaderId), 'A liderança deve participar do grupo.');
    const state = type === 'estadual' ? enumOf(req.body.state, states) : '';
    const data = {
      name: text(req.body.name, 120),
      description: text(req.body.description ?? '', 2000, false),
      type,
      state,
      memberIds: members,
      leaderId,
    };
    const id = await store.atomic(async (s) => {
      const previous = req.params.id ? await s.get('group', req.params.id) : null;
      const id = await s.save('group', data, previous?.id);
      await notify(
        s,
        members.filter((x) => !previous?.memberIds.includes(x)),
        `Você participa de ${data.name}.`,
        `/grupos?grupo=${id}`,
        'group',
        id,
      );
      return id;
    });
    res.status(req.params.id ? 200 : 201).json({ id });
  };
  app.post('/api/groups', admin, saveGroup);
  app.put('/api/groups/:id', admin, saveGroup);
  app.get('/api/groups/:id/notes', async (req, res) => {
    await group(store, req.params.id, author(res));
    res.json(
      page(
        (await store.list('note')).filter((x) => x.groupId === req.params.id),
        req.query,
      ),
    );
  });
  const saveNote = async (req, res) => {
    const user = author(res);
    const id = await store.atomic(async (s) => {
      const g = await group(s, req.params.groupId, user);
      const previous = req.params.id ? await s.get('note', req.params.id) : null;
      assert(!previous || previous.groupId === g.id, 'Registro não encontrado.', 404);
      assert(
        !previous || user.admin || g.leaderId === user.id || previous.authorId === user.id,
        'Somente a autoria ou liderança pode editar.',
        403,
      );
      const mentions = ids(req.body.mentionIds ?? [], g.memberIds);
      const assignedId = text(req.body.assignedId ?? '', 30, false);
      assert(
        !assignedId || g.memberIds.includes(assignedId),
        'O responsável deve participar do grupo.',
      );
      const item = {
        groupId: g.id,
        title: text(req.body.title, 200),
        body: text(req.body.body ?? '', 6000, false),
        type: enumOf(req.body.type, noteTypes),
        status: enumOf(req.body.status || 'aberto', ['aberto', 'concluido']),
        dueDate: day(req.body.dueDate),
        assignedId,
        mentionIds: mentions,
        authorId: previous?.authorId || user.id,
      };
      const id = await s.save('note', item, previous?.id);
      if (assignedId && assignedId !== previous?.assignedId)
        await notify(
          s,
          [assignedId],
          `Atribuição: ${item.title}`,
          `/grupos?grupo=${g.id}`,
          'note',
          id,
        );
      await notify(
        s,
        mentions.filter((x) => !previous?.mentionIds.includes(x)),
        `Você foi mencionado: ${item.title}`,
        `/grupos?grupo=${g.id}`,
        'note',
        id,
        'mencao',
      );
      return id;
    });
    res.status(req.params.id ? 200 : 201).json({ id });
  };
  app.post('/api/groups/:groupId/notes', saveNote);
  app.put('/api/groups/:groupId/notes/:id', saveNote);
  app.get('/api/finance', async (req, res) => {
    const user = author(res),
      wallets = (await store.list('wallet')).filter((w) => permitted(w, user));
    const entries = await store.list('entry');
    res.json({
      wallets: wallets.map((w) => ({
        ...w,
        ...walletTotals(entries.filter((e) => e.walletId === w.id)),
      })),
      ...page(
        entries.filter(
          (e) =>
            wallets.some((w) => w.id === e.walletId) &&
            (!req.query.wallet || e.walletId === req.query.wallet),
        ),
        req.query,
      ),
    });
  });
  const saveWallet = async (req, res) => {
    const data = {
      name: text(req.body.name, 120),
      type: enumOf(req.body.type, ['partidario', 'fundo', 'campanha']),
      memberIds: ids(req.body.memberIds, await memberIds()),
    };
    const id = await store.atomic(async (s) => {
      if (req.params.id) await s.get('wallet', req.params.id);
      return s.save('wallet', data, req.params.id);
    });
    res.status(req.params.id ? 200 : 201).json({ id });
  };
  app.post('/api/finance/wallets', admin, saveWallet);
  app.put('/api/finance/wallets/:id', admin, saveWallet);
  app.post('/api/finance/entries', async (req, res) => {
    const user = author(res);
    const id = await store.atomic(async (s) => {
      const w = await s.get('wallet', req.body.walletId);
      assert(permitted(w, user), 'Caixa não encontrado.', 404);
      const type = enumOf(req.body.type, ['receita', 'despesa', 'reserva', 'liberacao']);
      const amountCents = money(req.body.amountCents),
        entries = (await s.list('entry')).filter((e) => e.walletId === w.id),
        totals = walletTotals(entries);
      const reservationId = text(req.body.reservationId ?? '', 36, false);
      if (type === 'liberacao' || reservationId) {
        assert(
          ['liberacao', 'despesa'].includes(type),
          'Somente despesa ou liberação usa reserva.',
        );
        const r = totals.reservations.find((e) => e.id === reservationId);
        assert(r && r.remaining >= amountCents, 'Reserva insuficiente ou inválida.', 409);
      } else if (type !== 'receita')
        assert(totals.available >= amountCents, 'Saldo disponível insuficiente.', 409);
      const item = {
        walletId: w.id,
        type,
        amountCents,
        reservationId,
        date: day(req.body.date, true),
        title: text(req.body.title, 200),
        recipient: text(req.body.recipient ?? '', 200, false),
        body: text(req.body.body ?? '', 2000, false),
        authorId: user.id,
      };
      return s.save('entry', item);
    });
    res.status(201).json({ id });
  });
  app.get('/api/legal', async (req, res) => {
    const user = author(res);
    res.json({
      ...page(
        (await store.list('legal')).filter((x) => permitted(x, user)),
        req.query,
      ),
      canCreate: await legalTeam(user),
    });
  });
  const saveLegal = async (req, res) => {
    const user = author(res),
      available = await memberIds();
    assert(await legalTeam(user), 'Somente a equipe jurídica pode registrar casos.', 403);
    const id = await store.atomic(async (s) => {
      assert(await legalTeam(user, s), 'Somente a equipe jurídica pode registrar casos.', 403);
      const previous = req.params.id ? await caseAccess(s, req.params.id, user, true) : null;
      const members = ids(req.body.memberIds, available),
        assignedId = text(req.body.assignedId ?? '', 30, false);
      assert(!assignedId || members.includes(assignedId), 'O responsável deve ter acesso ao caso.');
      assert(user.admin || members.includes(user.id), 'Mantenha seu próprio acesso ao caso.');
      const start = day(req.body.start),
        end = day(req.body.end);
      assert(!start || !end || end >= start, 'Vigência final anterior ao início.');
      const amountCents = Number(req.body.amountCents || 0);
      assert(
        Number.isSafeInteger(amountCents) && amountCents >= 0 && amountCents <= 100000000000,
        'Valor inválido.',
      );
      const item = {
        title: text(req.body.title, 200),
        body: text(req.body.body ?? '', 6000, false),
        type: enumOf(req.body.type, ['contrato', 'servico', 'processo', 'intimacao']),
        status: enumOf(req.body.status || 'aberto', ['aberto', 'em_andamento', 'concluido']),
        reference: text(req.body.reference ?? '', 120, false),
        provider: text(req.body.provider ?? '', 200, false),
        start,
        end,
        dueDate: day(req.body.dueDate),
        paymentStatus: enumOf(req.body.paymentStatus || 'nao_aplicavel', [
          'nao_aplicavel',
          'pendente',
          'pago',
        ]),
        amountCents,
        assignedId,
        memberIds: members,
        authorId: previous?.authorId || user.id,
      };
      const id = await s.save('legal', item, previous?.id);
      if (assignedId && assignedId !== previous?.assignedId)
        await notify(
          s,
          [assignedId],
          `Responsabilidade jurídica: ${item.title}`,
          '/juridico',
          'legal',
          id,
        );
      return id;
    });
    res.status(req.params.id ? 200 : 201).json({ id });
  };
  app.post('/api/legal', saveLegal);
  app.put('/api/legal/:id', saveLegal);
  app.get('/api/legado/calendar', async (_req, res) =>
    res.json({ ...legadoCalendar(await store.setting()), events: await store.list('event') }),
  );
  app.put('/api/legado/calendar', admin, async (req, res) => {
    const duration = Number(req.body.duration || 90);
    assert(
      Number.isInteger(duration) && duration >= 1 && duration <= 365,
      'Duração entre 1 e 365 dias.',
    );
    await store.setCalendar({
      startDate: day(req.body.startDate, true),
      duration,
      updatedBy: author(res).id,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  });
  app.post('/api/legado/calendar/import', admin, async (_req, res) => {
    const start = await publicSeason(seasonRequest).catch(() => null);
    assert(
      start,
      'A página da temporada exige login ou não publica a data de início em formato importável. Confirme a data no Legado e informe-a na configuração.',
      422,
    );
    await store.setCalendar({
      startDate: day(start, true),
      duration: 90,
      updatedBy: author(res).id,
      updatedAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  });
  const saveEvent = async (req, res) => {
    const previous = req.params.id ? await store.get('event', req.params.id) : null;
    const item = {
      title: text(req.body.title, 200),
      body: text(req.body.body ?? '', 2000, false),
      date: instant(req.body.date),
      type: enumOf(req.body.type, ['campanha', 'eleicao', 'posse', 'efeito', 'prazo', 'outro']),
      status: enumOf(req.body.status || 'pendente', ['pendente', 'concluido']),
      authorId: author(res).id,
    };
    const id = await store.save('event', item, previous?.id);
    res.status(previous ? 200 : 201).json({ id });
  };
  app.post('/api/legado/events', admin, saveEvent);
  app.put('/api/legado/events/:id', admin, saveEvent);
  async function fileParent(s, kind, id, user, edit = false) {
    if (kind === 'legal') return caseAccess(s, id, user, edit);
    assert(kind === 'entry', 'Tipo de anexo inválido.');
    const entry = await s.get('entry', id),
      wallet = await s.get('wallet', entry.walletId);
    assert(permitted(wallet, user), 'Registro não encontrado.', 404);
    return wallet;
  }
  app.get('/api/organization/:kind/:id/files', async (req, res) => {
    const user = author(res);
    await fileParent(store, req.params.kind, req.params.id, user);
    const records = (await store.list('file'))
      .filter(
        (f) =>
          f.parentKind === req.params.kind &&
          f.parentId === req.params.id &&
          (user.admin || f.memberIds.includes(user.id)),
      )
      .map(({ path, ...f }) => ({ ...f, url: `/api/organization/files/${f.id}` }));
    res.json({ records });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
  }).single('file');
  app.post(
    '/api/organization/:kind/:id/files',
    async (req, res, next) => {
      await fileParent(store, req.params.kind, req.params.id, author(res), true);
      assert(storage.configured, 'Armazenamento indisponível.', 503);
      upload(req, res, (e) =>
        next(
          e
            ? Object.assign(new Error('Envie um arquivo PDF, JPG, PNG ou WebP de até 4 MB.'), {
                status: 400,
              })
            : undefined,
        ),
      );
    },
    async (req, res) => {
      assert(req.file, 'Escolha um arquivo.');
      let buffer = req.file.buffer,
        mime = 'application/pdf';
      if (buffer.subarray(0, 5).toString() !== '%PDF-') {
        try {
          const image = sharp(buffer, { limitInputPixels: 24000000, failOn: 'error' });
          const metadata = await image.metadata();
          assert(
            ['png', 'jpeg', 'webp'].includes(metadata.format) &&
              (!metadata.pages || metadata.pages === 1),
            'Imagem inválida.',
          );
          buffer = await image
            .rotate()
            .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
          mime = 'image/webp';
        } catch {
          assert(false, 'Arquivo inválido. Use PDF ou imagem estática.');
        }
      }
      assert(buffer.length <= 4 * 1024 * 1024, 'Arquivo excede 4 MB.', 413);
      const id = randomUUID(),
        path = `${req.params.kind}/${req.params.id}/${id}${mime === 'application/pdf' ? '.pdf' : '.webp'}`;
      let saved = false;
      try {
        saved = true;
        await storage.put(path, buffer, mime);
        await store.atomic(async (s) => {
          const parent = await fileParent(s, req.params.kind, req.params.id, author(res), true);
          let selection = parent.memberIds;
          if (req.body.memberIds) {
            try {
              selection = JSON.parse(req.body.memberIds);
            } catch {
              assert(false, 'Seleção de participantes inválida.');
            }
          }
          const memberIds = ids(selection, parent.memberIds);
          assert(
            (await s.list('file')).filter((f) => f.parentId === req.params.id).length < 20,
            'Limite de 20 anexos por registro.',
          );
          await s.save(
            'file',
            {
              parentKind: req.params.kind,
              parentId: req.params.id,
              memberIds,
              name: text(req.file.originalname.replace(/[\r\n"\\/]/g, '_'), 150),
              mime,
              path,
              authorId: author(res).id,
            },
            id,
          );
        });
      } catch (e) {
        if (saved) await storage.remove([path]).catch(() => {});
        throw e;
      }
      res.status(201).json({ id });
    },
  );
  app.get('/api/organization/files/:id', async (req, res) => {
    const file = await store.get('file', req.params.id),
      user = author(res);
    await fileParent(store, file.parentKind, file.parentId, user);
    assert(user.admin || file.memberIds.includes(user.id), 'Arquivo não encontrado.', 404);
    res
      .type(file.mime)
      .set(
        'Content-Disposition',
        `attachment; filename="documento${file.mime === 'application/pdf' ? '.pdf' : '.webp'}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      )
      .send(await storage.get(file.path));
  });
  async function notifications(user) {
    const groups = await store.list('group');
    const notes = await store.list('note'),
      legal = await store.list('legal');
    const visible = async (n) => {
      if (n.resourceKind === 'group')
        return groups.some((g) => g.id === n.resourceId && belongs(g, user));
      if (n.resourceKind === 'note') {
        const item = notes.find((x) => x.id === n.resourceId);
        return item && groups.some((g) => g.id === item.groupId && belongs(g, user));
      }
      return legal.some((x) => x.id === n.resourceId && permitted(x, user));
    };
    const records = [];
    for (const n of await store.list('notification'))
      if (n.targetId === user.id && (await visible(n))) records.push({ ...n, key: n.id });
    const snapshot = await repo.snapshot(),
      now = Date.now(),
      end = now + 86400000;
    const due = (key, title, date, href) => {
      if (Date.parse(date) <= end)
        records.push({ key, title, date, href, type: 'prazo', createdAt: date });
    };
    for (const m of snapshot.meetings)
      if (seesMeeting(m, user, groups) && Date.parse(m.date) > now && Date.parse(m.date) <= end)
        due(`meeting:${m.id}:${m.date}`, `Reunião: ${m.title}`, m.date, `/agenda?encontro=${m.id}`);
    for (const p of snapshot.polls)
      if (
        seesPoll(p, user, groups) &&
        !p.closed &&
        Date.parse(p.deadline) > now &&
        (!p.governance || p.governance.electorIds.includes(user.id))
      )
        due(
          `poll:${p.id}:${p.deadline}`,
          `Votação encerra: ${p.title}`,
          p.deadline,
          `/votacoes?votacao=${p.id}`,
        );
    for (const n of notes)
      if (
        n.status !== 'concluido' &&
        n.dueDate &&
        (n.assignedId === user.id || n.mentionIds.includes(user.id)) &&
        groups.some((g) => g.id === n.groupId && belongs(g, user))
      )
        due(
          `note:${n.id}:${n.dueDate}`,
          `Prazo: ${n.title}`,
          `${n.dueDate}T21:00:00-03:00`,
          `/grupos?grupo=${n.groupId}`,
        );
    for (const item of legal)
      if (item.status !== 'concluido' && item.dueDate && permitted(item, user))
        due(
          `legal:${item.id}:${item.dueDate}`,
          `Prazo jurídico: ${item.title}`,
          `${item.dueDate}T21:00:00-03:00`,
          '/juridico',
        );
    for (const item of legal)
      if (item.status !== 'concluido' && item.end && permitted(item, user))
        due(
          `legal-end:${item.id}:${item.end}`,
          `Fim da vigência: ${item.title}`,
          `${item.end}T21:00:00-03:00`,
          '/juridico',
        );
    for (const item of await store.list('event'))
      if (item.status !== 'concluido')
        due(`event:${item.id}:${item.date}`, `Calendário: ${item.title}`, item.date, '/calendario');
    const read = await store.readKeys(user.id);
    return records
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((n) => ({ ...n, read: read.includes(n.key) }));
  }
  app.get('/api/notifications', async (req, res) => {
    const records = await notifications(author(res));
    res.json({ ...page(records, req.query), unread: records.filter((n) => !n.read).length });
  });
  app.put('/api/notifications/read', async (req, res) => {
    const user = author(res),
      visible = await notifications(user),
      keys = req.body.keys;
    assert(
      Array.isArray(keys) &&
        keys.length <= 100 &&
        keys.every((k) => visible.some((n) => n.key === k)),
      'Notificação inválida.',
    );
    for (const key of keys) await store.markRead(user.id, key);
    res.json({ ok: true });
  });
}
