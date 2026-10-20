import { assert, castVote } from './domain.js';
export class PgRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async account(id, username) {
    await this.pool.query(
      'INSERT INTO anade.accounts(id, username) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET username=EXCLUDED.username',
      [id, username],
    );
  }
  async saveProfile(id, data) {
    await this.pool.query(
      'INSERT INTO anade.profiles(account_id,data) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()',
      [id, JSON.stringify(data)],
    );
  }
  async snapshot() {
    const [profiles, meetings, attendance, polls, options, votes, directors] = await Promise.all([
      this.pool.query(
        'SELECT p.account_id, p.data, p.created_at, a.username FROM anade.profiles p JOIN anade.accounts a ON a.id=p.account_id ORDER BY p.created_at',
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
        id: p.account_id,
        discord: p.username,
        joinedAt: new Date(p.created_at).toISOString(),
      })),
      meetings: meetings.rows.map((m) => ({
        id: m.id,
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
      'INSERT INTO anade.meetings(id,title,starts_at,location,agenda,author_id,meet_url,minutes_document_url,minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
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
      ],
    );
  }
  async updateMeeting(id, m) {
    const result = await this.pool.query(
      'UPDATE anade.meetings SET title=$2,starts_at=$3,location=$4,agenda=$5,meet_url=$6,minutes_document_url=$7,minutes=$8 WHERE id=$1',
      [id, m.title, m.date, m.location, JSON.stringify(m.agenda), m.meetUrl, m.docsUrl, m.minutes],
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
        'INSERT INTO anade.polls(id,title,description,deadline,secret,author_id) VALUES($1,$2,$3,$4,$5,$6)',
        [p.id, p.title, p.description, p.deadline, p.secret, p.author],
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
  }
  async account(id, username) {
    this.accounts.set(id, username);
  }
  async snapshot() {
    return structuredClone(this.data);
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
    castVote(this.poll(id), userId, option);
  }
  async closePoll(id) {
    this.poll(id).closed = true;
  }
}
