import { randomUUID } from 'node:crypto';
import { assert } from './domain.js';
import { emptyAssignment, groupAssignment } from './assignments.js';

const defaults = [
  'Bancada da Câmara',
  'Bancada do Senado',
  'Direção nacional',
  'Jurídico',
  'Comunicação',
  'Tesouraria',
];
const types = ['camara', 'senado', 'direcao', 'juridico', 'comunicacao', 'tesouraria'];
export class OrganizationStore {
  constructor(repo, client) {
    this.repo = repo;
    this.sql = client || repo.pool;
    if (!this.sql && !repo.organization) {
      repo.organization = { records: new Map(), reads: new Map(), queue: Promise.resolve() };
      defaults.forEach((name, i) => {
        const id = `10000000-0000-4000-8000-00000000000${i + 1}`;
        repo.organization.records.set(id, {
          id,
          kind: 'group',
          name,
          type: types[i],
          memberIds: [],
          leaderId: '',
          state: '',
          description: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
      ['Caixa partidário', 'Fundo eleitoral'].forEach((name, i) => {
        const id = `20000000-0000-4000-8000-00000000000${i + 1}`;
        repo.organization.records.set(id, {
          id,
          kind: 'wallet',
          name,
          type: i ? 'fundo' : 'partidario',
          memberIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    }
  }
  async atomic(fn) {
    if (this.sql)
      return this.repo.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(104201027)');
        return fn(new OrganizationStore(this.repo, client));
      });
    const state = this.repo.organization;
    const task = state.queue.then(async () => {
      const backup = structuredClone({ records: state.records, reads: state.reads });
      try {
        return await fn(this);
      } catch (e) {
        Object.assign(state, backup);
        throw e;
      }
    });
    state.queue = task.catch(() => {});
    return task;
  }
  async list(kind) {
    if (!this.sql) {
      const records = structuredClone(
        [...this.repo.organization.records.values()]
          .filter((x) => x.kind === kind)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)),
      );
      return kind === 'group'
        ? records.map((g) =>
            groupAssignment(
              g,
              this.repo.data.members.map((m) => ({
                id: m.id,
                ...(this.repo.assignments.get(m.id) || emptyAssignment()),
              })),
            ),
          )
        : records;
    }
    const { rows } = await this.sql.query(
      'SELECT * FROM anade.organization_records WHERE kind=$1 ORDER BY created_at DESC,id',
      [kind],
    );
    const records = rows.map((x) => ({
      ...x.data,
      id: x.id,
      kind: x.kind,
      createdAt: new Date(x.created_at).toISOString(),
      updatedAt: new Date(x.updated_at).toISOString(),
    }));
    if (kind !== 'group') return records;
    const members = await this.assignmentMembers();
    return records.map((g) => groupAssignment(g, members));
  }
  async assignmentMembers() {
    if (!this.sql)
      return this.repo.data.members.map((m) => ({
        id: m.id,
        ...(this.repo.assignments.get(m.id) || emptyAssignment()),
      }));
    const { rows } = await this.sql.query(
      `SELECT p.account_id AS id,coalesce(a.office,'') AS office,coalesce(a.functions,'[]'::jsonb) AS functions,coalesce(a.function_state,'') AS "functionState" FROM anade.profiles p LEFT JOIN anade.member_assignments a ON a.account_id=p.account_id`,
    );
    return rows;
  }
  async listMany(kinds, members) {
    let records;
    if (!this.sql)
      records = structuredClone(
        [...this.repo.organization.records.values()].filter((r) => kinds.includes(r.kind)),
      );
    else {
      const { rows } = await this.sql.query(
        'SELECT * FROM anade.organization_records WHERE kind=ANY($1::text[]) ORDER BY created_at DESC,id',
        [kinds],
      );
      records = rows.map((r) => ({
        ...r.data,
        id: r.id,
        kind: r.kind,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
      }));
    }
    records.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const assignments = kinds.includes('group') ? members || (await this.assignmentMembers()) : [];
    return Object.fromEntries(
      kinds.map((kind) => [
        kind,
        records
          .filter((r) => r.kind === kind)
          .map((r) => (kind === 'group' ? groupAssignment(r, assignments) : r)),
      ]),
    );
  }
  async get(kind, id) {
    const record = (await this.list(kind)).find((x) => x.id === id);
    assert(record, 'Registro não encontrado.', 404);
    return record;
  }
  async save(kind, data, id = randomUUID()) {
    const { id: _id, kind: _kind, createdAt: _createdAt, updatedAt: _updatedAt, ...clean } = data;
    if (!this.sql) {
      const previous = this.repo.organization.records.get(id);
      this.repo.organization.records.set(id, {
        ...clean,
        id,
        kind,
        createdAt: previous?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else
      await this.sql.query(
        'INSERT INTO anade.organization_records(id,kind,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()',
        [id, kind, JSON.stringify(clean)],
      );
    return id;
  }
  async setting() {
    if (!this.sql) return this.repo.organization.calendar || {};
    const { rows } = await this.sql.query(
      "SELECT value FROM anade.portal_settings WHERE key='legado_calendar'",
    );
    return rows[0]?.value || {};
  }
  async setCalendar(value) {
    if (!this.sql) this.repo.organization.calendar = value;
    else
      await this.sql.query(
        "INSERT INTO anade.portal_settings(key,value) VALUES('legado_calendar',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
        [JSON.stringify(value)],
      );
  }
  async readKeys(accountId) {
    if (!this.sql) return this.repo.organization.reads.get(accountId) || [];
    const { rows } = await this.sql.query(
      'SELECT notification_key FROM anade.notification_reads WHERE account_id=$1',
      [accountId],
    );
    return rows.map((x) => x.notification_key);
  }
  async markRead(accountId, key) {
    if (!this.sql)
      this.repo.organization.reads.set(accountId, [
        ...new Set([...(this.repo.organization.reads.get(accountId) || []), key]),
      ]);
    else
      await this.sql.query(
        'INSERT INTO anade.notification_reads(account_id,notification_key) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [accountId, key],
      );
  }
}
export const belongs = (group, user) => user.admin || group.memberIds.includes(user.id);
export const seesPoll = (poll, user, groups) =>
  !poll.governance?.groupId ||
  user.admin ||
  poll.governance.electorIds.includes(user.id) ||
  groups.some((g) => g.id === poll.governance.groupId && belongs(g, user));
export const seesMeeting = (meeting, user, groups) =>
  !meeting.groupId || groups.some((g) => g.id === meeting.groupId && belongs(g, user));
