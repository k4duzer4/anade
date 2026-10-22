import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import session from 'express-session';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { MemoryRepository } from '../src/repository.js';
import { MemoryProofStorage, SupabaseProofStorage } from '../src/proof-storage.js';
import {
  MAX_PROFILE_IMAGE_BYTES,
  optimizeProfileImage,
  PROFILE_BUCKET,
} from '../src/profile-media.js';

const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#09402b' } })
  .png()
  .toBuffer();
const imageBody = (buffer = png) => {
  const body = new FormData();
  body.set('image', new Blob([buffer], { type: 'image/png' }), 'imagem.png');
  return body;
};
async function setup(t, storage = new MemoryProofStorage()) {
  const secret = 'profile-media-test-only-secret-at-least-32';
  const repo = new MemoryRepository();
  const store = new session.MemoryStore();
  for (const id of ['member', 'other']) {
    await repo.account(id, id);
    await repo.saveProfile(id, { name: id, shareLegapp: false });
    await new Promise((resolve, reject) =>
      store.set(
        id,
        {
          cookie: { expires: new Date(Date.now() + 60000) },
          user: { id, member: true, expires: Date.now() + 60000 },
          csrf: 'test-csrf',
        },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
  }
  const server = createApp({ repo, store, secret, env: {}, profileStorage: storage }).listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const call = (path, actor, { method = 'GET', body, headers = {} } = {}) => {
    const signature =
      actor && createHmac('sha256', secret).update(actor).digest('base64').replace(/=+$/, '');
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      body,
      headers: {
        ...(actor ? { Cookie: `anade.sid=${encodeURIComponent(`s:${actor}.${signature}`)}` } : {}),
        Origin: 'http://localhost:3000',
        'X-CSRF-Token': 'test-csrf',
        ...headers,
      },
    });
  };
  return { repo, storage, call };
}
test('foto e banner: somente dono altera; filiados visualizam; trocar/remover preserva a ficha e limpa objetos antigos', async (t) => {
  const { call, repo, storage } = await setup(t);
  assert.equal(
    (await call('/api/profile/media/avatar', null, { method: 'PUT', body: imageBody() })).status,
    401,
  );
  assert.equal(
    (
      await call('/api/profile/media/avatar', 'member', {
        method: 'PUT',
        body: imageBody(),
        headers: { 'X-CSRF-Token': '' },
      })
    ).status,
    403,
  );
  for (const kind of ['avatar', 'banner'])
    assert.equal(
      (await call(`/api/profile/media/${kind}`, 'member', { method: 'PUT', body: imageBody() }))
        .status,
      200,
    );
  const state = await (await call('/api/state', 'other')).json();
  const member = state.members.find((m) => m.id === 'member');
  assert.match(member.avatarUrl, /^\/api\/members\/member\/media\/avatar\?v=/);
  assert.match(member.bannerUrl, /^\/api\/members\/member\/media\/banner\?v=/);
  assert.equal((await call(member.avatarUrl)).status, 401);
  const image = await call(member.avatarUrl, 'other');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('cache-control'), 'no-store');
  assert.match(image.headers.get('content-type'), /image\/webp/);
  const meta = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
  assert.equal(meta.width, 512);
  assert.equal(meta.height, 512);
  assert.equal(meta.exif, undefined);
  assert.equal(
    (await call('/api/members/member/media/avatar', 'other', { method: 'PUT', body: imageBody() }))
      .status,
    404,
  );
  assert.equal(
    (await call('/api/profile/media/avatar', 'other', { method: 'PUT', body: imageBody() })).status,
    200,
  );
  const old = await repo.profileMedia('member', 'avatar');
  assert.equal(
    (await call('/api/profile/media/avatar', 'member', { method: 'PUT', body: imageBody() }))
      .status,
    200,
  );
  assert.equal(storage.objects.has(old), false);
  await repo.saveProfile('member', { name: 'Nome atualizado' });
  assert.ok((await repo.snapshot()).members.find((m) => m.id === 'member').avatarUrl);
  assert.equal(
    (await call('/api/profile/media/avatar', 'member', { method: 'DELETE' })).status,
    200,
  );
  assert.equal((await call('/api/members/member/media/avatar', 'other')).status, 404);
  assert.equal(storage.objects.size, 2);
  assert.ok(await repo.profileMedia('member', 'banner'));
});
test('valida bytes reais, limite de 4 MB, formato e tipo de imagem', async (t) => {
  const { call, storage } = await setup(t);
  assert.equal(
    (
      await call('/api/profile/media/banner', 'member', {
        method: 'PUT',
        body: imageBody(Buffer.alloc(MAX_PROFILE_IMAGE_BYTES + 1)),
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await call('/api/profile/media/banner', 'member', {
        method: 'PUT',
        body: imageBody(Buffer.from('<svg></svg>')),
      })
    ).status,
    400,
  );
  assert.equal(
    (await call('/api/profile/media/invalid', 'member', { method: 'PUT', body: imageBody() }))
      .status,
    404,
  );
  assert.equal(storage.objects.size, 0);
  const exact = Buffer.alloc(MAX_PROFILE_IMAGE_BYTES);
  png.copy(exact);
  assert.equal(
    (await call('/api/profile/media/avatar', 'member', { method: 'PUT', body: imageBody(exact) }))
      .status,
    200,
  );
  const banner = await sharp(await optimizeProfileImage(png, 'banner')).metadata();
  assert.ok(banner.width <= 1920 && banner.height <= 640);
});
test('falha de upload mantém a foto anterior e limpa novo objeto incompleto', async (t) => {
  const { call, repo, storage } = await setup(t);
  await call('/api/profile/media/avatar', 'member', { method: 'PUT', body: imageBody() });
  const old = await repo.profileMedia('member', 'avatar');
  const put = storage.put.bind(storage);
  storage.put = async (path, buffer) => {
    await put(path, buffer);
    throw Object.assign(new Error('Falha temporária.'), { status: 503 });
  };
  assert.equal(
    (await call('/api/profile/media/avatar', 'member', { method: 'PUT', body: imageBody() }))
      .status,
    503,
  );
  assert.equal(await repo.profileMedia('member', 'avatar'), old);
  assert.equal(storage.objects.size, 1);
  assert.ok(storage.objects.has(old));
});
test('bucket de perfis tem limite próprio de 4 MB e permanece privado', async () => {
  const calls = [];
  const storage = new SupabaseProofStorage(
    { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fixture' },
    async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) return Response.json({}, { status: 404 });
      return Response.json({ public: false });
    },
    { bucket: PROFILE_BUCKET, maxBytes: MAX_PROFILE_IMAGE_BYTES },
  );
  await storage.put('test/avatar.webp', png);
  const bucket = JSON.parse(calls[1].options.body);
  assert.equal(bucket.name, 'anade-profiles');
  assert.equal(bucket.public, false);
  assert.equal(bucket.file_size_limit, MAX_PROFILE_IMAGE_BYTES);
  assert.ok(calls.at(-1).url.includes('/object/anade-profiles/'));
});
