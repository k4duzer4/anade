import { randomUUID } from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { rateLimit } from 'express-rate-limit';
import { assert } from './domain.js';

export const MAX_PROFILE_IMAGE_BYTES = 4 * 1024 * 1024;
export const PROFILE_BUCKET = 'anade-profiles';
export function profileMediaUrl(id, kind, path) {
  return path
    ? `/api/members/${encodeURIComponent(id)}/media/${kind}?v=${path.split('/').at(-1)}`
    : '';
}
export async function optimizeProfileImage(buffer, kind) {
  assert(
    buffer?.length && buffer.length <= MAX_PROFILE_IMAGE_BYTES,
    'Cada imagem deve ter até 4 MB.',
    413,
  );
  try {
    const image = sharp(buffer, { limitInputPixels: 24000000, failOn: 'error' });
    const metadata = await image.metadata();
    assert(
      ['png', 'jpeg', 'webp'].includes(metadata.format) &&
        (!metadata.pages || metadata.pages === 1),
      'Use uma imagem estática em PNG, JPG ou WebP.',
    );
    const result = await image
      .rotate()
      .resize(
        kind === 'avatar'
          ? { width: 512, height: 512, fit: 'cover' }
          : { width: 1920, height: 640, fit: 'cover', withoutEnlargement: true },
      )
      .webp({ quality: 88 })
      .toBuffer();
    assert(
      result.length <= MAX_PROFILE_IMAGE_BYTES,
      'A imagem ficou muito grande. Escolha outra imagem.',
      413,
    );
    return result;
  } catch (error) {
    if (error.status) throw error;
    assert(false, 'Não foi possível ler a imagem. Use um PNG, JPG ou WebP válido.');
  }
}
export function profileMediaRoutes(app, repo, storage) {
  const kind = (value) =>
    assert(['avatar', 'banner'].includes(value), 'Imagem não encontrada.', 404);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PROFILE_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
  }).single('image');
  const limit = rateLimit({
    windowMs: 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Aguarde um minuto antes de trocar as imagens novamente.' },
  });
  app.put(
    '/api/profile/media/:kind',
    limit,
    (req, res, next) => {
      kind(req.params.kind);
      assert(storage.configured, 'O armazenamento das imagens ainda não está disponível.', 503);
      upload(req, res, (error) =>
        next(
          error
            ? Object.assign(
                new Error(
                  error.code === 'LIMIT_FILE_SIZE'
                    ? 'Cada imagem deve ter até 4 MB.'
                    : 'Envie uma única imagem PNG, JPG ou WebP.',
                ),
                { status: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400 },
              )
            : undefined,
        ),
      );
    },
    async (req, res) => {
      assert(req.file, 'Escolha uma imagem para enviar.');
      const buffer = await optimizeProfileImage(req.file.buffer, req.params.kind);
      const path = `${res.locals.user.id}/${req.params.kind}/${randomUUID()}.webp`;
      let started = false;
      let old;
      try {
        old = await repo.replaceProfileMedia(
          res.locals.user.id,
          req.params.kind,
          path,
          async () => {
            started = true;
            await storage.put(path, buffer);
          },
        );
      } catch (error) {
        if (started)
          await storage.remove([path]).catch(() => console.error('PROFILE_MEDIA_CLEANUP_FAILED'));
        throw error;
      }
      if (old)
        await storage.remove([old]).catch(() => console.error('PROFILE_MEDIA_CLEANUP_FAILED'));
      res.json({ ok: true });
    },
  );
  app.delete('/api/profile/media/:kind', limit, async (req, res) => {
    kind(req.params.kind);
    const old = await repo.replaceProfileMedia(
      res.locals.user.id,
      req.params.kind,
      null,
      async () => {},
    );
    if (old) await storage.remove([old]).catch(() => console.error('PROFILE_MEDIA_CLEANUP_FAILED'));
    res.json({ ok: true });
  });
  app.get('/api/members/:id/media/:kind', async (req, res) => {
    kind(req.params.kind);
    const path = await repo.profileMedia(req.params.id, req.params.kind);
    assert(path, 'Imagem não encontrada.', 404);
    res
      .type('image/webp')
      .set('Content-Disposition', `inline; filename="${req.params.kind}.webp"`)
      .send(await storage.get(path));
  });
}
