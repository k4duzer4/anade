import { createHash } from 'node:crypto';
import { assert } from './domain.js';
import { OrganizationStore, belongs, seesMeeting, seesPoll } from './organization-store.js';
import { CommunityStore } from './community-store.js';
import { PublicationsStore, publicationWindow } from './publications.js';
import { financeVisible, legalVisible } from './organization.js';

export class ActivityStore {
  constructor(repo) {
    this.repo = repo;
    this.sql = repo.pool;
    if (!this.sql) repo.activitySeen ??= new Map();
  }
  async seen(id) {
    if (!this.sql) return new Set(this.repo.activitySeen.get(id) || []);
    return new Set(
      (
        await this.sql.query('SELECT item_key FROM anade.activity_seen WHERE account_id=$1', [id])
      ).rows.map((r) => r.item_key),
    );
  }
  async mark(id, keys) {
    if (!this.sql) {
      this.repo.activitySeen.set(id, new Set([...(this.repo.activitySeen.get(id) || []), ...keys]));
      return;
    }
    if (keys.length)
      await this.sql.query(
        `INSERT INTO anade.activity_seen(account_id,item_key) VALUES ${keys.map((_, i) => `($1,$${i + 2})`).join(',')} ON CONFLICT DO NOTHING`,
        [id, ...keys],
      );
  }
}
async function allCommunity(store, kind) {
  const result = [];
  for (let page = 0; ; page++) {
    const rows = await store.list(kind, { page, limit: 1000 });
    result.push(...rows.slice(0, 1000));
    if (rows.length <= 1000) return result;
  }
}
export async function activitySnapshot(repo, user, now = new Date()) {
  const org = new OrganizationStore(repo),
    community = new CommunityStore(repo),
    publications = new PublicationsStore(repo);
  const [
    snapshot,
    groups,
    notes,
    wallets,
    entries,
    legal,
    events,
    files,
    proposals,
    announcements,
    campaignOpen,
    statute,
    calendar,
  ] = await Promise.all([
    repo.snapshot(),
    org.list('group'),
    org.list('note'),
    org.list('wallet'),
    org.list('entry'),
    org.list('legal'),
    org.list('event'),
    org.list('file'),
    allCommunity(community, 'proposal'),
    allCommunity(community, 'announcement'),
    community.open(),
    publications.statute(),
    org.setting(),
  ]);
  const sections = {};
  const add = (paths, kind, id, revision, title, href, date = '') => {
    const key = createHash('sha256')
      .update(JSON.stringify([kind, id, revision]))
      .digest('hex');
    for (const path of paths) {
      sections[path] ??= [];
      if (!sections[path].some((r) => r.key === key))
        sections[path].push({ key, title, href, date });
    }
  };
  // Counts use the same access rules as the destination APIs. No raw private fields leave here.
  for (const m of snapshot.meetings)
    if (seesMeeting(m, user, groups))
      add(
        ['/agenda', ...(m.groupId ? [`/grupos/${m.groupId}`] : [])],
        'meeting',
        m.id,
        [m.title, m.date, m.agenda, m.location, m.minutes, m.meetUrl, m.docsUrl],
        m.title,
        `/agenda?encontro=${m.id}`,
        m.date,
      );
  for (const p of snapshot.polls)
    if (seesPoll(p, user, groups))
      add(
        ['/votacoes', ...(p.governance?.groupId ? [`/grupos/${p.governance.groupId}`] : [])],
        'poll',
        p.id,
        [p.title, p.description, p.deadline, p.closed],
        p.title,
        `/votacoes?votacao=${p.id}`,
        p.deadline,
      );
  for (const g of groups)
    if (belongs(g, user)) {
      const paths = [
        '/grupos',
        `/grupos/${g.id}`,
        ...(['camara', 'senado'].includes(g.type) ? ['/bancadas'] : []),
      ];
      add(
        paths,
        'group',
        g.id,
        [g.name, g.description, g.memberIds, g.leaderId],
        g.name,
        `/grupos/${g.id}`,
        g.updatedAt,
      );
      for (const n of notes.filter((n) => n.groupId === g.id))
        add(paths, 'note', n.id, n.updatedAt || n, n.title, `/grupos/${g.id}`, n.updatedAt);
    }
  for (const p of proposals)
    add(
      ['/propostas'],
      'proposal',
      p.id,
      [p.updatedAt, p.title, p.body, p.comments, p.pollId],
      p.title,
      `/propostas?registro=${p.id}`,
      p.updatedAt,
    );
  for (const a of announcements)
    add(
      ['/comunicados'],
      'announcement',
      a.id,
      [a.updatedAt, a.title, a.body, a.dueDate, a.pinned],
      a.title,
      `/comunicados?registro=${a.id}`,
      a.updatedAt,
    );
  if (campaignOpen || user.admin)
    for (const c of await allCommunity(community, 'campaign'))
      add(
        ['/campanha'],
        'campaign',
        c.id,
        c.updatedAt,
        c.title,
        `/campanha?registro=${c.id}`,
        c.updatedAt,
      );
  const period = publicationWindow(now).start;
  const links = repo.pool
    ? (
        await repo.pool.query(
          'SELECT id,owner_id AS "ownerId",title,url,created_at AS "createdAt" FROM anade.daily_publications WHERE period_start=$1',
          [period],
        )
      ).rows
    : [...repo.publications.values()].filter((p) => p.periodStart === period);
  for (const p of links)
    add(
      ['/divulgacao'],
      'publication',
      p.id,
      p.url,
      p.title,
      '/divulgacao',
      new Date(p.createdAt).toISOString(),
    );
  const availableWallets = wallets.filter((w) => financeVisible(w, user)),
    availableLegal = legal.filter((l) => legalVisible(l, user));
  for (const w of availableWallets)
    add(['/financeiro'], 'wallet', w.id, w.updatedAt, w.name, '/financeiro', w.updatedAt);
  for (const e of entries.filter((e) => availableWallets.some((w) => w.id === e.walletId)))
    add(
      ['/financeiro'],
      'entry',
      e.id,
      e.updatedAt,
      e.description || 'Movimentação financeira',
      '/financeiro',
      e.createdAt,
    );
  for (const l of availableLegal)
    add(['/juridico'], 'legal', l.id, l.updatedAt, l.title, '/juridico', l.updatedAt);
  for (const f of files) {
    const allowed =
      f.parentKind === 'legal'
        ? availableLegal.some((l) => l.id === f.parentId) && f.memberIds.includes(user.id)
        : entries.some(
            (e) => e.id === f.parentId && availableWallets.some((w) => w.id === e.walletId),
          ) &&
          (user.admin ||
            user.assignment?.functions.some((f) => ['Financeiro', 'Tesoureiro'].includes(f)) ||
            f.memberIds.includes(user.id));
    if (allowed)
      add(
        [f.parentKind === 'legal' ? '/juridico' : '/financeiro'],
        'file',
        f.id,
        f.updatedAt,
        f.name,
        f.parentKind === 'legal' ? '/juridico' : '/financeiro',
        f.createdAt,
      );
  }
  for (const e of events)
    add(['/calendario'], 'event', e.id, e.updatedAt, e.title, '/calendario', e.date);
  if (calendar.startDate)
    add(
      ['/calendario'],
      'season',
      'calendar',
      calendar,
      'Configuração da temporada',
      '/calendario',
      calendar.updatedAt,
    );
  if (statute.published)
    add(
      ['/estatuto'],
      'statute',
      'official',
      statute.updatedAt,
      statute.title,
      '/estatuto',
      statute.updatedAt,
    );
  for (const m of snapshot.members) {
    add(
      ['/filiados', `/filiados/${m.id}`],
      'member',
      m.id,
      [m.name, m.state, m.ideology, m.bio, m.office, m.functions, m.avatarUrl, m.bannerUrl],
      m.name,
      `/filiados/${m.id}`,
      m.joinedAt,
    );
    if (m.functions?.length)
      add(
        ['/direcao'],
        'direction',
        m.id,
        [m.functions, m.functionState, m.name, m.avatarUrl],
        m.name,
        `/filiados/${m.id}`,
        m.joinedAt,
      );
  }
  const seen = await new ActivityStore(repo).seen(user.id);
  return {
    serverTime: now.toISOString(),
    sections: Object.fromEntries(
      Object.entries(sections).map(([path, items]) => [
        path,
        {
          total: items.length,
          unseen: items.filter((i) => !seen.has(i.key)).length,
          keys: items.map((i) => i.key),
          unseenKeys: items.filter((i) => !seen.has(i.key)).map((i) => i.key),
          latest: items
            .sort(
              (a, b) => String(b.date).localeCompare(String(a.date)) || a.key.localeCompare(b.key),
            )
            .slice(0, 3)
            .map((i) => ({ ...i, unseen: !seen.has(i.key) })),
        },
      ]),
    ),
  };
}
export function activityRoutes(app, repo, { now = () => new Date() } = {}) {
  app.get('/api/activity', async (_req, res) =>
    res.json(await activitySnapshot(repo, res.locals.user, now())),
  );
  app.put('/api/activity/seen', async (req, res) => {
    const { path, keys } = req.body;
    assert(
      typeof path === 'string' &&
        path.length <= 150 &&
        Array.isArray(keys) &&
        keys.length <= 200 &&
        keys.every((k) => typeof k === 'string' && /^[a-f0-9]{64}$/.test(k)),
      'Novidades inválidas.',
    );
    const current = await activitySnapshot(repo, res.locals.user, now());
    const allowed = new Set(current.sections[path]?.keys || []);
    const accepted = keys.filter((k) => allowed.has(k));
    await new ActivityStore(repo).mark(res.locals.user.id, accepted);
    res.json({ ok: true, keys: accepted });
  });
}
