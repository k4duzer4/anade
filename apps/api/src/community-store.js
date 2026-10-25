import { randomUUID } from 'node:crypto';
import { assert, newPoll } from './domain.js';

const present = (row) => ({
  ...row.data,
  id: row.id,
  ownerId: row.owner_id,
  parentId: row.parent_id,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  supports: Number(row.supports || 0),
  comments: Number(row.comments || 0),
  reads: Number(row.reads || 0),
  supported: !!row.supported,
  read: !!row.read,
});
export class CommunityStore {
  constructor(repo, client = null) {
    this.repo = repo;
    this.sql = client || repo.pool;
    this.transactional = !!client;
    if (!this.sql)
      repo.community ??= {
        items: new Map(),
        actions: new Set(),
        open: false,
        queue: Promise.resolve(),
      };
  }
  async atomic(fn) {
    if (this.transactional) return fn(this);
    if (this.sql)
      return this.repo.transaction((client) => fn(new CommunityStore(this.repo, client)));
    const state = this.repo.community;
    const task = state.queue.then(async () => {
      const backup = {
        items: structuredClone(state.items),
        actions: new Set(state.actions),
        open: state.open,
      };
      try {
        return await fn(this);
      } catch (error) {
        Object.assign(state, backup);
        throw error;
      }
    });
    state.queue = task.catch(() => {});
    return task;
  }
  async open(lock = false) {
    if (!this.sql) return this.repo.community.open;
    const { rows } = await this.sql.query(
      `SELECT value FROM anade.portal_settings WHERE key='campaign_open'${lock ? ' FOR UPDATE' : ''}`,
    );
    return rows[0]?.value === true;
  }
  async setOpen(value) {
    if (!this.sql) {
      this.repo.community.open = value;
      return;
    }
    await this.sql.query(
      "UPDATE anade.portal_settings SET value=$1::jsonb WHERE key='campaign_open'",
      [JSON.stringify(value)],
    );
  }
  async list(
    kind,
    { id, ownerId, parentId, viewer = '', page = 0, limit = 20, lock = false } = {},
  ) {
    if (!this.sql) {
      const state = this.repo.community;
      const rows = [...state.items.values()]
        .filter(
          (r) =>
            r.kind === kind &&
            (!id || r.id === id) &&
            (!ownerId || r.owner_id === ownerId) &&
            (!parentId || r.parent_id === parentId),
        )
        .sort(
          (a, b) =>
            (kind === 'announcement' ? Number(b.data.pinned) - Number(a.data.pinned) : 0) ||
            (kind === 'timeline' ? b.data.start.localeCompare(a.data.start) : 0) ||
            b.created_at.localeCompare(a.created_at) ||
            a.id.localeCompare(b.id),
        );
      return rows.slice(page * limit, page * limit + limit + 1).map((row) =>
        present({
          ...row,
          supports: [...state.actions].filter((k) => k.startsWith(`${row.id}:support:`)).length,
          reads: [...state.actions].filter((k) => k.startsWith(`${row.id}:read:`)).length,
          comments: [...state.items.values()].filter(
            (r) => r.kind === 'comment' && r.parent_id === row.id,
          ).length,
          supported: state.actions.has(`${row.id}:support:${viewer}`),
          read: state.actions.has(`${row.id}:read:${viewer}`),
        }),
      );
    }
    const values = [kind, viewer];
    const conditions = ['i.kind=$1'];
    for (const [column, value] of [
      ['id', id],
      ['owner_id', ownerId],
      ['parent_id', parentId],
    ])
      if (value) {
        values.push(value);
        conditions.push(`i.${column}=$${values.length}`);
      }
    values.push(limit + 1, page * limit);
    const { rows } = await this.sql.query(
      `SELECT i.*,
      (SELECT count(*) FROM anade.community_actions a WHERE a.item_id=i.id AND a.kind='support') AS supports,
      (SELECT count(*) FROM anade.community_actions a WHERE a.item_id=i.id AND a.kind='read') AS reads,
      (SELECT count(*) FROM anade.community_items c WHERE c.parent_id=i.id AND c.kind='comment') AS comments,
      EXISTS(SELECT 1 FROM anade.community_actions a WHERE a.item_id=i.id AND a.kind='support' AND a.user_id=$2) AS supported,
      EXISTS(SELECT 1 FROM anade.community_actions a WHERE a.item_id=i.id AND a.kind='read' AND a.user_id=$2) AS read
      FROM anade.community_items i WHERE ${conditions.join(' AND ')} ORDER BY ${kind === 'announcement' ? "(i.data->>'pinned')::boolean DESC," : kind === 'timeline' ? "i.data->>'start' DESC," : ''} i.created_at DESC,i.id LIMIT $${values.length - 1} OFFSET $${values.length}${lock ? ' FOR UPDATE OF i' : ''}`,
      values,
    );
    return rows.map(present);
  }
  async get(kind, id, viewer = '', lock = false) {
    const [row] = await this.list(kind, { id, viewer, lock });
    assert(row, 'Registro não encontrado.', 404);
    return row;
  }
  async activityItems() {
    // Activity needs revisions and comment totals, not support/read statistics per viewer.
    if (this.sql) {
      const { rows } = await this.sql.query(
        "SELECT i.*,coalesce(c.comments,0) AS comments FROM anade.community_items i LEFT JOIN (SELECT parent_id,count(*) AS comments FROM anade.community_items WHERE kind='comment' GROUP BY parent_id) c ON c.parent_id=i.id WHERE i.kind IN ('proposal','announcement','campaign') ORDER BY i.created_at DESC,i.id",
      );
      return rows.map((row) => ({ ...present(row), kind: row.kind }));
    }
    const items = [...this.repo.community.items.values()],
      counts = new Map();
    for (const item of items)
      if (item.kind === 'comment')
        counts.set(item.parent_id, (counts.get(item.parent_id) || 0) + 1);
    return items
      .filter((i) => ['proposal', 'announcement', 'campaign'].includes(i.kind))
      .map((row) => ({
        ...present({ ...row, comments: counts.get(row.id) || 0 }),
        kind: row.kind,
      }));
  }
  async save(kind, ownerId, data, { id = randomUUID(), parentId = null } = {}) {
    if (!this.sql) {
      const state = this.repo.community;
      assert(
        kind !== 'campaign' ||
          ![...state.items.values()].some(
            (r) => r.kind === kind && r.owner_id === ownerId && r.id !== id,
          ),
        'Você já cadastrou uma pré-candidatura.',
        409,
      );
      const previous = state.items.get(id);
      state.items.set(id, {
        id,
        kind,
        owner_id: ownerId,
        parent_id: parentId,
        data,
        created_at: previous?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else {
      try {
        await this.sql.query(
          'INSERT INTO anade.community_items(id,kind,owner_id,parent_id,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',
          [id, kind, ownerId, parentId, JSON.stringify(data)],
        );
      } catch (error) {
        if (error.code === '23505') assert(false, 'Você já cadastrou uma pré-candidatura.', 409);
        throw error;
      }
    }
    return id;
  }
  async action(id, viewer, kind, enabled = true) {
    if (!this.sql) {
      const key = `${id}:${kind}:${viewer}`;
      if (enabled) this.repo.community.actions.add(key);
      else this.repo.community.actions.delete(key);
      return;
    }
    if (enabled)
      await this.sql.query(
        'INSERT INTO anade.community_actions(item_id,user_id,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [id, viewer, kind],
      );
    else
      await this.sql.query(
        'DELETE FROM anade.community_actions WHERE item_id=$1 AND user_id=$2 AND kind=$3',
        [id, viewer, kind],
      );
  }
  async remove(id) {
    if (!this.sql) {
      const ids = new Set([
        id,
        ...[...this.repo.community.items.values()]
          .filter((item) => item.parent_id === id)
          .map((item) => item.id),
      ]);
      for (const key of ids) this.repo.community.items.delete(key);
      for (const key of this.repo.community.actions)
        if (ids.has(key.split(':')[0])) this.repo.community.actions.delete(key);
      return;
    }
    await this.sql.query('DELETE FROM anade.community_items WHERE id=$1', [id]);
  }
  async resetReads(id) {
    if (!this.sql) {
      for (const key of this.repo.community.actions)
        if (key.startsWith(`${id}:read:`)) this.repo.community.actions.delete(key);
      return;
    }
    await this.sql.query("DELETE FROM anade.community_actions WHERE item_id=$1 AND kind='read'", [
      id,
    ]);
  }
  async search(q, kinds) {
    if (!this.sql)
      return [...this.repo.community.items.values()]
        .filter(
          (r) =>
            kinds.includes(r.kind) &&
            `${r.data.title} ${r.data.body} ${r.data.office || ''}`
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .includes(q),
        )
        .slice(0, 61)
        .map((r) => ({ ...present(r), kind: r.kind }));
    const { rows } = await this.sql.query(
      `SELECT * FROM anade.community_items WHERE kind=ANY($1::text[]) AND strpos(translate(lower(coalesce(data->>'title','')||' '||coalesce(data->>'body','')||' '||coalesce(data->>'office','')),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'),$2)>0 ORDER BY created_at DESC,id LIMIT 61`,
      [kinds, q],
    );
    return rows.map((r) => ({ ...present(r), kind: r.kind }));
  }
  async forward(id, input, author, governance) {
    return this.atomic(async (store) => {
      const item = await store.get('proposal', id, '', true);
      assert(!item.pollId, 'Esta proposta já foi encaminhada.', 409);
      const poll = newPoll({ ...input, title: item.title, description: item.body }, author);
      poll.governance = governance;
      if (store.sql) {
        await store.sql.query(
          'INSERT INTO anade.polls(id,title,description,deadline,secret,author_id,governance) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            poll.id,
            poll.title,
            poll.description,
            poll.deadline,
            poll.secret,
            poll.author,
            governance ? JSON.stringify(governance) : null,
          ],
        );
        for (let i = 0; i < poll.options.length; i++)
          await store.sql.query(
            'INSERT INTO anade.poll_options(poll_id,option_index,label) VALUES($1,$2,$3)',
            [poll.id, i, poll.options[i]],
          );
      } else await this.repo.createPoll(poll);
      await store.save(
        'proposal',
        item.ownerId,
        { title: item.title, body: item.body, pollId: poll.id },
        { id },
      );
      return poll.id;
    });
  }
}
