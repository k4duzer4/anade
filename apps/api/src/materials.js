import { randomUUID } from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { assert, text } from './domain.js';

export const MAX_MATERIAL_BYTES = 4 * 1024 * 1024;
export const materialCategories = ['logos', 'panfletos', 'redes', 'apresentacoes', 'outros'];
const PAGE_SIZE = 18;
const validId = (id) =>
  assert(/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id), 'Material não encontrado.', 404);
export function materialFields(input) {
  assert(materialCategories.includes(input.category), 'Escolha uma categoria válida.');
  return {
    title: text(input.title, 140),
    description: text(input.description ?? '', 1500, false),
    category: input.category,
  };
}
export async function validateMaterial(buffer) {
  assert(
    buffer?.length && buffer.length <= MAX_MATERIAL_BYTES,
    'Cada arquivo deve ter até 4 MB.',
    413,
  );
  if (/^%PDF-[12]\.\d/.test(buffer.subarray(0, 8).toString('ascii'))) {
    assert(
      buffer.subarray(-1024).includes(Buffer.from('%%EOF')),
      'O PDF está incompleto ou inválido.',
    );
    return { mime: 'application/pdf', extension: 'pdf' };
  }
  try {
    const image = sharp(buffer, { limitInputPixels: 40000000, failOn: 'error' });
    const meta = await image.metadata();
    assert(
      ['png', 'jpeg', 'webp'].includes(meta.format) && (!meta.pages || meta.pages === 1),
      'Envie PNG, JPG, WebP ou PDF.',
    );
    await image.stats(); // Decode to reject truncated files; keep the original bytes for download.
    return {
      mime: `image/${meta.format}`,
      extension: meta.format === 'jpeg' ? 'jpg' : meta.format,
    };
  } catch (e) {
    if (e.status) throw e;
    assert(false, 'Não foi possível ler o arquivo. Envie PNG, JPG, WebP ou PDF válido.');
  }
}
function present(row) {
  const { file_path: _path, ...safe } = row;
  return {
    id: safe.id,
    title: safe.title,
    description: safe.description,
    category: safe.category,
    fileName: safe.file_name,
    mime: safe.mime,
    bytes: safe.bytes,
    createdAt: new Date(safe.created_at).toISOString(),
    updatedAt: new Date(safe.updated_at).toISOString(),
    downloadUrl: `/api/materials/${safe.id}/file`,
    previewUrl: safe.mime.startsWith('image/') ? `/api/materials/${safe.id}/file?preview=1` : null,
  };
}
export class MaterialsStore {
  constructor(repo) {
    this.sql = repo.pool;
    if (!this.sql) repo.materials ??= new Map();
    this.memory = repo.materials;
  }
  async list({ category, search, page }) {
    let records, total;
    if (this.sql) {
      const params = [category, `%${search.replace(/[\\%_]/g, '\\$&')}%`];
      const where = "($1='' OR category=$1) AND (title ILIKE $2 OR description ILIKE $2)";
      const [items, count] = await Promise.all([
        this.sql.query(
          `SELECT * FROM anade.materials WHERE ${where} ORDER BY created_at DESC,id LIMIT 18 OFFSET $3`,
          [...params, page * PAGE_SIZE],
        ),
        this.sql.query(`SELECT count(*)::int AS total FROM anade.materials WHERE ${where}`, params),
      ]);
      records = items.rows;
      total = count.rows[0].total;
    } else {
      const found = [...this.memory.values()]
        .filter(
          (r) =>
            (!category || r.category === category) &&
            `${r.title} ${r.description}`
              .toLocaleLowerCase('pt-BR')
              .includes(search.toLocaleLowerCase('pt-BR')),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
      records = found.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
      total = found.length;
    }
    return { records: records.map(present), total, page, hasMore: (page + 1) * PAGE_SIZE < total };
  }
  async get(id) {
    validId(id);
    const row = this.sql
      ? (await this.sql.query('SELECT * FROM anade.materials WHERE id=$1', [id])).rows[0]
      : this.memory.get(id);
    assert(row, 'Material não encontrado.', 404);
    return row;
  }
  async create(row) {
    if (this.sql)
      await this.sql.query(
        'INSERT INTO anade.materials(id,title,description,category,file_name,file_path,mime,bytes,author_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)',
        [
          row.id,
          row.title,
          row.description,
          row.category,
          row.file_name,
          row.file_path,
          row.mime,
          row.bytes,
          row.author_id,
          row.created_at,
        ],
      );
    else this.memory.set(row.id, row);
  }
  async update(id, fields, date) {
    validId(id);
    if (this.sql) {
      const r = await this.sql.query(
        'UPDATE anade.materials SET title=$2,description=$3,category=$4,updated_at=$5 WHERE id=$1 RETURNING id',
        [id, fields.title, fields.description, fields.category, date],
      );
      assert(r.rowCount, 'Material não encontrado.', 404);
    } else {
      const row = await this.get(id);
      this.memory.set(id, { ...row, ...fields, updated_at: date });
    }
  }
  async remove(id) {
    validId(id);
    if (this.sql) {
      const r = await this.sql.query('DELETE FROM anade.materials WHERE id=$1 RETURNING *', [id]);
      assert(r.rowCount, 'Material não encontrado.', 404);
      return r.rows[0];
    }
    const row = await this.get(id);
    this.memory.delete(id);
    return row;
  }
}
export function materialsRoutes(app, repo, admin, storage, { now = () => new Date() } = {}) {
  const store = new MaterialsStore(repo);
  app.get('/api/materials', async (req, res) => {
    const category = req.query.category || '',
      search = req.query.search || '',
      page = Number(req.query.page || 0);
    assert(category === '' || materialCategories.includes(category), 'Categoria inválida.');
    assert(typeof search === 'string' && search.length <= 120, 'Busca inválida.');
    assert(Number.isInteger(page) && page >= 0 && page <= 10000, 'Página inválida.');
    res.json({
      ...(await store.list({ category, search, page })),
      storageReady: storage.configured,
    });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MATERIAL_BYTES, files: 1, fields: 3, parts: 4, fieldSize: 6000 },
  }).single('file');
  app.post(
    '/api/materials',
    admin,
    (req, res, next) => {
      assert(storage.configured, 'O armazenamento dos materiais está indisponível.', 503);
      upload(req, res, (e) =>
        next(
          e
            ? Object.assign(
                new Error(
                  e.code === 'LIMIT_FILE_SIZE'
                    ? 'Cada arquivo deve ter até 4 MB.'
                    : 'Envie um arquivo com título, descrição e categoria.',
                ),
                { status: e.code === 'LIMIT_FILE_SIZE' ? 413 : 400 },
              )
            : undefined,
        ),
      );
    },
    async (req, res) => {
      const fields = materialFields(req.body);
      assert(req.file, 'Escolha um arquivo para publicar.');
      const { mime, extension } = await validateMaterial(req.file.buffer);
      const id = randomUUID(),
        path = `${id}/original.${extension}`;
      const baseName =
        req.file.originalname
          .replace(/[\x00-\x1f\x7f/\\]/g, '')
          .replace(/\.[^.]*$/, '')
          .slice(0, 170)
          .trim() || 'material';
      const fileName = `${baseName}.${extension}`;
      try {
        await storage.put(path, req.file.buffer, mime);
        const date = now().toISOString();
        await store.create({
          ...fields,
          id,
          file_name: fileName,
          file_path: path,
          mime,
          bytes: req.file.buffer.length,
          author_id: res.locals.user.id,
          created_at: date,
          updated_at: date,
        });
      } catch (e) {
        await storage.remove([path]).catch(() => console.error('MATERIAL_UPLOAD_CLEANUP_FAILED'));
        throw e;
      }
      res.status(201).json({ id });
    },
  );
  app.put('/api/materials/:id', admin, async (req, res) => {
    await store.update(req.params.id, materialFields(req.body), now().toISOString());
    res.json({ ok: true });
  });
  app.delete('/api/materials/:id', admin, async (req, res) => {
    const row = await store.remove(req.params.id);
    await storage
      .remove([row.file_path])
      .catch(() => console.error('MATERIAL_DELETE_CLEANUP_FAILED'));
    res.json({ ok: true });
  });
  app.get('/api/materials/:id/file', async (req, res) => {
    const row = await store.get(req.params.id);
    const preview = req.query.preview === '1' && row.mime.startsWith('image/');
    const name = encodeURIComponent(row.file_name).replace(
      /['()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16)}`,
    );
    res
      .set('Content-Type', row.mime)
      .set(
        'Content-Disposition',
        `${preview ? 'inline' : 'attachment'}; filename="material.${row.mime === 'application/pdf' ? 'pdf' : row.mime.split('/')[1]}"; filename*=UTF-8''${name}`,
      )
      .set('Content-Security-Policy', "default-src 'none'; sandbox")
      .set('X-Content-Type-Options', 'nosniff')
      .send(await storage.get(row.file_path));
  });
}
