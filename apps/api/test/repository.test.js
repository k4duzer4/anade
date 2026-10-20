import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { newDb, DataType } from 'pg-mem';
import { PgRepository } from '../src/repository.js';
import { newPoll, profile } from '../src/domain.js';
async function directorsTable(db) {
  // pg-mem não implementa RLS nem os papéis do Supabase; valida o DDL e as consultas.
  const migration = await readFile(new URL('../db/005_directors.sql', import.meta.url), 'utf8');
  db.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value) => Array.from(value).length,
  });
  db.public.none(migration.split('ALTER TABLE')[0]);
}
test('PostgreSQL: migração, fichas, reuniões, alternativas e unicidade do voto', async () => {
  const db = newDb();
  db.public.none(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  const abstentionMigration = await readFile(
    new URL('../db/003_abstention.sql', import.meta.url),
    'utf8',
  );
  db.public.none(abstentionMigration);
  db.public.none(await readFile(new URL('../db/004_meeting_links.sql', import.meta.url), 'utf8'));
  await directorsTable(db);
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const repo = new PgRepository(pool);
  try {
    await repo.account('a', 'direcao');
    await repo.account('b', 'filiado');
    const person = profile({
      name: 'Maria Silva',
      state: 'BA',
      ideology: 'Centro',
      age: 35,
      season: 'Temporada 1',
      degrees: ['Direito'],
      legapp: '(71) 432-653',
    });
    await repo.saveProfile('b', person);
    await repo.saveProfile('b', { ...person, city: 'Salvador' });
    let snapshot = await repo.snapshot();
    assert.equal(snapshot.members.length, 1);
    assert.equal(snapshot.members[0].city, 'Salvador');
    assert.equal(snapshot.members[0].discord, 'filiado');
    const director = {
      id: randomUUID(),
      memberId: 'b',
      title: 'Presidência',
      responsibility: 'Coordenação nacional.',
      position: 1,
    };
    await repo.saveDirector(director);
    await assert.rejects(repo.saveDirector({ ...director, id: randomUUID() }), /já ocupa/);
    await assert.rejects(
      repo.saveDirector({ ...director, id: randomUUID(), memberId: 'missing' }),
      /ficha cadastrada|foreign key constraint/,
    );
    snapshot = await repo.snapshot();
    assert.deepEqual(snapshot.directors, [director]);
    await repo.saveDirector({ ...director, title: 'Secretaria-geral', position: 2 }, true);
    snapshot = await repo.snapshot();
    assert.equal(snapshot.directors[0].title, 'Secretaria-geral');
    assert.equal(snapshot.directors[0].position, 2);
    await repo.removeDirector(director.id);
    await assert.rejects(repo.saveDirector(director, true), /não encontrado/);
    snapshot = await repo.snapshot();
    assert.equal(snapshot.directors.length, 0);
    assert.equal(snapshot.members.length, 1);
    const meeting = {
      id: randomUUID(),
      title: 'Reunião',
      date: new Date(Date.now() + 60000).toISOString(),
      location: 'Discord',
      agenda: ['Primeira pauta'],
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      docsUrl: 'https://docs.google.com/document/d/test-document/edit',
    };
    await repo.createMeeting(meeting, 'a');
    await repo.attendance(meeting.id, 'b', true);
    await repo.attendance(meeting.id, 'b', true);
    await repo.minutes(meeting.id, 'Ata de teste');
    snapshot = await repo.snapshot();
    assert.deepEqual(snapshot.meetings[0].attendance, ['b']);
    assert.equal(snapshot.meetings[0].minutes, 'Ata de teste');
    assert.equal(snapshot.meetings[0].meetUrl, meeting.meetUrl);
    assert.equal(snapshot.meetings[0].docsUrl, meeting.docsUrl);
    await repo.updateMeeting(meeting.id, {
      ...meeting,
      title: 'Reunião atualizada',
      docsUrl: '',
      minutes: 'Notas atualizadas',
    });
    snapshot = await repo.snapshot();
    assert.equal(snapshot.meetings[0].title, 'Reunião atualizada');
    assert.equal(snapshot.meetings[0].docsUrl, '');
    assert.equal(snapshot.meetings[0].meetUrl, meeting.meetUrl);
    assert.deepEqual(snapshot.meetings[0].attendance, ['b']);
    await repo.attendance(meeting.id, 'b', false);
    snapshot = await repo.snapshot();
    assert.deepEqual(snapshot.meetings[0].attendance, []);
    const poll = newPoll(
      {
        title: 'Tema',
        options: ['Sim', 'Não'],
        secret: true,
        deadline: new Date(Date.now() + 60000).toISOString(),
      },
      'a',
    );
    await repo.createPoll(poll);
    await repo.vote(poll.id, 'b', 1);
    await assert.rejects(repo.vote(poll.id, 'b', 0), /já foi registrado/);
    await assert.rejects(repo.vote(poll.id, 'a', 5), /inválida/);
    snapshot = await repo.snapshot();
    assert.deepEqual(snapshot.polls[0].votes, { b: 1 });
    assert.deepEqual(snapshot.polls[0].options, ['Sim', 'Não', 'Abstenção']);
    await repo.closePoll(poll.id);
    await assert.rejects(repo.vote(poll.id, 'a', 0), /encerrada/);
    const fullPoll = newPoll(
      {
        title: 'Dez alternativas',
        options: Array.from({ length: 10 }, (_, i) => `Opção ${i + 1}`),
        deadline: new Date(Date.now() + 60000).toISOString(),
        secret: false,
      },
      'a',
    );
    await repo.createPoll(fullPoll);
    await repo.vote(fullPoll.id, 'b', 10);
    snapshot = await repo.snapshot();
    assert.equal(snapshot.polls.find((p) => p.id === fullPoll.id).votes.b, 10);
    assert.equal(snapshot.polls.find((p) => p.id === fullPoll.id).options[10], 'Abstenção');
  } finally {
    await pool.end();
  }
});
test('migração de abstenção atualiza somente votações abertas e não duplica a opção', async () => {
  const db = newDb();
  db.public.none(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  await directorsTable(db);
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  const repo = new PgRepository(pool);
  try {
    await repo.account('admin', 'direcao');
    const createLegacy = () => {
      const p = newPoll(
        {
          title: 'Votação anterior',
          options: Array.from({ length: 10 }, (_, i) => `Alternativa ${i + 1}`),
          deadline: new Date(Date.now() + 60000).toISOString(),
        },
        'admin',
      );
      p.options.pop();
      return p;
    };
    const open = createLegacy(),
      closed = createLegacy(),
      expired = createLegacy();
    expired.deadline = new Date(Date.now() - 60000).toISOString();
    for (const p of [open, closed, expired]) await repo.createPoll(p);
    await repo.closePoll(closed.id);
    const migration = await readFile(new URL('../db/003_abstention.sql', import.meta.url), 'utf8');
    db.public.none(migration);
    db.public.none(migration);
    const snapshot = await repo.snapshot();
    assert.equal(snapshot.polls.find((p) => p.id === open.id).options.length, 11);
    assert.equal(snapshot.polls.find((p) => p.id === open.id).options.at(-1), 'Abstenção');
    assert.equal(snapshot.polls.find((p) => p.id === closed.id).options.length, 10);
    assert.equal(snapshot.polls.find((p) => p.id === expired.id).options.length, 10);
  } finally {
    await pool.end();
  }
});
