import { readFile } from 'node:fs/promises';
import { DataType } from 'pg-mem';

export async function membershipFixture(db) {
  const migration = await readFile(
    new URL('../../db/006_discord_memberships.sql', import.meta.url),
    'utf8',
  );
  db.public.none('CREATE SCHEMA IF NOT EXISTS anade');
  db.public.registerFunction({
    name: 'jsonb_typeof',
    args: [DataType.jsonb],
    returns: DataType.text,
    implementation: (value) => (Array.isArray(value) ? 'array' : typeof value),
  });
  db.public.none(migration.split('ALTER TABLE')[0]);
  // O emulador não implementa locks; a concorrência é verificada no PostgreSQL real.
  db.public.registerFunction({
    name: 'hashtext',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: () => 0,
  });
  db.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer, DataType.integer],
    returns: DataType.integer,
    implementation: () => 0,
  });
}
