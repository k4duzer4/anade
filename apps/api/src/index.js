import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { randomBytes } from 'node:crypto';
import { createPool } from './database.js';
import { createApp } from './app.js';
import { PgRepository, MemoryRepository } from './repository.js';
import { seed } from './seed.js';
const demo = process.argv.includes('--demo');
if (demo && process.env.NODE_ENV === 'production')
  throw new Error('Demonstração proibida em produção.');
const pool = demo ? null : createPool(process.env.DATABASE_URL);
const Store = connectPgSimple(session);
const repo = demo ? new MemoryRepository(seed()) : new PgRepository(pool);
const store = demo
  ? undefined
  : new Store({ pool, schemaName: 'anade', tableName: 'session', createTableIfMissing: false });
const app = createApp({
  repo,
  store,
  demo,
  secret: demo ? randomBytes(48).toString('hex') : process.env.SESSION_SECRET,
  origin: process.env.APP_ORIGIN || 'http://localhost:3000',
});
const port = Number(process.env.PORT || 3001);
const server = app.listen(port, '127.0.0.1', () =>
  console.log(
    `ANADE API: http://127.0.0.1:${port} (${demo ? 'demonstração em memória' : 'PostgreSQL'})`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      store?.close();
      await pool?.end();
      process.exit(0);
    }),
  );
