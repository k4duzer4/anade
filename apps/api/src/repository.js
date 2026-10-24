import { assert, castVote } from './domain.js';
import { randomUUID } from 'node:crypto';
import { CHECKIN_PAGE_SIZE, presentCheckin } from './checkins.js';
import { profileMediaUrl } from './profile-media.js';
import { RANKING_PAGE_SIZE } from './checkin-ranking.js';
import { assertElector } from './governance.js';
import { emptyAssignment, assertParliamentaryOffice } from './assignments.js';
export class PgRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async discordMember(guildId, userId, load, { now = Date.now, refresh = false } = {}) {
    const result = await this.transaction(async (client) => {
      // O lock do PostgreSQL também coordena cold starts e instâncias distintas da Vercel.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
        guildId,
        userId,
      ]);
      const { rows } = await client.query(
        'SELECT roles, valid_until, retry_at FROM anade.discord_memberships WHERE guild_id=$1 AND user_id=$2',
        [guildId, userId],
      );
      const cached = rows[0];
      if (!refresh && cached && new Date(cached.valid_until).getTime() > now())
        return { roles: cached.roles };
      if (cached?.retry_at && new Date(cached.retry_at).getTime() > now()) {
        return {
          limited: Math.max(1, Math.ceil((new Date(cached.retry_at).getTime() - now()) / 1000)),
        };
      }
      try {
        const member = await load();
        await client.query(
          `INSERT INTO anade.discord_memberships(guild_id,user_id,roles,valid_until,retry_at)
           VALUES($1,$2,$3,$4,NULL) ON CONFLICT(guild_id,user_id) DO UPDATE
           SET roles=EXCLUDED.roles,valid_until=EXCLUDED.valid_until,retry_at=NULL`,
          [guildId, userId, JSON.stringify(member.roles), new Date(now() + 120000)],
        );
        return { roles: member.roles };
      } catch (error) {
        if (error.code !== 'DISCORD_RATE_LIMITED') throw error;
        await client.query(
          `INSERT INTO anade.discord_memberships(guild_id,user_id,roles,valid_until,retry_at)
           VALUES($1,$2,'[]'::jsonb,$3,$4) ON CONFLICT(guild_id,user_id) DO UPDATE
           SET retry_at=EXCLUDED.retry_at`,
          [guildId, userId, new Date(now()), new Date(now() + error.retryAfter * 1000)],
        );
        return { limited: error.retryAfter };
      }
    });
    if (result.limited) {
      throw Object.assign(
        new Error(
          `O Discord limitou as consultas de filiação. Tente novamente em ${result.limited} segundos.`,
        ),
        {
          status: 503,
          code: 'DISCORD_RATE_LIMITED',
          retryAfter: result.limited,
        },
      );
    }
    return result;
  }
  async account(id, username) {
    await this.pool.query(
      'INSERT INTO anade.accounts(id, username) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username',
      [id, username],
    );
  }
  async isAdmin(id) {
    const { rows } = await this.pool.query('SELECT is_admin FROM anade.accounts WHERE id=$1', [id]);
    return rows[0]?.is_admin === true;
  }
  async memberAssignment(id, client = this.pool) {
    const { rows } = await client.query(
      'SELECT office,office_state,functions,function_state FROM anade.member_assignments WHERE account_id=$1',
      [id],
    );
    return rows[0]
      ? {
          office: rows[0].office,
          officeState: rows[0].office_state,
          functions: rows[0].functions,
          functionState: rows[0].function_state,
        }
      : emptyAssignment();
  }
  async saveAssignment(id, data, actorId) {
    return this.transaction(async (c) => {
      const account = await c.query('SELECT id FROM anade.accounts WHERE id=$1 FOR UPDATE', [id]);
      assert(account.rowCount, 'Conta não encontrada.', 404);
      const previous = await this.memberAssignment(id, c);
      await c.query(
        'INSERT INTO anade.member_assignments(account_id,office,office_state,functions,function_state,updated_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(account_id) DO UPDATE SET office=EXCLUDED.office,office_state=EXCLUDED.office_state,functions=EXCLUDED.functions,function_state=EXCLUDED.function_state,updated_by=EXCLUDED.updated_by,updated_at=now()',
        [
          id,
          data.office,
          data.officeState,
          JSON.stringify(data.functions),
          data.functionState,
          actorId,
        ],
      );
      await c.query(
        'INSERT INTO anade.assignment_history(id,actor_id,account_id,previous,current) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), actorId, id, JSON.stringify(previous), JSON.stringify(data)],
      );
    });
  }
  async adminAccounts() {
    const { rows } = await this.pool.query(
      `SELECT a.id,a.username,a.is_admin,p.data->>'name' AS name
       FROM anade.accounts a LEFT JOIN anade.profiles p ON p.account_id=a.id
       ORDER BY a.is_admin DESC,a.username`,
    );
    return rows.map((account) => ({
      id: account.id,
      discord: account.username,
      name: account.name || '',
      isAdmin: account.is_admin,
    }));
  }
  async grantAdmin(id, actorId) {
    return this.transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT id,is_admin FROM anade.accounts WHERE id=$1 FOR UPDATE',
        [id],
      );
      assert(
        rows[0],
        'Usuário não encontrado. Ele precisa entrar no portal com o Discord pelo menos uma vez.',
        404,
      );
      if (rows[0].is_admin) return false;
      await client.query('UPDATE anade.accounts SET is_admin=true WHERE id=$1', [id]);
      await client.query('INSERT INTO anade.admin_grants(id,actor_id,target_id) VALUES($1,$2,$3)', [
        randomUUID(),
        actorId,
        id,
      ]);
      return true;
    });
  }
  async saveProfile(id, data) {
    await this.pool.query(
      'INSERT INTO anade.profiles(account_id,data) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()',
      [id, JSON.stringify(data)],
    );
  }
  async profileMedia(id, kind) {
    const { rows } = await this.pool.query(
      'SELECT path FROM anade.profile_media WHERE account_id=$1 AND kind=$2',
      [id, kind],
    );
    return rows[0]?.path || null;
  }
  async replaceProfileMedia(id, kind, path, save) {
    return this.transaction(async (client) => {
      const account = await client.query('SELECT id FROM anade.accounts WHERE id=$1 FOR UPDATE', [
        id,
      ]);
      assert(account.rowCount, 'Conta não encontrada.', 404);
      const { rows } = await client.query(
        'SELECT path FROM anade.profile_media WHERE account_id=$1 AND kind=$2',
        [id, kind],
      );
      await save();
      if (path)
        await client.query(
          'INSERT INTO anade.profile_media(account_id,kind,path) VALUES($1,$2,$3) ON CONFLICT(account_id,kind) DO UPDATE SET path=EXCLUDED.path',
          [id, kind, path],
        );
      else
        await client.query('DELETE FROM anade.profile_media WHERE account_id=$1 AND kind=$2', [
          id,
          kind,
        ]);
      return rows[0]?.path || null;
    });
  }
  async createCheckin(entry, saveProofs) {
    try {
      return await this.transaction(async (client) => {
        await client.query('SELECT id FROM anade.accounts WHERE id=$1 FOR UPDATE', [
          entry.accountId,
        ]);
        const existing = await client.query(
          'SELECT id FROM anade.checkins WHERE account_id=$1 AND day=$2',
          [entry.accountId, entry.day],
        );
        assert(
          !existing.rowCount,
          'Você já bateu ponto hoje. Seu registro está no histórico.',
          409,
        );
        const { rows } = await client.query(
          "SELECT a.username,p.data->>'name' AS name,p.data->>'blue' AS blue FROM anade.accounts a LEFT JOIN anade.profiles p ON p.account_id=a.id WHERE a.id=$1",
          [entry.accountId],
        );
        assert(rows[0], 'Conta não encontrada.', 404);
        await saveProofs();
        const result = await client.query(
          `INSERT INTO anade.checkins(id,account_id,day,created_at,office,character_name,discord_username,blue,actions_path,blue_path)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *,day::text AS day`,
          [
            entry.id,
            entry.accountId,
            entry.day,
            entry.createdAt,
            entry.office,
            rows[0].name || rows[0].username,
            rows[0].username,
            rows[0].blue || '',
            entry.actionsPath,
            entry.bluePath,
          ],
        );
        return presentCheckin(result.rows[0]);
      });
    } catch (error) {
      if (error.code === '23505')
        assert(false, 'Você já bateu ponto hoje. Seu registro está no histórico.', 409);
      throw error;
    }
  }
  async listCheckins({ userId = '', day = '', memberId = '', office = '', page = 0 }) {
    const values = [];
    const conditions = [];
    for (const [column, value] of [
      ['account_id', userId || memberId],
      ['day', day],
      ['office', office],
    ]) {
      if (value) {
        values.push(value);
        conditions.push(`${column}=$${values.length}`);
      }
    }
    values.push(CHECKIN_PAGE_SIZE + 1, page * CHECKIN_PAGE_SIZE);
    const result = await this.pool.query(
      `SELECT *,day::text AS day FROM anade.checkins ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC,id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      records: result.rows.slice(0, CHECKIN_PAGE_SIZE).map(presentCheckin),
      hasMore: result.rows.length > CHECKIN_PAGE_SIZE,
    };
  }
  async checkinProof(id, kind, userId, admin) {
    const { rows } = await this.pool.query(
      'SELECT account_id,actions_path,blue_path FROM anade.checkins WHERE id=$1',
      [id],
    );
    const record = rows[0];
    assert(record && (record.account_id === userId || admin), 'Comprovante não encontrado.', 404);
    return kind === 'actions' ? record.actions_path : record.blue_path;
  }
  async checkinRanking({ since, until, page }) {
    const [ranking, summary] = await Promise.all([
      this.pool.query(
        `WITH totals AS (
        SELECT account_id, count(*)::int AS points, max(day)::text AS last_day
        FROM anade.checkins WHERE ($1::date IS NULL OR day >= $1::date) AND day <= $2::date GROUP BY account_id
      ), ranked AS (SELECT *, rank() OVER (ORDER BY points DESC)::int AS position FROM totals)
      SELECT r.*, coalesce(nullif(p.data->>'name',''),nullif(a.username,''),'Filiado sem ficha') AS name,
        a.username AS discord, m.path AS avatar_path
      FROM ranked r JOIN anade.accounts a ON a.id=r.account_id
      LEFT JOIN anade.profiles p ON p.account_id=r.account_id
      LEFT JOIN anade.profile_media m ON m.account_id=r.account_id AND m.kind='avatar'
      ORDER BY r.points DESC, name, r.account_id LIMIT $3 OFFSET $4`,
        [since, until, RANKING_PAGE_SIZE + 1, page * RANKING_PAGE_SIZE],
      ),
      this.pool.query(
        'SELECT count(*)::int AS points, count(DISTINCT account_id)::int AS participants FROM anade.checkins WHERE ($1::date IS NULL OR day >= $1::date) AND day <= $2::date',
        [since, until],
      ),
    ]);
    return {
      records: ranking.rows.slice(0, RANKING_PAGE_SIZE).map((row) => ({
        memberId: row.account_id,
        name: row.name,
        discord: row.discord,
        points: row.points,
        position: row.position,
        lastDay: row.last_day,
        avatarUrl: profileMediaUrl(row.account_id, 'avatar', row.avatar_path),
      })),
      hasMore: ranking.rows.length > RANKING_PAGE_SIZE,
      summary: summary.rows[0],
    };
  }
  async snapshot() {
    const [profiles, meetings, attendance, polls, options, votes, directors] = await Promise.all([
      this.pool.query(
        "SELECT p.account_id, p.data, p.created_at, a.username, r.office AS assigned_office,r.office_state,r.functions,r.function_state, avatar.path AS avatar_path, banner.path AS banner_path FROM anade.profiles p JOIN anade.accounts a ON a.id=p.account_id LEFT JOIN anade.member_assignments r ON r.account_id=a.id LEFT JOIN anade.profile_media avatar ON avatar.account_id=a.id AND avatar.kind='avatar' LEFT JOIN anade.profile_media banner ON banner.account_id=a.id AND banner.kind='banner' ORDER BY p.created_at",
      ),
      this.pool.query('SELECT * FROM anade.meetings ORDER BY starts_at'),
      this.pool.query('SELECT * FROM anade.attendance'),
      this.pool.query('SELECT * FROM anade.polls ORDER BY created_at'),
      this.pool.query('SELECT * FROM anade.poll_options ORDER BY option_index'),
      this.pool.query('SELECT * FROM anade.votes'),
      this.pool.query('SELECT * FROM anade.directors ORDER BY position, title, id'),
    ]);
    return {
      directors: directors.rows.map((d) => ({
        id: d.id,
        memberId: d.member_id,
        title: d.title,
        responsibility: d.responsibility,
        position: d.position,
      })),
      members: profiles.rows.map((p) => ({
        ...p.data,
        office: p.assigned_office || '',
        officeState: p.office_state || '',
        functions: p.functions || [],
        functionState: p.function_state || '',
        avatarUrl: profileMediaUrl(p.account_id, 'avatar', p.avatar_path),
        bannerUrl: profileMediaUrl(p.account_id, 'banner', p.banner_path),
        id: p.account_id,
        discord: p.username,
        joinedAt: new Date(p.created_at).toISOString(),
      })),
      meetings: meetings.rows.map((m) => ({
        id: m.id,
        groupId: m.group_id || '',
        title: m.title,
        date: new Date(m.starts_at).toISOString(),
        location: m.location,
        agenda: m.agenda,
        minutes: m.minutes,
        meetUrl: m.meet_url || '',
        docsUrl: m.minutes_document_url || '',
        attendance: attendance.rows.filter((a) => a.meeting_id === m.id).map((a) => a.account_id),
      })),
      polls: polls.rows.map((p) => ({
        id: p.id,
        governance: p.governance || undefined,
        title: p.title,
        description: p.description,
        deadline: new Date(p.deadline).toISOString(),
        secret: p.secret,
        closed: p.closed,
        author: p.author_id,
        createdAt: new Date(p.created_at).toISOString(),
        options: options.rows.filter((o) => o.poll_id === p.id).map((o) => o.label),
        votes: Object.fromEntries(
          votes.rows.filter((v) => v.poll_id === p.id).map((v) => [v.account_id, v.option_index]),
        ),
      })),
    };
  }
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  async saveDirector(d, updating = false) {
    try {
      if (updating) {
        const result = await this.pool.query(
          'UPDATE anade.directors SET member_id=$2,title=$3,responsibility=$4,position=$5 WHERE id=$1',
          [d.id, d.memberId, d.title, d.responsibility, d.position],
        );
        assert(result.rowCount, 'Diretor não encontrado.', 404);
      } else {
        await this.pool.query(
          'INSERT INTO anade.directors(id,member_id,title,responsibility,position) VALUES($1,$2,$3,$4,$5)',
          [d.id, d.memberId, d.title, d.responsibility, d.position],
        );
      }
    } catch (e) {
      if (e.code === '23503') assert(false, 'Escolha um filiado com ficha cadastrada.');
      if (e.code === '23505') assert(false, 'Este filiado já ocupa esse cargo.', 409);
      throw e;
    }
  }
  async removeDirector(id) {
    const result = await this.pool.query('DELETE FROM anade.directors WHERE id=$1', [id]);
    assert(result.rowCount, 'Diretor não encontrado.', 404);
  }
  async createMeeting(m, author) {
    await this.pool.query(
      'INSERT INTO anade.meetings(id,title,starts_at,location,agenda,author_id,meet_url,minutes_document_url,minutes,group_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        m.id,
        m.title,
        m.date,
        m.location,
        JSON.stringify(m.agenda),
        author,
        m.meetUrl || '',
        m.docsUrl || '',
        m.minutes || '',
        m.groupId || null,
      ],
    );
  }
  async updateMeeting(id, m) {
    const result = await this.pool.query(
      'UPDATE anade.meetings SET title=$2,starts_at=$3,location=$4,agenda=$5,meet_url=$6,minutes_document_url=$7,minutes=$8,group_id=$9 WHERE id=$1',
      [
        id,
        m.title,
        m.date,
        m.location,
        JSON.stringify(m.agenda),
        m.meetUrl,
        m.docsUrl,
        m.minutes,
        m.groupId || null,
      ],
    );
    assert(result.rowCount, 'Reunião não encontrada.', 404);
  }
  async attendance(id, userId, confirm) {
    await this.transaction(async (c) => {
      const { rows } = await c.query(
        'SELECT starts_at FROM anade.meetings WHERE id=$1 FOR UPDATE',
        [id],
      );
      assert(rows.length, 'Reunião não encontrada.', 404);
      assert(new Date(rows[0].starts_at).getTime() > Date.now(), 'Esta reunião já começou.', 409);
      if (confirm)
        await c.query(
          'INSERT INTO anade.attendance(meeting_id,account_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [id, userId],
        );
      else
        await c.query('DELETE FROM anade.attendance WHERE meeting_id=$1 AND account_id=$2', [
          id,
          userId,
        ]);
    });
  }
  async minutes(id, minutes) {
    const result = await this.pool.query('UPDATE anade.meetings SET minutes=$2 WHERE id=$1', [
      id,
      minutes,
    ]);
    assert(result.rowCount, 'Reunião não encontrada.', 404);
  }
  async createPoll(p) {
    await this.transaction(async (c) => {
      await c.query(
        'INSERT INTO anade.polls(id,title,description,deadline,secret,author_id,governance) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          p.id,
          p.title,
          p.description,
          p.deadline,
          p.secret,
          p.author,
          p.governance ? JSON.stringify(p.governance) : null,
        ],
      );
      for (let i = 0; i < p.options.length; i++)
        await c.query(
          'INSERT INTO anade.poll_options(poll_id,option_index,label) VALUES($1,$2,$3)',
          [p.id, i, p.options[i]],
        );
    });
  }
  async vote(id, userId, option) {
    try {
      await this.transaction(async (c) => {
        const { rows } = await c.query('SELECT * FROM anade.polls WHERE id=$1 FOR UPDATE', [id]);
        assert(rows.length, 'Votação não encontrada.', 404);
        const p = rows[0];
        assertElector(p.governance, userId);
        if (p.governance?.groupId || p.governance?.requiredOffice) {
          const group = p.governance.groupId
            ? await c.query(
                "SELECT data->>'type' AS type FROM anade.organization_records WHERE id=$1 AND kind='group'",
                [p.governance.groupId],
              )
            : { rows: [] };
          await c.query(
            'SELECT account_id FROM anade.member_assignments WHERE account_id=$1 FOR SHARE',
            [userId],
          );
          assertParliamentaryOffice(
            p.governance,
            await this.memberAssignment(userId, c),
            group.rows[0]?.type,
          );
        }
        assert(
          !p.closed && new Date(p.deadline).getTime() > Date.now(),
          'Esta votação está encerrada.',
          409,
        );
        const choices = await c.query(
          'SELECT option_index FROM anade.poll_options WHERE poll_id=$1',
          [id],
        );
        assert(
          Number.isInteger(option) && choices.rows.some((o) => o.option_index === option),
          'Alternativa inválida.',
        );
        await c.query('INSERT INTO anade.votes(poll_id,account_id,option_index) VALUES($1,$2,$3)', [
          id,
          userId,
          option,
        ]);
      });
    } catch (e) {
      if (e.code === '23505') assert(false, 'Seu voto já foi registrado.', 409);
      throw e;
    }
  }
  async closePoll(id) {
    const r = await this.pool.query('UPDATE anade.polls SET closed=true WHERE id=$1', [id]);
    assert(r.rowCount, 'Votação não encontrada.', 404);
  }
}

// Ambiente demonstrativo: memória volátil, sem conexão com registros reais.
export class MemoryRepository {
  constructor(seed = { members: [], meetings: [], polls: [] }) {
    this.data = structuredClone(seed);
    this.data.directors ??= [];
    this.accounts = new Map();
    this.admins = new Set();
    this.adminGrants = [];
    this.checkins = [];
    this.checkinLocks = new Set();
    this.media = new Map();
    this.mediaLocks = new Map();
    this.assignments = new Map();
    this.assignmentHistory = [];
  }
  async memberAssignment(id) {
    return structuredClone(this.assignments.get(id) || emptyAssignment());
  }
  async saveAssignment(id, data, actorId) {
    assert(this.accounts.has(id), 'Conta não encontrada.', 404);
    this.assignmentHistory.push({
      accountId: id,
      actorId,
      previous: await this.memberAssignment(id),
      current: structuredClone(data),
    });
    this.assignments.set(id, structuredClone(data));
  }
  async account(id, username) {
    this.accounts.set(id, username);
  }
  async isAdmin(id) {
    return this.admins.has(id);
  }
  async adminAccounts() {
    return Array.from(this.accounts, ([id, discord]) => ({
      id,
      discord,
      name: this.data.members.find((member) => member.id === id)?.name || '',
      isAdmin: this.admins.has(id),
    }));
  }
  async grantAdmin(id, actorId) {
    assert(
      this.accounts.has(id),
      'Usuário não encontrado. Ele precisa entrar no portal com o Discord pelo menos uma vez.',
      404,
    );
    if (this.admins.has(id)) return false;
    this.admins.add(id);
    this.adminGrants.push({ id: randomUUID(), actorId, targetId: id });
    return true;
  }
  async snapshot() {
    const data = structuredClone(this.data);
    data.members = data.members.map((member) => ({
      ...member,
      ...(this.assignments.get(member.id) || emptyAssignment()),
      avatarUrl: profileMediaUrl(member.id, 'avatar', this.media.get(`${member.id}:avatar`)),
      bannerUrl: profileMediaUrl(member.id, 'banner', this.media.get(`${member.id}:banner`)),
    }));
    return data;
  }
  async profileMedia(id, kind) {
    return this.media.get(`${id}:${kind}`) || null;
  }
  async replaceProfileMedia(id, kind, path, save) {
    const previous = this.mediaLocks.get(id);
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    this.mediaLocks.set(id, waiting);
    await previous;
    try {
      assert(this.accounts.has(id), 'Conta não encontrada.', 404);
      const key = `${id}:${kind}`;
      const old = this.media.get(key) || null;
      await save();
      if (path) this.media.set(key, path);
      else this.media.delete(key);
      return old;
    } finally {
      if (this.mediaLocks.get(id) === waiting) this.mediaLocks.delete(id);
      release();
    }
  }
  async createCheckin(entry, saveProofs) {
    const key = `${entry.accountId}:${entry.day}`;
    assert(
      !this.checkinLocks.has(key) &&
        !this.checkins.some(
          (item) => item.account_id === entry.accountId && item.day === entry.day,
        ),
      'Você já bateu ponto hoje. Seu registro está no histórico.',
      409,
    );
    this.checkinLocks.add(key);
    try {
      assert(this.accounts.has(entry.accountId), 'Conta não encontrada.', 404);
      const profile = this.data.members.find((member) => member.id === entry.accountId);
      await saveProofs();
      const row = {
        id: entry.id,
        account_id: entry.accountId,
        day: entry.day,
        created_at: entry.createdAt,
        office: entry.office,
        character_name: profile?.name || this.accounts.get(entry.accountId),
        discord_username: this.accounts.get(entry.accountId),
        blue: profile?.blue || '',
        actions_path: entry.actionsPath,
        blue_path: entry.bluePath,
      };
      this.checkins.push(row);
      return presentCheckin(row);
    } finally {
      this.checkinLocks.delete(key);
    }
  }
  async listCheckins({ userId = '', day = '', memberId = '', office = '', page = 0 }) {
    const rows = this.checkins
      .filter(
        (row) =>
          (!(userId || memberId) || row.account_id === (userId || memberId)) &&
          (!day || row.day === day) &&
          (!office || row.office === office),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const start = page * CHECKIN_PAGE_SIZE;
    return {
      records: rows.slice(start, start + CHECKIN_PAGE_SIZE).map(presentCheckin),
      hasMore: rows.length > start + CHECKIN_PAGE_SIZE,
    };
  }
  async checkinProof(id, kind, userId, admin) {
    const row = this.checkins.find((record) => record.id === id);
    assert(row && (row.account_id === userId || admin), 'Comprovante não encontrado.', 404);
    return kind === 'actions' ? row.actions_path : row.blue_path;
  }
  async checkinRanking({ since, until, page }) {
    const totals = new Map();
    let points = 0;
    for (const row of this.checkins) {
      if ((since && row.day < since) || row.day > until) continue;
      points++;
      const current = totals.get(row.account_id) || { points: 0, lastDay: '' };
      totals.set(row.account_id, {
        points: current.points + 1,
        lastDay: current.lastDay > row.day ? current.lastDay : row.day,
      });
    }
    const records = Array.from(totals, ([memberId, value]) => ({
      memberId,
      ...value,
      name:
        this.data.members.find((m) => m.id === memberId)?.name ||
        this.accounts.get(memberId) ||
        'Filiado sem ficha',
      discord: this.accounts.get(memberId) || '',
      avatarUrl: profileMediaUrl(memberId, 'avatar', this.media.get(`${memberId}:avatar`)),
      position: 0,
    })).sort(
      (a, b) =>
        b.points - a.points || a.name.localeCompare(b.name) || a.memberId.localeCompare(b.memberId),
    );
    records.forEach((record, index) => {
      record.position =
        index > 0 && records[index - 1].points === record.points
          ? records[index - 1].position
          : index + 1;
    });
    return {
      records: records.slice(page * RANKING_PAGE_SIZE, (page + 1) * RANKING_PAGE_SIZE),
      hasMore: records.length > (page + 1) * RANKING_PAGE_SIZE,
      summary: { points, participants: records.length },
    };
  }
  async saveProfile(id, data) {
    const old = this.data.members.find((m) => m.id === id);
    const m = {
      ...data,
      id,
      discord: this.accounts.get(id),
      joinedAt: old?.joinedAt || new Date().toISOString(),
    };
    if (old) Object.assign(old, m);
    else this.data.members.push(m);
  }
  async saveDirector(d, updating = false) {
    const existing = this.data.directors.find((item) => item.id === d.id);
    if (updating) assert(existing, 'Diretor não encontrado.', 404);
    assert(
      this.data.members.some((m) => m.id === d.memberId),
      'Escolha um filiado com ficha cadastrada.',
    );
    assert(
      !this.data.directors.some(
        (item) => item.id !== d.id && item.memberId === d.memberId && item.title === d.title,
      ),
      'Este filiado já ocupa esse cargo.',
      409,
    );
    if (existing) Object.assign(existing, d);
    else this.data.directors.push(d);
  }
  async removeDirector(id) {
    assert(
      this.data.directors.some((d) => d.id === id),
      'Diretor não encontrado.',
      404,
    );
    this.data.directors = this.data.directors.filter((d) => d.id !== id);
  }
  async createMeeting(m) {
    this.data.meetings.push({
      ...m,
      minutes: m.minutes || '',
      meetUrl: m.meetUrl || '',
      docsUrl: m.docsUrl || '',
      attendance: [],
    });
  }
  async updateMeeting(id, fields) {
    Object.assign(this.meeting(id), fields);
  }
  meeting(id) {
    const m = this.data.meetings.find((m) => m.id === id);
    assert(m, 'Reunião não encontrada.', 404);
    return m;
  }
  async attendance(id, userId, confirm) {
    const m = this.meeting(id);
    assert(Date.parse(m.date) > Date.now(), 'Esta reunião já começou.', 409);
    m.attendance = m.attendance.filter((u) => u !== userId);
    if (confirm) m.attendance.push(userId);
  }
  async minutes(id, minutes) {
    this.meeting(id).minutes = minutes;
  }
  async createPoll(p) {
    this.data.polls.push(p);
  }
  poll(id) {
    const p = this.data.polls.find((p) => p.id === id);
    assert(p, 'Votação não encontrada.', 404);
    return p;
  }
  async vote(id, userId, option) {
    const p = this.poll(id),
      group = this.organization?.records.get(p.governance?.groupId);
    assertParliamentaryOffice(p.governance, await this.memberAssignment(userId), group?.type);
    castVote(p, userId, option);
  }
  async closePoll(id) {
    this.poll(id).closed = true;
  }
}
