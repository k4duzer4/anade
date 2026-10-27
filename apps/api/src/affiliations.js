import { assert, text } from './domain.js';
import { affiliationForm, LEGAL_VERSION, partyCurrents } from './affiliation-store.js';
import { deliverAffiliation } from './affiliation-discord.js';
const statuses = ['pending', 'approved', 'rejected', 'withdrawn', 'revoked'];
const validId = (id) =>
  assert(
    /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id),
    'Solicitação não encontrada.',
    404,
  );
export function applicantRoutes(app, store, { now }) {
  app.get('/api/affiliation/session', async (req, res) => {
    const user = res.locals.user;
    const request = await store.latest(user.id);
    // Detalhes operacionais do bot e identidade do revisor são exclusivos do ADM.
    if (request) {
      delete request.deliveries;
      delete request.reviewedBy;
    }
    res.json({
      user: { id: user.id, discord: user.discord, member: user.member === true },
      csrf: req.session.csrf,
      request,
      legalVersion: LEGAL_VERSION,
      currents: partyCurrents,
    });
  });
  app.post('/api/affiliation/requests', async (_req, res) => {
    const record = await store.submit(res.locals.user, affiliationForm(_req.body), now());
    res.status(201).json({ id: record.id });
  });
  app.post('/api/affiliation/requests/:id/withdraw', async (req, res) => {
    validId(req.params.id);
    await store.withdraw(req.params.id, res.locals.user.id, now());
    res.json({ ok: true });
  });
}
export function affiliationAdminRoutes(app, store, admin, { bot, now }) {
  app.get('/api/admin/affiliations', admin, async (req, res) => {
    const status = req.query.status || 'pending';
    const page = Number(req.query.page || 0);
    assert(
      statuses.includes(status) && Number.isInteger(page) && page >= 0 && page <= 100000,
      'Filtro inválido.',
    );
    res.json({ ...(await store.list(status, page)), botConfigured: bot.configured, page });
  });
  app.post('/api/admin/affiliations/:id/review', admin, async (req, res) => {
    validId(req.params.id);
    assert(['approved', 'rejected'].includes(req.body?.decision), 'Escolha aprovar ou recusar.');
    const record = await store.decide(
      req.params.id,
      res.locals.user.id,
      req.body.decision,
      text(req.body.note ?? '', 1000, false),
      now(),
    );
    if (record.status === 'approved')
      await deliverAffiliation(store, bot, record.id, ['role', 'dm'], now);
    res.json({ ok: true, request: await store.get(record.id) });
  });
  app.post('/api/admin/affiliations/:id/delivery', admin, async (req, res) => {
    validId(req.params.id);
    const kind = req.body?.kind;
    assert(['role', 'dm'].includes(kind), 'Integração inválida.');
    const record = await store.get(req.params.id);
    assert(record?.status === 'approved', 'Filiação aprovada não encontrada.', 404);
    assert(
      record.deliveries[kind]?.state !== 'unknown' || req.body.confirmDuplicateRisk === true,
      'O envio anterior não pôde ser confirmado. Confirme o risco de mensagem duplicada antes de reenviar.',
      409,
    );
    await deliverAffiliation(
      store,
      bot,
      record.id,
      [kind],
      now,
      req.body.confirmDuplicateRisk === true,
    );
    res.json({ ok: true, request: await store.get(record.id) });
  });
}
