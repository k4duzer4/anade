import { readFile } from 'node:fs/promises';
import { createPool } from '../src/database.js';
const pool = createPool(process.env.DATABASE_URL);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(104201026)');
  await client.query('CREATE SCHEMA IF NOT EXISTS anade');
  await client.query(
    'CREATE TABLE IF NOT EXISTS anade.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of [
    '001_initial.sql',
    '002_access.sql',
    '003_abstention.sql',
    '004_meeting_links.sql',
    '005_directors.sql',
    '006_discord_memberships.sql',
    '007_account_admin.sql',
    '008_admin_grants.sql',
    '009_checkins.sql',
    '010_profile_media.sql',
    '011_community.sql',
    '012_organization.sql',
    '013_assignments.sql',
    '014_publications.sql',
    '015_activity_seen.sql',
    '016_agenda_comments.sql',
    '017_plenary.sql',
    '018_affiliations.sql',
  ]) {
    const previous = await client.query('SELECT name FROM anade.migrations WHERE name=$1', [name]);
    if (previous.rowCount) continue;
    await client.query(await readFile(new URL(`../db/${name}`, import.meta.url), 'utf8'));
    await client.query('INSERT INTO anade.migrations(name) VALUES($1)', [name]);
    console.log(`Aplicada: ${name}`);
  }
  await client.query('COMMIT');
  console.log('Banco da ANADE atualizado.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
