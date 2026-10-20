import pg from 'pg';
export function createPool(connectionString, { max = 8, idleTimeoutMillis = 30000 } = {}) {
  if (!connectionString)
    throw new Error('Defina DATABASE_URL do PostgreSQL/Supabase ou use npm run demo.');
  const url = new URL(connectionString);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  return new pg.Pool({
    connectionString,
    max,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis,
    ssl: local ? false : { rejectUnauthorized: true },
  });
}
