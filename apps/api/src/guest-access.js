import { randomUUID } from 'node:crypto';
import { assert } from './domain.js';
export class GuestAccess {
  constructor(repo) {
    this.repo = repo;
    if (!repo.pool) repo.guestAccess ??= { entries: new Map(), history: [] };
  }
  async enabled(id) {
    if (!this.repo.pool) return this.repo.guestAccess.entries.get(id) === true;
    const { rows } = await this.repo.pool.query(
      'SELECT enabled FROM anade.guest_access WHERE account_id=$1',
      [id],
    );
    return rows[0]?.enabled === true;
  }
  async activeIds() {
    if (!this.repo.pool)
      return [...this.repo.guestAccess.entries].filter(([, enabled]) => enabled).map(([id]) => id);
    const { rows } = await this.repo.pool.query(
      'SELECT account_id FROM anade.guest_access WHERE enabled=true',
    );
    return rows.map((row) => row.account_id);
  }
  async set(id, enabled, actor) {
    assert(id !== actor, 'Você não pode alterar seu próprio acesso de convidado.', 403);
    if (this.repo.pool)
      return this.repo.transaction(async (client) => {
        const { rows } = await client.query(
          'SELECT id,is_admin FROM anade.accounts WHERE id=$1 FOR UPDATE',
          [id],
        );
        assert(rows[0], 'Essa pessoa precisa entrar com o Discord pelo menos uma vez.', 404);
        assert(
          !enabled || !rows[0].is_admin,
          'Remova a administração da conta antes de torná-la convidada.',
          409,
        );
        const previous = await client.query(
          'SELECT enabled FROM anade.guest_access WHERE account_id=$1',
          [id],
        );
        if ((previous.rows[0]?.enabled === true) === enabled) return false;
        await client.query(
          'INSERT INTO anade.guest_access(account_id,enabled,changed_by) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET enabled=EXCLUDED.enabled,changed_by=EXCLUDED.changed_by,changed_at=now()',
          [id, enabled, actor],
        );
        await client.query(
          'INSERT INTO anade.guest_access_history(id,account_id,actor_id,enabled) VALUES($1,$2,$3,$4)',
          [randomUUID(), id, actor, enabled],
        );
        return true;
      });
    assert(
      this.repo.accounts.has(id),
      'Essa pessoa precisa entrar com o Discord pelo menos uma vez.',
      404,
    );
    assert(
      !enabled || !(await this.repo.isAdmin(id)),
      'Remova a administração da conta antes de torná-la convidada.',
      409,
    );
    if ((this.repo.guestAccess.entries.get(id) === true) === enabled) return false;
    this.repo.guestAccess.entries.set(id, enabled);
    this.repo.guestAccess.history.push({
      id: randomUUID(),
      accountId: id,
      actorId: actor,
      enabled,
    });
    return true;
  }
}
export function emptyGuestState(user, csrf, now) {
  return {
    serverTime: now.toISOString(),
    csrf,
    user: {
      id: user.id,
      discord: user.discord,
      admin: false,
      member: false,
      guest: true,
      permissions: { legal: false, finance: false, communications: false },
    },
    members: [],
    meetings: [],
    polls: [],
    directors: [],
  };
}
