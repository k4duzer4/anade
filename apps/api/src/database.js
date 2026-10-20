import pg from 'pg';
import { readFileSync } from 'node:fs';
export function createPool(connectionString, { max = 8, idleTimeoutMillis = 30000 } = {}) {
  if (!connectionString)
    throw new Error('Defina DATABASE_URL do PostgreSQL/Supabase ou use npm run demo.');
  const url = new URL(connectionString);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const supabase =
    url.hostname.endsWith('.pooler.supabase.com') || url.hostname.endsWith('.supabase.co');
  // O pooler usa a autoridade privada oficial do Supabase. Mantém validação de CA e hostname.
  const ca = supabase
    ? readFileSync(new URL('../certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8')
    : undefined;
  if (supabase) {
    // pg dá precedência a esses parâmetros sobre o objeto ssl e descartaria nossa CA.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'])
      url.searchParams.delete(key);
  }
  return new pg.Pool({
    connectionString: url.toString(),
    max,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis,
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  });
}
