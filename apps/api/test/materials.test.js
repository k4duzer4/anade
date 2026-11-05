import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import session from 'express-session';
import sharp from 'sharp';
import { newDb, DataType } from 'pg-mem';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { MemoryProofStorage } from '../src/proof-storage.js';
import { MaterialsStore, validateMaterial, MAX_MATERIAL_BYTES } from '../src/materials.js';
const image = await sharp({
  create: { width: 30, height: 20, channels: 4, background: { r: 0, g: 70, b: 35, alpha: 0.5 } },
})
  .png()
  .toBuffer();
function upload(buffer = image, extra = {}) {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    title: 'Logo transparente',
    description: 'Versão oficial para fundos claros.',
    category: 'logos',
    ...extra,
  }))
    f.set(key, value);
  // Client MIME and extension are deliberately incorrect; bytes determine the file type.
  f.set('file', new Blob([buffer], { type: 'text/html' }), 'logo.html');
  return f;
}
async function setup(t, storage = new MemoryProofStorage()) {
  const repo = new MemoryRepository(),
    store = new session.MemoryStore();
  const secret = 'test-materials-only-session-secret-longer-than-32';
  const cookies = {};
  for (const role of ['admin', 'member', 'guest', 'applicant']) {
    await repo.account(role, role);
    if (role === 'admin') repo.admins.add(role);
    await new Promise((resolve, reject) =>
      store.set(
        role,
        {
          cookie: { expires: new Date(Date.now() + 60000) },
          user: { id: role, member: role !== 'applicant', expires: Date.now() + 60000 },
          csrf: 'csrf-test',
        },
        (e) => (e ? reject(e) : resolve()),
      ),
    );
    const sig = createHmac('sha256', secret).update(role).digest('base64').replace(/=+$/, '');
    cookies[role] = `anade.sid=${encodeURIComponent(`s:${role}.${sig}`)}`;
  }
  repo.guestAccess = { entries: new Map([['guest', true]]), history: [] };
  const server = createApp({ repo, store, secret, env: {}, materialStorage: storage }).listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (path, role = 'member', method = 'GET', body, headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        Cookie: cookies[role] || '',
        Origin: 'http://localhost:3000',
        'X-CSRF-Token': 'csrf-test',
        ...(!(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  return { repo, storage, call };
}
test('acervo: só ADM envia/edita/exclui; filiados baixam originais e convidados não veem arquivos', async (t) => {
  const { call, storage } = await setup(t);
  assert.equal((await call('/api/materials', 'anonymous')).status, 401);
  for (const role of ['guest', 'applicant'])
    assert.equal((await call('/api/materials', role)).status, 403);
  assert.equal((await call('/api/materials', 'member', 'POST', upload())).status, 403);
  assert.equal(
    (await call('/api/materials', 'admin', 'POST', upload(), { 'X-CSRF-Token': '' })).status,
    403,
  );
  const created = await call('/api/materials', 'admin', 'POST', upload());
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const listing = await (await call('/api/materials')).json();
  assert.equal(listing.total, 1);
  const item = listing.records[0];
  assert.equal(item.fileName, 'logo.png');
  assert.equal(item.mime, 'image/png');
  assert.equal('file_path' in item, false);
  assert.equal('author_id' in item, false);
  for (const role of ['guest', 'applicant', 'anonymous'])
    assert.equal((await call(item.downloadUrl, role)).status, role === 'anonymous' ? 401 : 403);
  const download = await call(item.downloadUrl);
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), image);
  assert.equal((await sharp(image).metadata()).hasAlpha, true);
  const preview = await call(item.previewUrl);
  assert.match(preview.headers.get('content-disposition'), /^inline;/);
  const edit = { title: 'Logo principal', description: 'Use sem distorcer.', category: 'outros' };
  assert.equal((await call(`/api/materials/${id}`, 'member', 'PUT', edit)).status, 403);
  assert.equal((await call(`/api/materials/${id}`, 'admin', 'PUT', edit)).status, 200);
  assert.equal(
    (await (await call('/api/materials?search=principal&category=outros')).json()).total,
    1,
  );
  assert.equal((await (await call('/api/materials?category=logos')).json()).total, 0);
  assert.equal((await call(`/api/materials/${id}`, 'member', 'DELETE')).status, 403);
  assert.equal((await call(`/api/materials/${id}`, 'admin', 'DELETE')).status, 200);
  assert.equal(storage.objects.size, 0);
  assert.equal((await call(item.downloadUrl)).status, 404);
});
test('PDF é baixado como anexo, arquivos inválidos e grandes são rejeitados e falhas não deixam objetos', async (t) => {
  const { call, storage, repo } = await setup(t);
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const response = await call(
    '/api/materials',
    'admin',
    'POST',
    upload(pdf, { category: 'panfletos' }),
  );
  assert.equal(response.status, 201);
  const { id } = await response.json();
  const download = await call(`/api/materials/${id}/file?preview=1`);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  for (const invalid of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from('text'),
    Buffer.from('%PDF-1.7\nincomplete'),
  ])
    assert.equal((await call('/api/materials', 'admin', 'POST', upload(invalid))).status, 400);
  assert.equal(
    (await call('/api/materials', 'admin', 'POST', upload(image, { category: 'inventada' })))
      .status,
    400,
  );
  await assert.rejects(validateMaterial(Buffer.alloc(MAX_MATERIAL_BYTES + 1)), /4 MB/);
  const put = storage.put.bind(storage);
  storage.put = async (path, buffer) => {
    await put(path, buffer);
    throw Object.assign(new Error('Storage indisponível'), { status: 503 });
  };
  assert.equal((await call('/api/materials', 'admin', 'POST', upload())).status, 503);
  assert.equal(repo.materials.size, 1);
  assert.equal(storage.objects.size, 1);
});
test('PostgreSQL: acervo pagina, filtra e altera metadados sem expor caminhos internos', async () => {
  const db = newDb();
  db.public.registerFunction({
    name: 'length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (v) => v.length,
  });
  db.public.none('CREATE SCHEMA anade; CREATE TABLE anade.accounts(id text PRIMARY KEY);');
  const ddl = await readFile(new URL('../db/021_materials.sql', import.meta.url), 'utf8');
  db.public.none(ddl.split('ALTER TABLE anade.materials ENABLE')[0]);
  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  try {
    await pool.query("INSERT INTO anade.accounts(id) VALUES('admin')");
    const store = new MaterialsStore({ pool });
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: randomUUID(),
      title: `Material ${i}`,
      description: 'Acervo',
      category: 'logos',
      file_name: 'logo.png',
      file_path: `${i}/logo.png`,
      mime: 'image/png',
      bytes: image.length,
      author_id: 'admin',
      created_at: '2026-11-05T15:00:00.000Z',
      updated_at: '2026-11-05T15:00:00.000Z',
    }));
    for (const row of rows) await store.create(row);
    const first = await store.list({ category: 'logos', search: '', page: 0 }),
      second = await store.list({ category: 'logos', search: '', page: 1 });
    assert.equal(first.total, 20);
    assert.equal(first.records.length, 18);
    assert.equal(first.hasMore, true);
    assert.equal(second.records.length, 2);
    await store.update(
      rows[0].id,
      { title: 'Marca nacional', description: 'Institucional', category: 'outros' },
      new Date().toISOString(),
    );
    const found = await store.list({ category: 'outros', search: 'nacional', page: 0 });
    assert.equal(found.total, 1);
    assert.equal('file_path' in found.records[0], false);
    assert.equal((await store.remove(rows[0].id)).file_path, rows[0].file_path);
    await assert.rejects(store.get(rows[0].id), /não encontrado/);
  } finally {
    await pool.end();
  }
});
