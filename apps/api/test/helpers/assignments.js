import { readFile } from 'node:fs/promises';
import { DataType } from 'pg-mem';
export async function assignmentsFixture(db) {
  db.public.registerFunction({
    name: 'jsonb_typeof',
    args: [DataType.jsonb],
    returns: DataType.text,
    implementation: (value) => (Array.isArray(value) ? 'array' : typeof value),
  });
  db.public.none(
    (await readFile(new URL('../../db/013_assignments.sql', import.meta.url), 'utf8')).split(
      'ALTER TABLE',
    )[0],
  );
}
