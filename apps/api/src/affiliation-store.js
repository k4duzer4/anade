import { randomUUID } from 'node:crypto';
import { assert, text, profile, degrees } from './domain.js';

export const LEGAL_VERSION = '2026-10-26';
export const partyCurrents = [
  'Comunismo',
  'Socialismo democrático',
  'Trabalhismo',
  'Social-democracia',
  'Desenvolvimentismo',
  'Ecossocialismo',
  'Esquerda libertária',
  'Progressismo',
];
export function affiliationForm(input) {
  assert(
    input?.accepted === true && input.legalVersion === LEGAL_VERSION,
    'Leia e aceite os Termos de Uso e a Política de Privacidade atuais.',
  );
  const result = profile({
    ...input,
    ideology: 'Centro',
    season: 'Temporada 1',
    shareLegapp: false,
  });
  assert(
    result.city && result.blue && result.legapp,
    'Informe cidade, Blue e número LegApp do personagem.',
  );
  assert(
    result.degrees.length > 0 && result.degrees.every((d) => degrees.includes(d)),
    'Informe a formação do personagem.',
  );
  const email = text(input.email, 160);
  assert(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    'Informe o e-mail do personagem dentro do Legado.',
  );
  const current = text(input.current, 80);
  assert(partyCurrents.includes(current), 'Escolha uma corrente da ANADE.');
  return {
    name: result.name,
    city: result.city,
    state: result.state,
    age: result.age,
    degrees: result.degrees,
    legapp: result.legapp,
    blue: result.blue,
    email,
    current,
    plans: text(input.plans, 1500),
    contribution: text(input.contribution, 1500),
    legalVersion: LEGAL_VERSION,
  };
}
export function initialProfile(data) {
  // Dados da candidatura, e-mail e aceite não são publicados na ficha.
  return {
    name: data.name,
    city: data.city,
    state: data.state,
    age: data.age,
    degrees: data.degrees,
    legapp: data.legapp,
    blue: data.blue,
    shareLegapp: false,
    ideology: '',
    profession: '',
    season: 'Temporada 1',
    oab: '',
    bio: '',
  };
}
function present(row) {
  return (
    row && {
      id: row.id,
      accountId: row.account_id,
      discord: row.username,
      data: row.data,
      status: row.status,
      submittedAt: new Date(row.submitted_at).toISOString(),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
      reviewedBy: row.reviewed_by,
      reviewNote: row.review_note,
      deliveries: row.deliveries,
    }
  );
}
export class AffiliationStore {
  constructor(repo, client) {
    this.repo = repo;
    this.sql = client || repo.pool;
    if (!this.sql && !repo.affiliations)
      repo.affiliations = { requests: new Map(), access: new Map(), queue: Promise.resolve() };
  }
  async atomic(accountId, fn) {
    if (this.sql)
      return this.repo.transaction(async (client) => {
        await client.query('SELECT id FROM anade.accounts WHERE id=$1 FOR UPDATE', [accountId]);
        return fn(new AffiliationStore(this.repo, client));
      });
    const state = this.repo.affiliations;
    const task = state.queue.then(async () => {
      const backup = structuredClone({
        requests: state.requests,
        access: state.access,
        members: this.repo.data.members,
      });
      try {
        return await fn(this);
      } catch (error) {
        state.requests = backup.requests;
        state.access = backup.access;
        this.repo.data.members = backup.members;
        throw error;
      }
    });
    state.queue = task.catch(() => {});
    return task;
  }
  async access(id, fallback) {
    if (!this.sql) return this.repo.affiliations.access.get(id) ?? fallback;
    const { rows } = await this.sql.query(
      'SELECT active FROM anade.affiliation_access WHERE account_id=$1',
      [id],
    );
    return rows[0]?.active ?? fallback;
  }
  async get(id) {
    if (!this.sql) return structuredClone(this.repo.affiliations.requests.get(id) || null);
    const { rows } = await this.sql.query(
      'SELECT r.*,a.username FROM anade.affiliation_requests r JOIN anade.accounts a ON a.id=r.account_id WHERE r.id=$1',
      [id],
    );
    return present(rows[0]);
  }
  async latest(accountId) {
    if (!this.sql)
      return structuredClone(
        [...this.repo.affiliations.requests.values()]
          .filter((r) => r.accountId === accountId)
          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] || null,
      );
    const { rows } = await this.sql.query(
      'SELECT r.*,a.username FROM anade.affiliation_requests r JOIN anade.accounts a ON a.id=r.account_id WHERE r.account_id=$1 ORDER BY r.submitted_at DESC,r.id DESC LIMIT 1',
      [accountId],
    );
    return present(rows[0]);
  }
  async save(record) {
    if (!this.sql) {
      this.repo.affiliations.requests.set(record.id, structuredClone(record));
      return;
    }
    await this.sql.query(
      `INSERT INTO anade.affiliation_requests(id,account_id,data,status,submitted_at,reviewed_at,reviewed_by,review_note,deliveries)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,reviewed_at=EXCLUDED.reviewed_at,reviewed_by=EXCLUDED.reviewed_by,review_note=EXCLUDED.review_note,deliveries=EXCLUDED.deliveries`,
      [
        record.id,
        record.accountId,
        JSON.stringify(record.data),
        record.status,
        record.submittedAt,
        record.reviewedAt,
        record.reviewedBy,
        record.reviewNote,
        JSON.stringify(record.deliveries),
      ],
    );
  }
  async setAccess(record, active) {
    if (!this.sql) {
      this.repo.affiliations.access.set(record.accountId, active);
      return;
    }
    await this.sql.query(
      'INSERT INTO anade.affiliation_access(account_id,active,request_id) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET active=EXCLUDED.active,request_id=EXCLUDED.request_id,changed_at=now()',
      [record.accountId, active, record.id],
    );
  }
  async submit(user, data, now) {
    return this.atomic(user.id, async (s) => {
      assert(
        !(await s.access(user.id, user.member === true)),
        'Você já possui filiação ativa.',
        409,
      );
      const latest = await s.latest(user.id);
      assert(latest?.status !== 'pending', 'Sua solicitação já está em análise.', 409);
      const record = {
        id: randomUUID(),
        accountId: user.id,
        discord: user.discord,
        data: { ...data, acceptedAt: now.toISOString() },
        status: 'pending',
        submittedAt: new Date(
          Math.max(now.getTime(), latest ? Date.parse(latest.submittedAt) + 1 : 0),
        ).toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: '',
        deliveries: {},
      };
      await s.save(record);
      return record;
    });
  }
  async decide(id, actor, decision, note, now) {
    const found = await this.get(id);
    assert(found, 'Solicitação não encontrada.', 404);
    return this.atomic(found.accountId, async (s) => {
      const record = await s.get(id);
      assert(record.accountId !== actor, 'Outro administrador deve analisar sua solicitação.', 403);
      if (record.status === decision) return record;
      assert(record.status === 'pending', 'Esta solicitação já foi concluída.', 409);
      record.status = decision;
      record.reviewedAt = now.toISOString();
      record.reviewedBy = actor;
      record.reviewNote = note;
      if (decision === 'approved') {
        if (s.sql)
          await s.sql.query(
            'INSERT INTO anade.profiles(account_id,data) VALUES($1,$2) ON CONFLICT(account_id) DO NOTHING',
            [record.accountId, JSON.stringify(initialProfile(record.data))],
          );
        else if (!this.repo.data.members.some((m) => m.id === record.accountId))
          await this.repo.saveProfile(record.accountId, initialProfile(record.data));
        await s.setAccess(record, true);
        record.deliveries = {
          role: { state: 'pending', attempts: 0 },
          dm: { state: 'pending', attempts: 0 },
        };
      }
      await s.save(record);
      return record;
    });
  }
  async withdraw(id, user, now) {
    return this.atomic(user, async (s) => {
      const record = await s.get(id);
      assert(record?.accountId === user, 'Solicitação não encontrada.', 404);
      assert(record.status === 'pending', 'Só é possível retirar solicitações em análise.', 409);
      record.status = 'withdrawn';
      record.reviewedAt = now.toISOString();
      await s.save(record);
      return record;
    });
  }
  async list(status, page) {
    if (!this.sql) {
      const all = [...this.repo.affiliations.requests.values()]
        .filter((r) => r.status === status)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
      return { requests: structuredClone(all.slice(page * 20, page * 20 + 20)), total: all.length };
    }
    const { rows } = await this.sql.query(
      'SELECT r.*,a.username FROM anade.affiliation_requests r JOIN anade.accounts a ON a.id=r.account_id WHERE r.status=$1 ORDER BY r.submitted_at,r.id LIMIT 20 OFFSET $2',
      [status, page * 20],
    );
    const count = await this.sql.query(
      'SELECT count(*)::int AS total FROM anade.affiliation_requests WHERE status=$1',
      [status],
    );
    return { requests: rows.map(present), total: count.rows[0].total };
  }
  async delivery(id, kind, change) {
    const found = await this.get(id);
    assert(found?.status === 'approved', 'Filiação aprovada não encontrada.', 404);
    return this.atomic(found.accountId, async (s) => {
      const record = await s.get(id);
      const result = change(record.deliveries[kind]);
      if (result) {
        record.deliveries[kind] = result;
        await s.save(record);
      }
      return result;
    });
  }
}
