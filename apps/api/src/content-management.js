import { assert, text } from './domain.js';
import { OrganizationStore, belongs, seesMeeting } from './organization-store.js';
import { CommunityStore } from './community-store.js';
import { isFinance, isLegal, hasFunction } from './assignments.js';
import { legalVisible, walletTotals } from './organization.js';
import { PlenaryStore } from './plenary-store.js';

const uuid = (id) =>
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    'Registro não encontrado.',
    404,
  );
const managed = (user, item, leaderId) =>
  assert(
    user.admin || user.id === item.authorId || user.id === leaderId,
    'Somente a autoria, liderança ou administração pode excluir este registro.',
    403,
  );

export function contentManagementRoutes(app, repo, admin, documentStorage, proofStorage) {
  const store = new OrganizationStore(repo),
    community = new CommunityStore(repo);
  const user = (res) => res.locals.user;
  const cleanup = async (storage, paths) => {
    if (paths.length)
      await storage.remove(paths).catch(() => console.error('CONTENT_STORAGE_CLEANUP_FAILED'));
  };
  const parent = async (s, kind, id, actor, topic = '') => {
    uuid(id);
    if (kind === 'note') {
      const note = await s.get('note', id),
        group = await s.get('group', note.groupId);
      assert(belongs(group, actor), 'Este grupo é restrito aos participantes.', 403);
      return { meetingId: '', noteId: id, topic: '', leaderId: group.leaderId, note };
    }
    const meeting = await repo.meetingRecord(id, s.sql);
    const groups = meeting.groupId ? [await s.get('group', meeting.groupId)] : [];
    assert(seesMeeting(meeting, actor, groups), 'Reunião não encontrada.', 404);
    const clean = text(topic, 500);
    assert(
      meeting.agenda.includes(clean),
      'Esta pauta não faz mais parte da reunião. Atualize a página.',
      404,
    );
    return { meetingId: id, noteId: '', topic: clean, leaderId: '' };
  };
  for (const [kind, route] of [
    ['note', '/api/notes/:id/comments'],
    ['meeting', '/api/meetings/:id/comments'],
  ]) {
    app.get(route, async (req, res) => {
      const page = Number(req.query.page || 0);
      assert(Number.isInteger(page) && page >= 0 && page <= 10000, 'Página inválida.');
      const p = await parent(store, kind, req.params.id, user(res), req.query.topic);
      const records = await store.comments({ ...p, page });
      res.json({ records: records.slice(0, 20), page, hasMore: records.length > 20 });
    });
    app.post(route, async (req, res) => {
      const body = text(req.body.body, 2000);
      const id = await store.atomic(async (s) => {
        const p = await parent(s, kind, req.params.id, user(res), req.query.topic);
        const id = await s.addComment({
          meetingId: p.meetingId,
          noteId: p.noteId,
          topic: p.topic,
          authorId: user(res).id,
          body,
        });
        if (p.note) await s.save('note', p.note, p.note.id);
        return id;
      });
      res.status(201).json({ id });
    });
    app.delete(`${route}/:commentId`, async (req, res) => {
      uuid(req.params.commentId);
      await store.atomic(async (s) => {
        const p = await parent(s, kind, req.params.id, user(res), req.query.topic);
        await s.removeComment(req.params.commentId, p, user(res), p.leaderId);
      });
      res.json({ ok: true });
    });
  }
  app.delete('/api/groups/:groupId/notes/:id', async (req, res) => {
    uuid(req.params.id);
    uuid(req.params.groupId);
    await store.atomic(async (s) => {
      const p = await parent(s, 'note', req.params.id, user(res));
      assert(p.note.groupId === req.params.groupId, 'Registro não encontrado.', 404);
      managed(user(res), p.note, p.leaderId);
      await s.remove('note', p.note.id);
    });
    res.json({ ok: true });
  });
  app.delete('/api/meetings/:id', admin, async (req, res) => {
    uuid(req.params.id);
    await store.atomic(async (s) => {
      const plenary = new PlenaryStore(repo, s.sql);
      assert(
        (await plenary.get(req.params.id))?.status !== 'open',
        'Encerre o plenário antes de excluir a reunião.',
        409,
      );
      assert(
        !(await plenary.polls(req.params.id)).length,
        'Exclua primeiro as votações ao vivo vinculadas a esta reunião.',
        409,
      );
      await repo.removeMeeting(req.params.id, s.sql);
      if (!s.sql) await s.pruneMeetingComments(req.params.id);
    });
    res.json({ ok: true });
  });
  app.delete('/api/meetings/:id/agenda/:index', admin, async (req, res) => {
    uuid(req.params.id);
    const index = Number(req.params.index),
      topic = text(req.query.topic, 500);
    assert(Number.isInteger(index) && index >= 0 && index < 30, 'Pauta inválida.');
    await store.atomic(async (s) => {
      const meeting = await repo.meetingRecord(req.params.id, s.sql);
      assert(
        (await new PlenaryStore(repo, s.sql).get(req.params.id))?.status !== 'open',
        'Encerre o plenário antes de excluir assuntos da reunião.',
        409,
      );
      assert(
        meeting.agenda[index] === topic,
        'A pauta mudou. Atualize a página antes de excluir.',
        409,
      );
      assert(
        meeting.agenda.length > 1,
        'Mantenha ao menos uma pauta. Para remover o encontro inteiro, use Excluir reunião.',
        409,
      );
      const agenda = meeting.agenda.filter((_, i) => i !== index);
      await repo.updateMeetingAgenda(meeting.id, agenda, s.sql);
      await s.pruneMeetingComments(meeting.id, agenda);
    });
    res.json({ ok: true });
  });
  app.delete('/api/polls/:id', admin, async (req, res) => {
    uuid(req.params.id);
    await store.atomic((s) => repo.removePoll(req.params.id, s.sql));
    res.json({ ok: true });
  });
  app.delete('/api/groups/:id', admin, async (req, res) => {
    uuid(req.params.id);
    await store.atomic(async (s) => {
      await s.get('group', req.params.id);
      assert(
        !(await repo.groupHasLinks(req.params.id, s.sql)),
        'Exclua primeiro as reuniões e votações vinculadas a este grupo.',
        409,
      );
      for (const note of (await s.list('note')).filter((n) => n.groupId === req.params.id))
        await s.remove('note', note.id);
      await s.remove('group', req.params.id);
    });
    res.json({ ok: true });
  });
  for (const [kind, path] of [
    ['proposal', 'proposals'],
    ['announcement', 'announcements'],
    ['campaign', 'campaigns'],
    ['comment', 'proposal-comments'],
  ]) {
    app.delete(`/api/${path}/:id`, async (req, res) => {
      uuid(req.params.id);
      await community.atomic(async (s) => {
        const item = await s.get(kind, req.params.id, '', true),
          actor = user(res);
        if (kind === 'announcement')
          assert(
            actor.admin || hasFunction(actor, 'Comunicação'),
            'Exclusão restrita à administração e comunicação.',
            403,
          );
        else
          assert(
            actor.admin || item.ownerId === actor.id,
            'Você só pode excluir seus próprios registros.',
            403,
          );
        if (kind === 'proposal')
          assert(
            !item.pollId || actor.admin,
            'Somente a administração pode excluir propostas encaminhadas à votação.',
            403,
          );
        if (kind === 'campaign')
          assert(actor.admin || (await s.open(true)), 'A Central de campanha está fechada.', 403);
        await s.remove(item.id);
      });
      res.json({ ok: true });
    });
  }
  const finance = (actor) =>
    assert(
      isFinance(actor),
      'Somente a equipe financeira pode excluir registros financeiros.',
      403,
    );
  app.delete('/api/finance/wallets/:id', async (req, res) => {
    uuid(req.params.id);
    finance(user(res));
    await store.atomic(async (s) => {
      finance({ ...user(res), assignment: await repo.memberAssignment(user(res).id, s.sql) });
      await s.get('wallet', req.params.id);
      assert(
        !(await s.list('entry')).some((e) => e.walletId === req.params.id),
        'Exclua primeiro as movimentações deste caixa.',
        409,
      );
      await s.remove('wallet', req.params.id);
    });
    res.json({ ok: true });
  });
  const removeWithFiles = async (s, kind, id) => {
    const files = (await s.list('file')).filter((f) => f.parentKind === kind && f.parentId === id);
    for (const f of files) await s.remove('file', f.id);
    await s.remove(kind, id);
    return files.map((f) => f.path);
  };
  app.delete('/api/finance/entries/:id', async (req, res) => {
    uuid(req.params.id);
    finance(user(res));
    const paths = await store.atomic(async (s) => {
      finance({ ...user(res), assignment: await repo.memberAssignment(user(res).id, s.sql) });
      const item = await s.get('entry', req.params.id),
        entries = (await s.list('entry')).filter((e) => e.walletId === item.walletId);
      assert(
        !entries.some((e) => e.reservationId === item.id),
        'Exclua primeiro as despesas ou liberações vinculadas a esta reserva.',
        409,
      );
      const remaining = walletTotals(entries.filter((e) => e.id !== item.id));
      assert(
        remaining.balance >= 0 &&
          remaining.available >= 0 &&
          remaining.reservations.every((r) => r.remaining >= 0),
        'Esta exclusão deixaria o caixa sem saldo para as despesas ou reservas existentes. Exclua primeiro as movimentações dependentes.',
        409,
      );
      return removeWithFiles(s, 'entry', item.id);
    });
    await cleanup(documentStorage, paths);
    res.json({ ok: true });
  });
  app.delete('/api/legal/:id', async (req, res) => {
    uuid(req.params.id);
    const paths = await store.atomic(async (s) => {
      const actor = { ...user(res), assignment: await repo.memberAssignment(user(res).id, s.sql) };
      assert(isLegal(actor), 'Exclusão restrita à equipe jurídica.', 403);
      const item = await s.get('legal', req.params.id);
      assert(legalVisible(item, actor), 'Registro não encontrado.', 404);
      return removeWithFiles(s, 'legal', item.id);
    });
    await cleanup(documentStorage, paths);
    res.json({ ok: true });
  });
  app.delete('/api/organization/files/:id', async (req, res) => {
    uuid(req.params.id);
    const path = await store.atomic(async (s) => {
      const file = await s.get('file', req.params.id),
        actor = { ...user(res), assignment: await repo.memberAssignment(user(res).id, s.sql) };
      if (file.parentKind === 'legal') {
        assert(isLegal(actor), 'Exclusão restrita à equipe jurídica.', 403);
        assert(
          legalVisible(await s.get('legal', file.parentId), actor),
          'Registro não encontrado.',
          404,
        );
      } else {
        assert(file.parentKind === 'entry', 'Tipo de arquivo inválido.');
        finance(actor);
      }
      await s.remove('file', file.id);
      return file.path;
    });
    await cleanup(documentStorage, [path]);
    res.json({ ok: true });
  });
  app.delete('/api/legado/events/:id', admin, async (req, res) => {
    uuid(req.params.id);
    await store.atomic((s) => s.remove('event', req.params.id));
    res.json({ ok: true });
  });
  app.delete('/api/checkins/:id', admin, async (req, res) => {
    uuid(req.params.id);
    await cleanup(proofStorage, await repo.removeCheckin(req.params.id));
    res.json({ ok: true });
  });
}
