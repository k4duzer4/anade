import { randomUUID } from 'node:crypto';
import { assert, text } from './domain.js';

// Um ciclo começa às 08h de Brasília (UTC-3), inclusive antes da meia-noite.
export function publicationWindow(now = new Date()) {
  const day = 86400000,
    anchor = Date.UTC(2000, 0, 1, 11);
  const start = anchor + Math.floor((now.getTime() - anchor) / day) * day;
  return { start: new Date(start).toISOString(), end: new Date(start + day).toISOString() };
}
export function publicationUrl(value) {
  const clean = text(value, 2048);
  let url;
  try {
    url = new URL(clean);
  } catch {
    assert(false, 'Informe um link HTTPS válido.');
  }
  assert(
    url.protocol === 'https:' && !url.username && !url.password,
    'Use um link HTTPS sem credenciais.',
  );
  return url.toString();
}
const emptyStatute = () => ({
  title: 'Estatuto da ANADE',
  body: '',
  url: '',
  published: false,
  updatedAt: null,
});
export class PublicationsStore {
  constructor(repo) {
    this.repo = repo;
    this.sql = repo.pool;
    if (!this.sql) repo.publications ??= new Map();
  }
  async list(period, page) {
    if (!this.sql) {
      for (const [id, row] of this.repo.publications)
        if (row.periodStart < period) this.repo.publications.delete(id);
      return [...this.repo.publications.values()]
        .filter((r) => r.periodStart === period)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
        .slice(page * 20, page * 20 + 21);
    }
    // A consulta só mostra o ciclo vigente. A coleta física ocorre no próximo acesso,
    // sem depender de uma instância ativa ou de cron pago às 8h.
    await this.sql.query('DELETE FROM anade.daily_publications WHERE period_start < $1', [period]);
    const { rows } = await this.sql.query(
      'SELECT id,owner_id AS "ownerId",type,title,url,period_start AS "periodStart",created_at AS "createdAt" FROM anade.daily_publications WHERE period_start=$1 ORDER BY created_at DESC,id LIMIT 21 OFFSET $2',
      [period, page * 20],
    );
    return rows.map((r) => ({
      ...r,
      periodStart: new Date(r.periodStart).toISOString(),
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  }
  async save(data) {
    const id = randomUUID();
    if (!this.sql) {
      assert(
        ![...this.repo.publications.values()].some(
          (r) =>
            r.ownerId === data.ownerId && r.periodStart === data.periodStart && r.url === data.url,
        ),
        'Você já compartilhou esse link neste ciclo.',
        409,
      );
      this.repo.publications.set(id, { ...data, id });
    } else {
      try {
        await this.sql.query(
          'INSERT INTO anade.daily_publications(id,owner_id,type,title,url,period_start,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [id, data.ownerId, data.type, data.title, data.url, data.periodStart, data.createdAt],
        );
      } catch (error) {
        if (error.code === '23505')
          assert(false, 'Você já compartilhou esse link neste ciclo.', 409);
        throw error;
      }
    }
    return id;
  }
  async remove(id, user, period) {
    assert(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id), 'Link não encontrado.', 404);
    const item = this.sql
      ? (
          await this.sql.query(
            'SELECT owner_id AS "ownerId" FROM anade.daily_publications WHERE id=$1 AND period_start=$2',
            [id, period],
          )
        ).rows[0]
      : this.repo.publications.get(id);
    assert(item && (this.sql || item.periodStart === period), 'Este link já saiu do mural.', 404);
    assert(
      user.admin || item.ownerId === user.id,
      'Você só pode retirar seus próprios links.',
      403,
    );
    if (this.sql)
      await this.sql.query('DELETE FROM anade.daily_publications WHERE id=$1 AND period_start=$2', [
        id,
        period,
      ]);
    else this.repo.publications.delete(id);
  }
  async statute() {
    if (!this.sql) return this.repo.statute || emptyStatute();
    const { rows } = await this.sql.query(
      "SELECT value FROM anade.portal_settings WHERE key='statute'",
    );
    return rows[0]?.value || emptyStatute();
  }
  async setStatute(value) {
    if (!this.sql) this.repo.statute = value;
    else
      await this.sql.query(
        "INSERT INTO anade.portal_settings(key,value) VALUES('statute',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
        [JSON.stringify(value)],
      );
  }
}
export function publicationRoutes(app, repo, admin, { now = () => new Date() } = {}) {
  const store = new PublicationsStore(repo);
  app.get('/api/publications', async (req, res) => {
    const date = now(),
      period = publicationWindow(date),
      page = Number(req.query.page || 0);
    assert(Number.isInteger(page) && page >= 0 && page <= 10000, 'Página inválida.');
    const records = await store.list(period.start, page);
    res.json({
      records: records.slice(0, 20),
      hasMore: records.length > 20,
      page,
      serverTime: date.toISOString(),
      resetsAt: period.end,
      periodStart: period.start,
    });
  });
  app.post('/api/publications', async (req, res) => {
    const date = now(),
      period = publicationWindow(date);
    assert(['post', 'materia'].includes(req.body.type), 'Escolha post ou matéria de jornal.');
    const id = await store.save({
      ownerId: res.locals.user.id,
      type: req.body.type,
      title: text(req.body.title, 160),
      url: publicationUrl(req.body.url),
      periodStart: period.start,
      createdAt: date.toISOString(),
    });
    res.status(201).json({ id });
  });
  app.delete('/api/publications/:id', async (req, res) => {
    await store.remove(req.params.id, res.locals.user, publicationWindow(now()).start);
    res.json({ ok: true });
  });
  app.get('/api/statute', async (_req, res) => {
    const value = await store.statute();
    res.json(
      res.locals.user.admin || value.published
        ? value
        : { ...emptyStatute(), updatedAt: value.updatedAt },
    );
  });
  app.put('/api/statute', admin, async (req, res) => {
    assert(typeof req.body.published === 'boolean', 'Situação de publicação inválida.');
    const value = {
      title: text(req.body.title, 160),
      body: text(req.body.body ?? '', 40000, false),
      url: req.body.url ? publicationUrl(req.body.url) : '',
      published: req.body.published,
      updatedAt: now().toISOString(),
      updatedBy: res.locals.user.id,
    };
    assert(
      !value.published || value.body || value.url,
      'Adicione o texto ou o link oficial antes de publicar.',
    );
    await store.setStatute(value);
    res.json({ ok: true });
  });
  app.delete('/api/statute', admin, async (req, res) => {
    await store.setStatute({
      ...emptyStatute(),
      updatedAt: now().toISOString(),
      updatedBy: res.locals.user.id,
    });
    res.json({ ok: true });
  });
}
