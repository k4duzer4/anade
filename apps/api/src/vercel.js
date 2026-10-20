import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { attachDatabasePool } from '@vercel/functions';
import { createApp } from './app.js';
import { createPool } from './database.js';
import { PgRepository } from './repository.js';

const PgStore = connectPgSimple(session);

export function createVercelHandler({
  env = process.env,
  poolFactory = createPool,
  attachPool = attachDatabasePool,
  discord,
} = {}) {
  let app;
  let pool;
  let cleanupAt = 0;
  let cleanup;
  let initializationError;
  // Inicializa uma vez no cold start, antes de processar qualquer requisição.
  try {
    const origin = env.APP_ORIGIN;
    if (!origin?.startsWith('https://') || new URL(origin).origin !== origin)
      throw new Error('APP_ORIGIN HTTPS obrigatória, sem caminho ou barra final.');
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
      throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres.');
    if (!pool) {
      pool = poolFactory(env.DATABASE_URL, { max: 2, idleTimeoutMillis: 5000 });
      pool.on('error', () => console.error('Conexão PostgreSQL indisponível.'));
      attachPool(pool);
    }
    app = createApp({
      repo: new PgRepository(pool),
      store: new PgStore({
        pool,
        schemaName: 'anade',
        tableName: 'session',
        createTableIfMissing: false,
        pruneSessionInterval: false,
        errorLog: () => console.error('Sessão PostgreSQL indisponível.'),
      }),
      secret: env.SESSION_SECRET,
      origin,
      discord,
      env: {
        ...env,
        NODE_ENV: 'production',
        TRUST_PROXY: '1',
        DISCORD_REDIRECT_URI: env.DISCORD_REDIRECT_URI || `${origin}/auth/discord/callback`,
      },
    });
  } catch (error) {
    initializationError = error;
  }
  return async (req, res, next) => {
    try {
      if (initializationError) throw initializationError;
      // Sem timers ou cron: limpa sessões vencidas no máximo uma vez por hora por instância.
      // Aguarda a consulta para a Vercel não suspender a função antes da conclusão.
      if (Date.now() >= cleanupAt && !cleanup) {
        cleanupAt = Date.now() + 3600000;
        cleanup = pool
          .query('DELETE FROM anade.session WHERE expire < NOW()')
          .catch(() => {
            cleanupAt = Date.now() + 60000;
            console.error('Limpeza de sessões indisponível.');
          })
          .finally(() => {
            cleanup = undefined;
          });
      }
      if (cleanup) await cleanup;
      app(req, res, next);
    } catch (error) {
      console.error('API Vercel:', error.code || error.name);
      res.status(503).set('Cache-Control', 'no-store').json({
        error: 'O portal está temporariamente indisponível.',
      });
    }
  };
}
