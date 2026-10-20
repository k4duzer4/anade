import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { httpServerHandler } from 'cloudflare:node';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { createApp } from './app.js';
import { createPool } from './database.js';
import { PgRepository } from './repository.js';

const scope = new AsyncLocalStorage();
const PgStore = connectPgSimple(session);
const requestPool = {
  query: (...args) => scope.getStore().pool.query(...args),
  connect: (...args) => scope.getStore().pool.connect(...args),
};
// A sessão é persistente no PostgreSQL; apenas a conexão pertence a cada requisição.
class RequestSessionStore extends session.Store {
  get(...args) {
    return scope.getStore().store.get(...args);
  }
  set(...args) {
    return scope.getStore().store.set(...args);
  }
  destroy(...args) {
    return scope.getStore().store.destroy(...args);
  }
  touch(...args) {
    return scope.getStore().store.touch(...args);
  }
}
let app;
const requests = new Map();
const server = createServer((req, res) => {
  const context = requests.get(req.headers['x-anade-request']);
  delete req.headers['x-anade-request'];
  if (!context) {
    res.writeHead(503);
    res.end();
    return;
  }
  // A ponte HTTP cria seu próprio recurso assíncrono: reentra explicitamente no contexto.
  scope.run(context, () => app(req, res));
});
const handler = httpServerHandler(server);
export default {
  async fetch(request, env, ctx) {
    try {
      if (!app) {
        if (!env.APP_ORIGIN?.startsWith('https://')) throw new Error('Origem HTTPS obrigatória.');
        app = createApp({
          repo: new PgRepository(requestPool),
          store: new RequestSessionStore(),
          secret: env.SESSION_SECRET,
          origin: env.APP_ORIGIN,
          env: {
            ...env,
            NODE_ENV: 'production',
            TRUST_PROXY: '1',
            DISCORD_REDIRECT_URI:
              env.DISCORD_REDIRECT_URI || `${env.APP_ORIGIN}/auth/discord/callback`,
          },
        });
      }
      const pool = createPool(env.DATABASE_URL, { max: 1 });
      pool.on('error', () => console.error('Conexão PostgreSQL indisponível.'));
      const store = new PgStore({
        pool,
        schemaName: 'anade',
        tableName: 'session',
        createTableIfMissing: false,
        pruneSessionInterval: false,
        errorLog: () => console.error('Sessão PostgreSQL indisponível.'),
      });
      const requestId = randomUUID();
      requests.set(requestId, { pool, store });
      try {
        // O Worker da API é privado; o Worker público substitui os cabeçalhos de proxy.
        const headers = new Headers(request.headers);
        headers.set('X-Forwarded-Proto', 'https');
        if (!headers.get('X-Forwarded-For')) headers.set('X-Forwarded-For', '127.0.0.1');
        headers.set('X-Anade-Request', requestId);
        return await handler.fetch(new Request(request, { headers }), env, ctx);
      } finally {
        requests.delete(requestId);
        ctx.waitUntil(
          pool.end().catch(() => console.error('Falha ao encerrar conexão PostgreSQL.')),
        );
      }
    } catch (error) {
      console.error('API Worker:', error.code || error.name);
      return Response.json(
        { error: 'O portal está temporariamente indisponível.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  },
  async scheduled(_event, env, ctx) {
    const pool = createPool(env.DATABASE_URL, { max: 1 });
    ctx.waitUntil(
      pool.query('DELETE FROM anade.session WHERE expire < NOW()').finally(() => pool.end()),
    );
  },
};
