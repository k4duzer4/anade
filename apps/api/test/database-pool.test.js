import test from 'node:test';
import assert from 'node:assert/strict';
import { createPool } from '../src/database.js';
test('Vercel usa transaction pooler Supabase e mantém CA, credenciais e destino; desenvolvimento e outros hosts preservam a porta', async () => {
  for (const [connection, serverless, expectedPort] of [
    [
      'postgresql://postgres.project:test-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
      true,
      '6543',
    ],
    [
      'postgresql://postgres.project:test-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      true,
      '6543',
    ],
    [
      'postgresql://postgres.project:test-password@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
      false,
      '5432',
    ],
    ['postgresql://user:test-password@127.0.0.1:5432/postgres', true, '5432'],
  ]) {
    const pool = createPool(connection, { transactionPooler: serverless });
    const original = new URL(connection),
      actual = new URL(pool.options.connectionString);
    assert.equal(actual.port, expectedPort);
    assert.equal(actual.username, original.username);
    assert.equal(actual.password, original.password);
    assert.equal(actual.hostname, original.hostname);
    assert.equal(actual.pathname, original.pathname);
    if (actual.hostname.endsWith('.supabase.com')) {
      assert.equal(pool.options.ssl.rejectUnauthorized, true);
      assert.ok(pool.options.ssl.ca);
    }
    await pool.end();
  }
});
