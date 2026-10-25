import { randomUUID } from 'node:crypto';
import { assert, newPoll, presentPoll } from './domain.js';
import { OrganizationStore, seesMeeting } from './organization-store.js';
import { hasFunction } from './assignments.js';
import { votingRules } from './governance.js';
import { PlenaryStore, PRESENCE_TTL } from './plenary-store.js';
import { kmeetProvider, kmeetAdmission } from './kmeet.js';

const uuid = (id) =>
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
    'Plenário não encontrado.',
    404,
  );
const isActive = (a, now) =>
  !a.excluded && !a.leftAt && Date.parse(a.lastSeenAt) > now.getTime() - PRESENCE_TTL;
export function plenaryRoutes(app, repo, { env = {}, now = () => new Date() } = {}) {
  const organization = new OrganizationStore(repo),
    store = new PlenaryStore(repo);
  const access = async (s, id, user) => {
    uuid(id);
    const meeting = await repo.meetingRecord(id, s.sql),
      group = meeting.groupId ? await s.get('group', meeting.groupId) : null;
    assert(
      meeting.location === 'Plenário virtual',
      'Esta reunião não utiliza o plenário virtual.',
      404,
    );
    assert(seesMeeting(meeting, user, group ? [group] : []), 'Plenário não encontrado.', 404);
    const members = await s.assignmentMembers(),
      available = members.filter((m) => !group || group.memberIds.includes(m.id)).map((m) => m.id);
    const live = { ...user, assignment: await repo.memberAssignment(user.id, s.sql) };
    const canManage =
      user.admin ||
      group?.leaderId === user.id ||
      (!group &&
        (hasFunction(live, 'Presidente nacional') || hasFunction(live, 'Secretário-geral')));
    const p = await new PlenaryStore(repo, s.sql).get(id);
    return {
      meeting,
      group,
      available,
      canManage,
      p,
      canModerate:
        canManage || (available.includes(user.id) && !!p?.moderatorIds.includes(user.id)),
    };
  };
  const inRoom = (ctx, actor) =>
    assert(
      actor.admin || ctx.available.includes(actor.id),
      'Você não participa do grupo desta reunião.',
      403,
    );
  app.get('/api/plenaries', async (_req, res) => {
    const actor = res.locals.user,
      groups = await organization.list('group'),
      snapshot = await repo.snapshot({ metadataOnly: true });
    const meetings = snapshot.meetings.filter(
      (m) => m.location === 'Plenário virtual' && seesMeeting(m, actor, groups),
    );
    res.json({
      provider: kmeetProvider(env),
      records: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.date,
        location: m.location,
        groupId: m.groupId,
        agenda: m.agenda,
      })),
    });
  });
  app.get('/api/plenaries/:id', async (req, res) => {
    const actor = res.locals.user,
      ctx = await access(organization, req.params.id, actor),
      p = ctx.p;
    const at = now(),
      rows = p ? await store.attendees(req.params.id) : [];
    const records = rows.map((a) => ({
      ...a,
      active: p.status === 'open' && isActive(a, at) && a.connected && ctx.available.includes(a.id),
    }));
    const present = records.filter(
        (a) => a.active && a.verified && p.electorIds.includes(a.id),
      ).length,
      quorum = p ? Math.ceil((p.electorIds.length * p.quorumPercent) / 100) : 0;
    const { roomKey: _roomKey, ...publicSession } = p || {};
    const session = publicSession;
    const polls = p ? await store.polls(req.params.id) : [];
    res.json({
      meeting: ctx.meeting,
      session: p ? session : null,
      provider: kmeetProvider(env),
      canManage: ctx.canManage,
      canModerate: ctx.canModerate,
      availableIds: ctx.available,
      attendees: records.map((a) => ({ ...a, lastSeenAt: a.lastSeenAt })),
      present,
      quorum,
      quorumReached: !!p && present >= quorum && quorum > 0,
      polls: polls.map((poll) => {
        const result = presentPoll(
          p.status === 'closed' ? { ...poll, closed: true } : poll,
          actor.id,
        );
        result.canVote =
          result.canVote &&
          p.status === 'open' &&
          !!records.find((a) => a.id === actor.id && a.active && a.verified);
        return result;
      }),
      serverTime: at.toISOString(),
    });
  });
  app.put('/api/plenaries/:id', async (req, res) => {
    await organization.atomic(async (s) => {
      const actor = res.locals.user,
        ctx = await access(s, req.params.id, actor),
        p = ctx.p;
      assert(ctx.canManage, 'Somente a presidência da reunião pode configurar o plenário.', 403);
      assert(
        !p || p.status === 'draft',
        'A composição e as regras ficam fixadas depois da abertura.',
        409,
      );
      const capacity = Number(req.body.capacity),
        quorumPercent = Number(req.body.quorumPercent),
        provider = kmeetProvider(env);
      assert(
        req.body.sharedModerationAccepted === true,
        'Confirme a ciência da moderação compartilhada no áudio gratuito do kMeet.',
      );
      assert(
        Number.isInteger(capacity) && capacity >= 10 && capacity <= provider.maxCapacity,
        `Capacidade entre 10 e ${provider.maxCapacity} participantes.`,
      );
      assert(
        Number.isInteger(quorumPercent) && quorumPercent >= 1 && quorumPercent <= 100,
        'Quórum entre 1 e 100%.',
      );
      const validate = (ids) =>
        assert(
          Array.isArray(ids) &&
            ids.length <= 5000 &&
            new Set(ids).size === ids.length &&
            ids.every((id) => ctx.available.includes(id)),
          'Selecione participantes autorizados desta reunião.',
        );
      validate(req.body.electorIds);
      validate(req.body.moderatorIds);
      assert(req.body.electorIds.length, 'Selecione ao menos um integrante para o quórum.');
      await new PlenaryStore(repo, s.sql).save(req.params.id, {
        ...p,
        roomKey: p?.roomKey || randomUUID(),
        status: 'draft',
        capacity,
        quorumPercent,
        electorIds: req.body.electorIds,
        moderatorIds: req.body.moderatorIds,
        activeTopic: 0,
        createdBy: actor.id,
        groupId: ctx.meeting.groupId || '',
        sharedModerationAccepted: true,
      });
    });
    res.json({ ok: true });
  });
  app.post('/api/plenaries/:id/open', async (req, res) => {
    await organization.atomic(async (s) => {
      const ctx = await access(s, req.params.id, res.locals.user);
      assert(ctx.canManage, 'A abertura é restrita à presidência da reunião.', 403);
      assert(kmeetProvider(env).configured, 'O áudio kMeet está temporariamente desativado.', 503);
      assert(ctx.p?.status === 'draft', 'Prepare as regras do plenário antes da abertura.', 409);
      assert(
        ctx.p.electorIds.every((id) => ctx.available.includes(id)),
        'A composição do grupo mudou. Revise os participantes antes de abrir.',
        409,
      );
      await new PlenaryStore(repo, s.sql).save(req.params.id, {
        ...ctx.p,
        status: 'open',
        openedAt: now().toISOString(),
      });
    });
    res.json({ ok: true });
  });
  app.post('/api/plenaries/:id/join', async (req, res) => {
    const admission = await organization.atomic(async (s) => {
      const actor = res.locals.user,
        ctx = await access(s, req.params.id, actor),
        ps = new PlenaryStore(repo, s.sql),
        at = now();
      inRoom(ctx, actor);
      assert(
        ctx.p?.status === 'open',
        'O plenário ainda não está aberto ou já foi encerrado.',
        409,
      );
      const attendees = await ps.attendees(req.params.id),
        mine = attendees.find((a) => a.id === actor.id);
      assert(!mine?.excluded, 'Sua entrada foi suspensa pela moderação.', 403);
      assert(
        !mine || !isActive(mine, at),
        'Você já está entrando ou conectado. Saia da outra aba ou aguarde até 90 segundos.',
        409,
      );
      assert(
        attendees.filter((a) => isActive(a, at)).length < ctx.p.capacity,
        'O plenário atingiu sua capacidade. Aguarde uma vaga.',
        409,
      );
      const profile = repo.pool
        ? (
            await s.sql.query(
              "SELECT data->>'name' AS name FROM anade.profiles WHERE account_id=$1",
              [actor.id],
            )
          ).rows[0]
        : repo.data.members.find((m) => m.id === actor.id);
      const admission = kmeetAdmission(
        ctx.p,
        {
          name: profile?.name || actor.discord || 'Filiado ANADE',
          canModerate: ctx.canModerate,
        },
        env,
      );
      await ps.enter(req.params.id, actor.id, at);
      return admission;
    });
    res.json(admission);
  });
  app.put('/api/plenaries/:id/presence', async (req, res) => {
    await organization.atomic(async (s) => {
      const actor = res.locals.user,
        ctx = await access(s, req.params.id, actor),
        ps = new PlenaryStore(repo, s.sql),
        at = now();
      inRoom(ctx, actor);
      assert(ctx.p?.status === 'open', 'O plenário foi encerrado.', 409);
      const mine = (await ps.attendees(req.params.id)).find((a) => a.id === actor.id);
      assert(mine && isActive(mine, at), 'Sua entrada precisa ser autorizada novamente.', 403);
      assert(
        typeof req.body.connected === 'boolean' && typeof req.body.handRaised === 'boolean',
        'Presença inválida.',
      );
      await ps.updateAttendee(
        req.params.id,
        actor.id,
        { connected: req.body.connected, handRaised: req.body.handRaised },
        at,
      );
    });
    res.json({ ok: true });
  });
  app.post('/api/plenaries/:id/leave', async (req, res) => {
    await organization.atomic(async (s) => {
      await access(s, req.params.id, res.locals.user);
      const ps = new PlenaryStore(repo, s.sql);
      if ((await ps.attendees(req.params.id)).some((a) => a.id === res.locals.user.id))
        await ps.updateAttendee(
          req.params.id,
          res.locals.user.id,
          { connected: false, handRaised: false, left: true },
          now(),
        );
    });
    res.json({ ok: true });
  });
  app.put('/api/plenaries/:id/topic', async (req, res) => {
    await organization.atomic(async (s) => {
      const ctx = await access(s, req.params.id, res.locals.user);
      assert(ctx.canModerate, 'Controle restrito à mesa do plenário.', 403);
      assert(ctx.p?.status === 'open', 'O plenário não está aberto.', 409);
      assert(
        Number.isInteger(req.body.index) &&
          req.body.index >= 0 &&
          req.body.index < ctx.meeting.agenda.length,
        'Escolha uma pauta válida.',
      );
      await new PlenaryStore(repo, s.sql).save(req.params.id, {
        ...ctx.p,
        activeTopic: req.body.index,
      });
    });
    res.json({ ok: true });
  });
  app.put('/api/plenaries/:id/attendees/:accountId', async (req, res) => {
    await organization.atomic(async (s) => {
      const ctx = await access(s, req.params.id, res.locals.user);
      assert(ctx.canModerate, 'A confirmação de presença é restrita à mesa.', 403);
      assert(ctx.p?.status === 'open', 'O plenário não está aberto.', 409);
      const ps = new PlenaryStore(repo, s.sql);
      if (typeof req.body.verified === 'boolean') {
        const item = (await ps.attendees(req.params.id)).find((a) => a.id === req.params.accountId);
        assert(
          item?.connected && isActive(item, now()) && ctx.available.includes(item.id),
          'O participante precisa estar conectado e autorizado.',
          409,
        );
        await ps.updateAttendee(
          req.params.id,
          req.params.accountId,
          { verified: req.body.verified, verifiedBy: res.locals.user.id },
          now(),
        );
        return;
      }
      assert(ctx.canManage, 'Somente a presidência pode suspender entradas.', 403);
      assert(
        req.params.accountId !== res.locals.user.id,
        'Você não pode suspender sua própria entrada.',
      );
      assert(typeof req.body.excluded === 'boolean', 'Situação inválida.');
      await ps.updateAttendee(
        req.params.id,
        req.params.accountId,
        {
          excluded: req.body.excluded,
          ...(req.body.excluded
            ? { connected: false, handRaised: false, verified: false, left: true }
            : {}),
        },
        now(),
      );
    });
    res.json({ ok: true });
  });
  app.post('/api/plenaries/:id/polls', async (req, res) => {
    const id = await organization.atomic(async (s) => {
      const actor = res.locals.user,
        ctx = await access(s, req.params.id, actor),
        ps = new PlenaryStore(repo, s.sql),
        at = now();
      assert(ctx.canModerate, 'Somente a mesa pode abrir votações ao vivo.', 403);
      assert(ctx.p?.status === 'open', 'O plenário não está aberto.', 409);
      const present = (await ps.attendees(req.params.id)).filter(
        (a) =>
          isActive(a, at) &&
          a.connected &&
          a.verified &&
          ctx.p.electorIds.includes(a.id) &&
          ctx.available.includes(a.id),
      );
      assert(
        present.length >= Math.ceil((ctx.p.electorIds.length * ctx.p.quorumPercent) / 100),
        'O plenário ainda não atingiu o quórum para abrir votação.',
        409,
      );
      assert(
        (await ps.polls(req.params.id)).length < 50,
        'Limite de 50 votações por reunião.',
        409,
      );
      const p = newPoll(req.body, actor.id);
      assert(
        Date.parse(p.deadline) <= at.getTime() + 24 * 3600000,
        'A votação ao vivo deve encerrar em até 24 horas.',
      );
      p.governance = {
        ...votingRules(
          { ...req.body, electorIds: ctx.p.electorIds, opensAt: at.toISOString() },
          ctx.available,
          ctx.group,
        ),
        plenaryMeetingId: req.params.id,
      };
      await repo.createPoll(p, s.sql);
      return p.id;
    });
    res.status(201).json({ id });
  });
  app.post('/api/plenaries/:id/polls/:pollId/close', async (req, res) => {
    uuid(req.params.pollId);
    await organization.atomic(async (s) => {
      const ctx = await access(s, req.params.id, res.locals.user);
      assert(ctx.canModerate, 'Somente a mesa pode encerrar votações.', 403);
      assert(
        (await new PlenaryStore(repo, s.sql).polls(req.params.id)).some(
          (p) => p.id === req.params.pollId,
        ),
        'Votação não encontrada.',
        404,
      );
      if (s.sql)
        await s.sql.query('UPDATE anade.polls SET closed=true WHERE id=$1', [req.params.pollId]);
      else repo.poll(req.params.pollId).closed = true;
    });
    res.json({ ok: true });
  });
  app.post('/api/plenaries/:id/close', async (req, res) => {
    await organization.atomic(async (s) => {
      const ctx = await access(s, req.params.id, res.locals.user);
      assert(ctx.canManage, 'Somente a presidência pode encerrar a reunião.', 403);
      assert(ctx.p?.status === 'open', 'O plenário não está aberto.', 409);
      await new PlenaryStore(repo, s.sql).save(req.params.id, {
        ...ctx.p,
        status: 'closed',
        closedAt: now().toISOString(),
      });
    });
    if (repo.pool)
      await repo.pool.query(
        "UPDATE anade.polls SET closed=true WHERE governance->>'plenaryMeetingId'=$1",
        [req.params.id],
      );
    else
      for (const p of repo.data.polls)
        if (p.governance?.plenaryMeetingId === req.params.id) p.closed = true;
    res.json({
      ok: true,
      warning:
        'Sessão encerrada no portal. O kMeet não permite encerrar o áudio remotamente pelo servidor da ANADE; a mesa deve encerrar a sala também no serviço.',
    });
  });
}
