import { assert } from './domain.js';
import { MAX_PROOF_BYTES } from './checkins.js';

const BUCKET = 'anade-checkins';
export class SupabaseProofStorage {
  constructor(env, request = fetch) {
    this.url = env.SUPABASE_URL?.replace(/\/$/, '');
    this.key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    this.request = request;
    this.ready = null;
  }
  get configured() {
    try {
      return !!this.key && new URL(this.url).protocol === 'https:';
    } catch {
      return false;
    }
  }
  async call(path, options = {}) {
    assert(
      this.configured,
      'O armazenamento dos comprovantes ainda não foi configurado pela administração.',
      503,
    );
    try {
      return await this.request(`${this.url}/storage/v1/${path}`, {
        ...options,
        headers: {
          apikey: this.key,
          ...(!this.key.startsWith('sb_secret_') ? { Authorization: `Bearer ${this.key}` } : {}),
          ...options.headers,
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      assert(false, 'O armazenamento está indisponível. Tente novamente em instantes.', 503);
    }
  }
  async ensureBucket() {
    if (!this.ready)
      this.ready = this.prepareBucket().catch((error) => {
        this.ready = null;
        throw error;
      });
    return this.ready;
  }
  async prepareBucket() {
    let response = await this.call(`bucket/${BUCKET}`);
    if ([400, 404].includes(response.status)) {
      const created = await this.call('bucket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: BUCKET,
          name: BUCKET,
          public: false,
          file_size_limit: MAX_PROOF_BYTES,
          allowed_mime_types: ['image/webp'],
        }),
      });
      // Another function may have created the bucket in the meantime.
      assert(
        created.ok || [400, 409].includes(created.status),
        'Não foi possível preparar o armazenamento privado.',
        503,
      );
      response = await this.call(`bucket/${BUCKET}`);
    }
    assert(response.ok, 'Não foi possível acessar o armazenamento privado.', 503);
    const bucket = await response.json();
    assert(
      bucket.public === false,
      'O bucket de comprovantes deve ser privado. A administração precisa corrigir a configuração.',
      503,
    );
  }
  async put(path, buffer) {
    await this.ensureBucket();
    const response = await this.call(`object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/webp', 'x-upsert': 'false' },
      body: buffer,
    });
    assert(response.ok, 'Não foi possível salvar os prints. Tente novamente.', 503);
  }
  async get(path) {
    await this.ensureBucket();
    const response = await this.call(`object/authenticated/${BUCKET}/${path}`);
    assert(
      response.ok,
      'Comprovante temporariamente indisponível.',
      response.status === 404 ? 404 : 503,
    );
    assert(
      Number(response.headers.get('content-length') || 0) <= MAX_PROOF_BYTES,
      'Comprovante inválido.',
      503,
    );
    const buffer = Buffer.from(await response.arrayBuffer());
    assert(buffer.length <= MAX_PROOF_BYTES, 'Comprovante inválido.', 503);
    return buffer;
  }
  async remove(paths) {
    const response = await this.call(`object/${BUCKET}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths }),
    });
    assert(response.ok, 'Não foi possível limpar os comprovantes pendentes.', 503);
  }
}

export class MemoryProofStorage {
  constructor() {
    this.configured = true;
    this.objects = new Map();
  }
  async put(path, buffer) {
    this.objects.set(path, Buffer.from(buffer));
  }
  async get(path) {
    assert(this.objects.has(path), 'Comprovante não encontrado.', 404);
    return this.objects.get(path);
  }
  async remove(paths) {
    paths.forEach((path) => this.objects.delete(path));
  }
}
