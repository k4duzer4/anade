import pg from 'pg';
export function createPool(connectionString) {
  if (!connectionString)
    throw new Error('Defina DATABASE_URL do PostgreSQL/Supabase ou use npm run demo.');
  const url = new URL(connectionString);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  return new pg.Pool({
    connectionString,
    max: 8,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: local ? false : { rejectUnauthorized: true },
  });
}
