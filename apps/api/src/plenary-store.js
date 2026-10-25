import { randomUUID } from 'node:crypto';
import { assert } from './domain.js';
import { OrganizationStore } from './organization-store.js';

export const PRESENCE_TTL = 90000;
export async function assertPlenaryVote(repo, meetingId, accountId, sql = repo.pool) {
  const store = new PlenaryStore(repo, sql),
    session = await store.get(meetingId, true);
  const attendee = (await store.attendees(meetingId)).find((a) => a.id === accountId);
  assert(session?.status === 'open', 'O plenário desta votação está encerrado.', 409);
  if (session.groupId)
    assert(
      (await new OrganizationStore(repo, sql).get('group', session.groupId)).memberIds.includes(
        accountId,
      ),
      'Você não participa mais do grupo desta reunião.',
      403,
    );
  assert(
    attendee?.connected &&
      attendee.verified &&
      !attendee.excluded &&
      !attendee.leftAt &&
      Date.parse(attendee.lastSeenAt) > Date.now() - PRESENCE_TTL,
    'Entre no áudio e aguarde a confirmação de presença pela mesa para votar.',
    403,
  );
}
export class PlenaryStore {
  constructor(repo, sql = repo.pool) {
    this.repo = repo;
    this.sql = sql;
    repo.plenaries ??= new Map();
    repo.plenaryAttendees ??= new Map();
  }
  async get(id, lock = false) {
    if (!this.sql) return structuredClone(this.repo.plenaries.get(id) || null);
    const { rows } = await this.sql.query(
      `SELECT room_key,data FROM anade.plenaries WHERE meeting_id=$1${lock ? ' FOR SHARE' : ''}`,
      [id],
    );
    return rows[0] ? { ...rows[0].data, roomKey: rows[0].room_key } : null;
  }
  async save(id, data) {
    const { roomKey = randomUUID(), ...clean } = data;
    if (!this.sql) this.repo.plenaries.set(id, structuredClone({ ...clean, roomKey }));
    else
      await this.sql.query(
        'INSERT INTO anade.plenaries(meeting_id,room_key,data) VALUES($1,$2,$3) ON CONFLICT(meeting_id) DO UPDATE SET room_key=EXCLUDED.room_key,data=EXCLUDED.data,updated_at=now()',
        [id, roomKey, JSON.stringify(clean)],
      );
    return { ...clean, roomKey };
  }
  async attendees(id) {
    if (!this.sql)
      return structuredClone(
        [...this.repo.plenaryAttendees.values()].filter((a) => a.meetingId === id),
      );
    const { rows } = await this.sql.query(
      'SELECT account_id AS id,first_joined_at AS "firstJoinedAt",last_seen_at AS "lastSeenAt",left_at AS "leftAt",connected,verified,verified_by AS "verifiedBy",confirmed_at AS "confirmedAt",hand_raised AS "handRaised",excluded FROM anade.plenary_attendees WHERE meeting_id=$1 ORDER BY first_joined_at,account_id',
      [id],
    );
    return rows.map((a) => ({
      ...a,
      firstJoinedAt: new Date(a.firstJoinedAt).toISOString(),
      lastSeenAt: new Date(a.lastSeenAt).toISOString(),
    }));
  }
  async enter(id, actor, at) {
    const iso = at.toISOString();
    if (!this.sql) {
      const key = `${id}:${actor}`,
        old = this.repo.plenaryAttendees.get(key);
      assert(!old?.excluded, 'Sua entrada neste plenário foi suspensa pela moderação.', 403);
      this.repo.plenaryAttendees.set(key, {
        ...old,
        meetingId: id,
        id: actor,
        firstJoinedAt: old?.firstJoinedAt || iso,
        lastSeenAt: iso,
        connected: false,
        verified: false,
        verifiedBy: null,
        handRaised: false,
        excluded: false,
        leftAt: null,
      });
    } else
      await this.sql.query(
        'INSERT INTO anade.plenary_attendees(meeting_id,account_id,last_seen_at) VALUES($1,$2,$3) ON CONFLICT(meeting_id,account_id) DO UPDATE SET last_seen_at=EXCLUDED.last_seen_at,connected=false,verified=false,verified_by=NULL,hand_raised=false,left_at=NULL',
        [id, actor, iso],
      );
  }
  async updateAttendee(
    id,
    actor,
    { connected, handRaised, excluded, left, verified, verifiedBy },
    at,
  ) {
    const item = (await this.attendees(id)).find((a) => a.id === actor);
    assert(item, 'Entre no áudio antes de confirmar presença.', 409);
    const next = {
      ...item,
      connected: connected ?? item.connected,
      handRaised: handRaised ?? item.handRaised,
      excluded: excluded ?? item.excluded,
      verified: left ? false : (verified ?? item.verified),
      verifiedBy: verifiedBy ?? item.verifiedBy,
      confirmedAt: verified ? item.confirmedAt || at.toISOString() : item.confirmedAt,
      lastSeenAt: at.toISOString(),
      leftAt: left ? at.toISOString() : item.leftAt,
    };
    if (!this.sql) this.repo.plenaryAttendees.set(`${id}:${actor}`, { ...next, meetingId: id });
    else
      await this.sql.query(
        'UPDATE anade.plenary_attendees SET connected=$3,hand_raised=$4,excluded=$5,last_seen_at=$6,left_at=$7,verified=$8,verified_by=$9,confirmed_at=$10 WHERE meeting_id=$1 AND account_id=$2',
        [
          id,
          actor,
          next.connected,
          next.handRaised,
          next.excluded,
          next.lastSeenAt,
          next.leftAt || null,
          next.verified || false,
          next.verifiedBy || null,
          next.confirmedAt || null,
        ],
      );
  }
  async polls(id) {
    if (!this.sql)
      return structuredClone(
        this.repo.data.polls.filter((p) => p.governance?.plenaryMeetingId === id),
      );
    const { rows } = await this.sql.query(
      "SELECT * FROM anade.polls WHERE governance->>'plenaryMeetingId'=$1 ORDER BY created_at DESC LIMIT 50",
      [id],
    );
    if (!rows.length) return [];
    const ids = rows.map((p) => p.id);
    const [options, votes] = await Promise.all([
      this.sql.query(
        'SELECT * FROM anade.poll_options WHERE poll_id=ANY($1::uuid[]) ORDER BY option_index',
        [ids],
      ),
      this.sql.query('SELECT * FROM anade.votes WHERE poll_id=ANY($1::uuid[])', [ids]),
    ]);
    return rows.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      deadline: new Date(p.deadline).toISOString(),
      secret: p.secret,
      closed: p.closed,
      author: p.author_id,
      governance: p.governance,
      options: options.rows.filter((o) => o.poll_id === p.id).map((o) => o.label),
      votes: Object.fromEntries(
        votes.rows.filter((v) => v.poll_id === p.id).map((v) => [v.account_id, v.option_index]),
      ),
    }));
  }
}
