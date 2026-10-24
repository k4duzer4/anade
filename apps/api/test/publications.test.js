import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newDb } from 'pg-mem';
import { PublicationsStore, publicationWindow } from '../src/publications.js';
test('ciclo do mural é estável entre meia-noite e 8h e vira exatamente às 8h de Brasília', () => {
  assert.equal(
    publicationWindow(new Date('2026-10-24T03:00:00Z')).start,
    '2026-10-23T11:00:00.000Z',
  );
  assert.equal(
    publicationWindow(new Date('2026-10-24T10:59:59.999Z')).end,
    '2026-10-24T11:00:00.000Z',
  );
  assert.equal(
    publicationWindow(new Date('2026-10-24T11:00:00Z')).start,
    '2026-10-24T11:00:00.000Z',
  );
});
test('PostgreSQL persiste e pagina links, aplica unicidade por ciclo e remove ciclos vencidos', async () => {
  const db = newDb();
  db.public.none(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
  db.public.none(
    (await readFile(new URL('../db/011_community.sql', import.meta.url), 'utf8')).split(
      'ALTER TABLE',
    )[0],
  );
  db.public.none(
    (await readFile(new URL('../db/014_publications.sql', import.meta.url), 'utf8')).split(
      'ALTER TABLE',
    )[0],
  );
  const { Pool } = db.adapters.createPg(),
    pool = new Pool(),
    store = new PublicationsStore({ pool });
  try {
    await pool.query("INSERT INTO anade.accounts(id,username) VALUES('a','alice'),('b','bob')");
    const period = publicationWindow(new Date('2026-10-24T12:00Z'));
    const data = {
      ownerId: 'a',
      type: 'post',
      title: 'Post',
      url: 'https://example.com/post',
      periodStart: period.start,
      createdAt: period.start,
    };
    const id = await store.save(data);
    await assert.rejects(store.save(data), /já compartilhou/);
    await assert.rejects(
      store.remove(id, { id: 'b', admin: false }, period.start),
      /seus próprios/,
    );
    for (let i = 0; i < 22; i++) await store.save({ ...data, url: `https://example.com/${i}` });
    assert.equal((await store.list(period.start, 0)).length, 21);
    assert.equal((await store.list(period.start, 1)).length, 3);
    assert.equal((await store.list(period.end, 0)).length, 0);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS n FROM anade.daily_publications')).rows[0].n,
      0,
    );
    await store.setStatute({ title: 'Rascunho', body: 'Revisão', published: false });
    assert.equal((await store.statute()).body, 'Revisão');
  } finally {
    await pool.end();
  }
});
