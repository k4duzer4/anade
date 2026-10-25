import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { sensitiveRequestLimits } from './request-security.js';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import multer from 'multer';
import {
  brasiliaDay,
  checkinFields,
  checkinFilters,
  electoralOffices,
  MAX_UPLOAD_BYTES,
  optimizeProof,
} from './checkins.js';
import { MemoryProofStorage, SupabaseProofStorage } from './proof-storage.js';
import { rankingFilters } from './checkin-ranking.js';
import { communityRoutes } from './community.js';
import { publicationRoutes } from './publications.js';
import { activityRoutes } from './activity.js';
import { organizationRoutes } from './organization.js';
import { contentManagementRoutes } from './content-management.js';
import { OrganizationStore, seesMeeting, seesPoll } from './organization-store.js';
import { votingRules } from './governance.js';
import {
  assignmentDetails,
  partyFunctions,
  emptyAssignment,
  isLegal,
  isFinance,
  hasFunction,
  officeForGroup,
} from './assignments.js';
import { MAX_PROFILE_IMAGE_BYTES, PROFILE_BUCKET, profileMediaRoutes } from './profile-media.js';
import {
  assert,
  text,
  profile,
  publicMember,
  newPoll,
  presentPoll,
  ideologies,
  degrees,
  states,
  meetingDetails,
  directorDetails,
} from './domain.js';
const random = () => randomBytes(32).toString('hex');
const uuid = (value) =>
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
    'Registro não encontrado.',
    404,
  );
const saveSession = (req) =>
  new Promise((ok, fail) => req.session.save((e) => (e ? fail(e) : ok())));
const regenerate = (req) =>
  new Promise((ok, fail) => req.session.regenerate((e) => (e ? fail(e) : ok())));
export async function discordRequest(path, token) {
  const r = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  assert(r.status !== 401, 'Sua sessão expirou. Entre novamente.', 401);
  assert(
    ![403, 404].includes(r.status),
    'É necessário estar no servidor da ANADE e ter o cargo de filiado.',
    403,
  );
  if (r.status === 429) {
    const body = await r.json().catch(() => ({}));
    const delays = [
      r.headers.get('retry-after'),
      r.headers.get('x-ratelimit-reset-after'),
      body.retry_after,
    ]
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);
    const retryAfter = Math.ceil(Math.max(1, ...delays));
    throw Object.assign(
      new Error(
        `O Discord limitou as consultas de filiação. Tente novamente em ${retryAfter} segundos.`,
      ),
      {
        status: 503,
        code: 'DISCORD_RATE_LIMITED',
        retryAfter,
      },
    );
  }
  assert(r.ok, 'O Discord está indisponível. Tente novamente em instantes.', 503);
  return r.json();
}
export function createApp({
  repo,
  store,
  secret,
  origin = 'http://localhost:3000',
  demo = false,
  env = process.env,
  discord = discordRequest,
  proofStorage,
  profileStorage,
  organizationStorage,
  seasonRequest,
  now = () => new Date(),
}) {
  assert(!demo || env.NODE_ENV !== 'production', 'Modo demonstração indisponível em produção.');
  assert(new URL(origin).origin === origin, 'APP_ORIGIN deve ser uma origem sem caminho.');
  assert(secret && secret.length >= 32, 'SESSION_SECRET deve ter pelo menos 32 caracteres.');
  const app = express();
  const organization = new OrganizationStore(repo);
  const documentStorage =
    organizationStorage ||
    (demo
      ? new MemoryProofStorage()
      : new SupabaseProofStorage(env, fetch, {
          bucket: 'anade-documents',
          maxBytes: 4 * 1024 * 1024,
          allowedMimeTypes: ['application/pdf', 'image/webp'],
        }));
  const storage = proofStorage || (demo ? new MemoryProofStorage() : new SupabaseProofStorage(env));
  const mediaStorage =
    profileStorage ||
    (demo
      ? new MemoryProofStorage()
      : new SupabaseProofStorage(env, fetch, {
          bucket: PROFILE_BUCKET,
          maxBytes: MAX_PROFILE_IMAGE_BYTES,
        }));
  app.disable('x-powered-by');
  if (Number(env.TRUST_PROXY) > 0) app.set('trust proxy', Number(env.TRUST_PROXY));
  app.use(
    helmet({
      referrerPolicy: { policy: 'same-origin' },
      strictTransportSecurity: origin.startsWith('https:')
        ? { maxAge: 31536000, includeSubDomains: false }
        : false,
    }),
  );
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(
    '/auth',
    rateLimit({
      windowMs: 60000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Muitas tentativas. Aguarde um minuto.' },
    }),
  );
  app.use(
    '/api',
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Muitas requisições. Aguarde um minuto.' },
    }),
  );
  // Limit abusive traffic before parsing bodies or reading sessions from PostgreSQL.
  app.use(express.json({ limit: '128kb', inflate: false }));
  app.use(
    session({
      name: 'anade.sid',
      secret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: origin.startsWith('https:'),
        maxAge: 8 * 3600000,
      },
    }),
  );
  const configured = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_GUILD_ID',
    'DISCORD_MEMBER_ROLE_ID',
    'DISCORD_REDIRECT_URI',
  ].every((key) => env[key]);
  const adminRoleId = (env.DISCORD_ADMIN_ROLE_ID || '').trim();
  const hasAdminRole = (roles) => adminRoleId !== '' && roles.includes(adminRoleId);
  const getMember = (userId, token) => {
    const load = () => discord(`/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, token);
    // Cada novo login consulta o Discord; somente o cooldown é reaproveitado.
    return repo.discordMember
      ? repo.discordMember(env.DISCORD_GUILD_ID, userId, load, { refresh: true })
      : load();
  };
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/config', (_req, res) =>
    res.json({
      partyName: 'Aliança Nacional Democrática',
      acronym: 'ANADE',
      number: 10,
      demo,
      configured,
      ideologies,
      degrees,
      states,
      electoralOffices,
      partyFunctions,
    }),
  );
  const checkOrigin = (req, _res, next) => {
    assert(req.headers.origin === origin, 'Origem inválida.', 403);
    next();
  };
  app.get('/auth/discord', async (req, res) => {
    assert(configured, 'O login Discord ainda não foi configurado.', 503);
    // Um novo login invalida a autorização anterior, inclusive se a filiação for negada.
    await regenerate(req);
    const state = random();
    req.session.oauth = { state, expires: Date.now() + 300000 };
    await saveSession(req);
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds.members.read',
      state,
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });
  app.get('/auth/discord/callback', async (req, res) => {
    try {
      const flow = req.session.oauth;
      delete req.session.oauth;
      await saveSession(req);
      assert(
        flow && flow.expires > Date.now() && flow.state === req.query.state,
        'Autorização expirada. Tente entrar novamente.',
        403,
      );
      assert(!req.query.error && typeof req.query.code === 'string', 'Login cancelado no Discord.');
      const response = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: req.query.code,
          redirect_uri: env.DISCORD_REDIRECT_URI,
        }),
        signal: AbortSignal.timeout(10000),
      });
      assert(response.ok, 'Não foi possível concluir o login. Tente novamente.', 401);
      const oauth = await response.json();
      const user = await discord('/users/@me', oauth.access_token);
      const member = await getMember(user.id, oauth.access_token);
      assert(
        member.roles.includes(env.DISCORD_MEMBER_ROLE_ID),
        'Seu usuário não possui o cargo de filiado da ANADE.',
        403,
      );
      await repo.account(user.id, user.username);
      const discordAdmin = hasAdminRole(member.roles);
      await regenerate(req);
      req.session.user = {
        id: user.id,
        discord: user.username,
        member: true,
        discordAdmin,
        admin: discordAdmin || (await repo.isAdmin(user.id)),
        expires: Date.now() + Math.min(oauth.expires_in, 28800) * 1000,
      };
      req.session.csrf = random();
      await saveSession(req);
      res.redirect(`${origin}/painel`);
    } catch (e) {
      res.redirect(
        `${origin}/?authError=${encodeURIComponent(e.status ? e.message : 'Não foi possível conectar ao Discord. Tente novamente.')}`,
      );
    }
  });
  app.post('/api/demo-login', checkOrigin, async (req, res) => {
    assert(demo, 'Rota não encontrada.', 404);
    const admin = req.body?.role !== 'member';
    await regenerate(req);
    req.session.user = {
      id: admin ? 'demo-admin' : 'demo-member',
      discord: admin ? 'direcao_demo' : 'filiado_demo',
      admin,
      demo: true,
      expires: Date.now() + 28800000,
    };
    req.session.csrf = random();
    await repo.account(req.session.user.id, req.session.user.discord);
    await saveSession(req);
    res.json({ ok: true });
  });
  app.use('/api', async (req, res, next) => {
    const user = req.session.user;
    assert(user && user.expires > Date.now(), 'Entre com o Discord para continuar.', 401);
    if (!user.demo) {
      assert(
        user.member === true,
        'Sua sessão não possui filiação ativa. Entre novamente com o Discord.',
        403,
      );
      // A permissão local é lida do banco, sem consultas ao Discord durante a navegação.
      user.admin =
        (await repo.isAdmin(user.id)) || (adminRoleId !== '' && user.discordAdmin === true);
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      assert(req.headers.origin === origin, 'Origem inválida.', 403);
      const input = Buffer.from(req.headers['x-csrf-token'] || ''),
        expected = Buffer.from(req.session.csrf || '');
      assert(
        input.length > 0 && input.length === expected.length && timingSafeEqual(input, expected),
        'Recarregue a página e tente novamente.',
        403,
      );
    }
    res.locals.user = { ...user, assignment: await repo.memberAssignment(user.id) };
    next();
  });
  app.use('/api', ...sensitiveRequestLimits());
  const admin = (req, _res, next) => {
    assert(req.session.user.admin, 'Apenas a direção pode realizar esta ação.', 403);
    next();
  };
  app.get('/api/access', (_req, res) => {
    const user = res.locals.user;
    res.json({ user: { id: user.id, admin: user.admin } });
  });
  app.get('/api/admin/accounts', admin, async (_req, res) => {
    res.json({ accounts: await repo.adminAccounts() });
  });
  app.get('/api/admin/assignments/:id', admin, async (req, res) =>
    res.json({ assignment: await repo.memberAssignment(req.params.id) }),
  );
  app.put('/api/admin/assignments/:id', admin, async (req, res) => {
    await repo.saveAssignment(req.params.id, assignmentDetails(req.body), res.locals.user.id);
    res.json({ ok: true });
  });
  app.get('/api/checkins', async (req, res) => {
    const today = brasiliaDay(now());
    const filters = checkinFilters(req.query);
    const result = await repo.listCheckins({ ...filters, userId: res.locals.user.id });
    const todays = await repo.listCheckins({ userId: res.locals.user.id, day: today });
    res.json({
      ...result,
      today,
      todayRecord: todays.records[0] || null,
      storageReady: storage.configured,
    });
  });
  app.get('/api/admin/checkins', admin, async (req, res) => {
    const [result, accounts] = await Promise.all([
      repo.listCheckins(checkinFilters(req.query, true)),
      repo.adminAccounts(),
    ]);
    res.json({
      ...result,
      members: accounts.map(({ id, name, discord }) => ({ id, name, discord })),
      today: brasiliaDay(now()),
      storageReady: storage.configured,
    });
  });
  app.get('/api/admin/checkins/ranking', admin, async (req, res) => {
    const filters = rankingFilters(req.query, brasiliaDay(now()));
    res.json({ ...(await repo.checkinRanking(filters)), ...filters });
  });
  const proofUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 2, fields: 2, parts: 4, fieldSize: 200 },
  }).fields([
    { name: 'actions', maxCount: 1 },
    { name: 'blue', maxCount: 1 },
  ]);
  app.post(
    '/api/checkins',
    rateLimit({
      windowMs: 60000,
      limit: 6,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Aguarde um minuto antes de tentar enviar novamente.' },
    }),
    (_req, _res, next) => {
      assert(
        storage.configured,
        'A administração ainda precisa configurar o armazenamento dos comprovantes.',
        503,
      );
      next();
    },
    (req, res, next) =>
      proofUpload(req, res, (error) => {
        if (!error) return next();
        next(
          Object.assign(
            new Error(
              error.code === 'LIMIT_FILE_SIZE'
                ? 'Cada print deve ter até 2 MB após a preparação.'
                : 'Envie exatamente dois prints, um para as ações e outro para o Blue.',
            ),
            { status: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400 },
          ),
        );
      }),
    async (req, res) => {
      const fields = checkinFields({ ...req.body, office: res.locals.user.assignment.office });
      assert(
        req.files?.actions?.length === 1 && req.files?.blue?.length === 1,
        'Envie o print das três ações e o print do post no Blue.',
      );
      const buffers = await Promise.all([
        optimizeProof(req.files.actions[0].buffer),
        optimizeProof(req.files.blue[0].buffer),
      ]);
      const id = randomUUID();
      const createdAt = now();
      const entry = {
        ...fields,
        id,
        accountId: res.locals.user.id,
        day: brasiliaDay(createdAt),
        createdAt: createdAt.toISOString(),
        actionsPath: `${id}/actions.webp`,
        bluePath: `${id}/blue.webp`,
      };
      let started = false;
      try {
        const record = await repo.createCheckin(entry, async () => {
          started = true;
          const results = await Promise.allSettled([
            storage.put(entry.actionsPath, buffers[0]),
            storage.put(entry.bluePath, buffers[1]),
          ]);
          const failure = results.find((result) => result.status === 'rejected');
          if (failure) throw failure.reason;
        });
        res.status(201).json({ record });
      } catch (error) {
        if (started)
          await storage
            .remove([entry.actionsPath, entry.bluePath])
            .catch(() => console.error('CHECKIN_PROOF_CLEANUP_FAILED'));
        throw error;
      }
    },
  );
  app.get('/api/checkins/:id/proofs/:kind', async (req, res) => {
    uuid(req.params.id);
    assert(['actions', 'blue'].includes(req.params.kind), 'Comprovante não encontrado.', 404);
    const path = await repo.checkinProof(
      req.params.id,
      req.params.kind,
      res.locals.user.id,
      res.locals.user.admin,
    );
    const buffer = await storage.get(path);
    res
      .type('image/webp')
      .set('Content-Disposition', `inline; filename="${req.params.kind}.webp"`)
      .send(buffer);
  });
  app.post('/api/admin/admins', admin, async (req, res) => {
    const discordId = typeof req.body?.discordId === 'string' ? req.body.discordId.trim() : '';
    assert(
      /^[0-9]{17,20}$/.test(discordId),
      'Informe o ID numérico do usuário Discord, com 17 a 20 dígitos.',
    );
    const changed = await repo.grantAdmin(discordId, res.locals.user.id);
    res.json({ ok: true, changed });
  });
  app.get('/api/state', async (req, res) => {
    const data = await repo.snapshot();
    const user = res.locals.user;
    const groups = await organization.list('group');
    res.json({
      serverTime: new Date().toISOString(),
      user: {
        id: user.id,
        discord: user.discord,
        admin: user.admin,
        member: true,
        assignment: user.assignment || emptyAssignment(),
        permissions: {
          legal: isLegal(user),
          finance: isFinance(user),
          communications: user.admin || hasFunction(user, 'Comunicação'),
        },
      },
      csrf: req.session.csrf,
      members: data.members.map((m) => publicMember(m, user.id)),
      meetings: data.meetings.filter((m) => seesMeeting(m, user, groups)),
      directors: data.directors,
      polls: data.polls
        .filter((p) => seesPoll(p, user, groups))
        .map((p) => {
          const result = presentPoll(p, user.id);
          const required =
            officeForGroup(groups.find((g) => g.id === p.governance?.groupId)?.type) ||
            p.governance?.requiredOffice;
          if (required) {
            result.canVote = result.canVote && user.assignment.office === required;
            result.governance = { ...result.governance, requiredOffice: required };
          }
          return result;
        }),
    });
  });
  app.post('/api/logout', (req, res, next) =>
    req.session.destroy((e) => {
      if (e) return next(e);
      res.clearCookie('anade.sid', { path: '/' });
      res.json({ ok: true });
    }),
  );
  app.put('/api/profile', async (req, res) => {
    await repo.saveProfile(res.locals.user.id, profile(req.body));
    res.json({ ok: true });
  });
  profileMediaRoutes(app, repo, mediaStorage);
  app.post('/api/directors', admin, async (req, res) => {
    await repo.saveDirector({ id: randomUUID(), ...directorDetails(req.body) });
    res.status(201).json({ ok: true });
  });
  app.put('/api/directors/:id', admin, async (req, res) => {
    uuid(req.params.id);
    await repo.saveDirector({ id: req.params.id, ...directorDetails(req.body) }, true);
    res.json({ ok: true });
  });
  app.delete('/api/directors/:id', admin, async (req, res) => {
    uuid(req.params.id);
    await repo.removeDirector(req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/meetings', admin, async (req, res) => {
    const meeting = {
      id: randomUUID(),
      ...meetingDetails(req.body, { creating: true }),
      groupId: req.body.groupId || '',
    };
    await organization.atomic(async (s) => {
      if (meeting.groupId) await s.get('group', meeting.groupId);
      await repo.createMeeting(meeting, res.locals.user.id, s.sql);
    });
    res.status(201).json({ ok: true });
  });
  app.put('/api/meetings/:id', admin, async (req, res) => {
    uuid(req.params.id);
    const groupId = req.body.groupId || '';
    const details = { ...meetingDetails(req.body), groupId };
    await organization.atomic(async (s) => {
      if (groupId) await s.get('group', groupId);
      await repo.updateMeeting(req.params.id, details, s.sql);
      await s.pruneMeetingComments(req.params.id, details.agenda);
    });
    res.json({ ok: true });
  });
  app.post('/api/meetings/:id/attendance', async (req, res) => {
    uuid(req.params.id);
    const meeting = (await repo.snapshot()).meetings.find((m) => m.id === req.params.id);
    assert(
      meeting && seesMeeting(meeting, res.locals.user, await organization.list('group')),
      'Reunião não encontrada.',
      404,
    );
    assert(typeof req.body.confirm === 'boolean', 'Confirmação inválida.');
    await repo.attendance(req.params.id, res.locals.user.id, req.body.confirm);
    res.json({ ok: true });
  });
  app.put('/api/meetings/:id/minutes', admin, async (req, res) => {
    uuid(req.params.id);
    await repo.minutes(req.params.id, text(req.body.minutes, 10000, false));
    res.json({ ok: true });
  });
  app.post('/api/polls', admin, async (req, res) => {
    const poll = newPoll(req.body, res.locals.user.id);
    await organization.atomic(async (s) => {
      const group = req.body.groupId ? await s.get('group', req.body.groupId) : null;
      const available = (await s.assignmentMembers())
        .map((m) => m.id)
        .filter((id) => !group || group.memberIds.includes(id));
      poll.governance = votingRules(req.body, available, group);
      await repo.createPoll(poll, s.sql);
    });
    res.status(201).json({ ok: true });
  });
  app.post('/api/polls/:id/vote', async (req, res) => {
    uuid(req.params.id);
    await repo.vote(req.params.id, res.locals.user.id, req.body.option);
    res.json({ ok: true });
  });
  app.post('/api/polls/:id/close', admin, async (req, res) => {
    uuid(req.params.id);
    await repo.closePoll(req.params.id);
    res.json({ ok: true });
  });
  communityRoutes(app, repo, admin);
  publicationRoutes(app, repo, admin, { now });
  activityRoutes(app, repo, { now });
  organizationRoutes(app, repo, admin, documentStorage, { seasonRequest });
  contentManagementRoutes(app, repo, admin, documentStorage, storage);
  app.use((_req, _res, next) =>
    next(Object.assign(new Error('Rota não encontrada.'), { status: 404 })),
  );
  app.use((error, _req, res, _next) => {
    const status =
      error.type === 'entity.parse.failed'
        ? 400
        : error.type === 'entity.too.large'
          ? 413
          : error.status || 500;
    if (status >= 500) console.error('API:', error.code || error.name);
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(status).json({
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      error:
        status === 500
          ? 'Não foi possível concluir. Tente novamente.'
          : error.type === 'entity.parse.failed'
            ? 'JSON inválido.'
            : error.message,
    });
  });
  return app;
}
