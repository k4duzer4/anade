import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import net, { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { newDb, DataType } from 'pg-mem';
import ts from 'typescript';

// Integração local: Workers reais + protocolo PostgreSQL em memória. Sem contas externas.
const root = fileURLToPath(new URL('../', import.meta.url));
const db = newDb();
db.public.registerFunction({
  name: 'length',
  args: [DataType.text],
  returns: DataType.integer,
  implementation: (value) => Array.from(value).length,
});
db.public.registerFunction({
  name: 'to_timestamp',
  args: [DataType.float],
  returns: DataType.timestamp,
  implementation: (value) => new Date(value * 1000),
});
for (const name of [
  '001_initial.sql',
  '003_abstention.sql',
  '004_meeting_links.sql',
  '005_directors.sql',
]) {
  const sql = await readFile(join(root, 'apps/api/db', name), 'utf8');
  db.public.none(name === '005_directors.sql' ? sql.split('ALTER TABLE')[0] : sql);
}
let sessionReads = 0;
// O wire adapter do pg-mem não compila filtros parametrizados corretamente.
// Materializa os parâmetros no bind, como o adaptador pg do próprio emulador.
const prepare = db.public.prepare.bind(db.public);
db.public.prepare = (sql) => {
  let compiled;
  return {
    describe: () => compiled.describe(),
    bind(values) {
      if (/SELECT sess FROM/i.test(sql)) sessionReads++;
      const typed = sql
        .replace('SELECT $1, to_timestamp($2), $3', 'SELECT $1::json, to_timestamp($2), $3')
        .replace('SET sess=$1,', 'SET sess=$1::json,');
      const literal = typed.replace(/\$(\d+)/g, (_match, number) => {
        const value = values[Number(number) - 1];
        return value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
      });
      compiled = prepare(literal);
      return compiled.bind([]);
    },
  };
};
// O emulador não trata resets de sockets no Windows; conexões Workers podem encerrar assim.
const createTcpServer = net.createServer;
let database;
try {
  net.createServer = (...args) => {
    const server = createTcpServer(...args);
    server.on('connection', (socket) =>
      socket.on('error', (error) => {
        if (error.code !== 'ECONNRESET') throw error;
      }),
    );
    return server;
  };
  database = await db.adapters.bindServer({ host: '127.0.0.1' });
} finally {
  net.createServer = createTcpServer;
}
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const dir = join(root, 'artifacts/cloudflare-test');
await mkdir(dir, { recursive: true });
for (const app of ['web', 'api']) {
  const parsed = ts.parseConfigFileTextToJson(
    'wrangler.jsonc',
    await readFile(join(root, 'apps', app, 'wrangler.jsonc'), 'utf8'),
  );
  assert(!parsed.error, 'Configuração JSONC inválida.');
  const config = parsed.config;
  delete config.$schema;
  config.main = join(root, 'apps', app, config.main);
  if (app === 'web') config.assets.directory = join(root, 'apps/web/.open-next/assets');
  else {
    config.vars = {
      ...config.vars,
      DATABASE_URL: database.postgresConnectionString,
      SESSION_SECRET: 'worker-integration-test-only-at-least-32-characters',
      DISCORD_CLIENT_SECRET: 'test-only',
    };
    delete config.triggers;
  }
  await writeFile(join(dir, `${app}.json`), JSON.stringify(config));
}
const cli = join(root, 'node_modules/wrangler/bin/wrangler.js');
const child = spawn(
  process.execPath,
  [
    cli,
    'dev',
    '--config',
    join(dir, 'web.json'),
    '--config',
    join(dir, 'api.json'),
    '--port',
    String(port),
    '--ip',
    '127.0.0.1',
  ],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
);
let logs = '';
child.stdout.on('data', (value) => {
  logs += value;
});
child.stderr.on('data', (value) => {
  logs += value;
});
const base = `http://127.0.0.1:${port}`;
async function call(path, options = {}) {
  return fetch(base + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) throw new Error(`Wrangler encerrou: ${logs.slice(-4000)}`);
    try {
      ready = (await call('/api/health')).status === 200;
    } catch {
      /* Aguarda o runtime iniciar. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, `Runtime não iniciou. ${logs.slice(-4000)}`);
  for (const path of ['/', '/partido']) assert.equal((await call(path)).status, 200, path);
  for (const path of ['/painel', '/agenda', '/votacoes', '/filiados', '/ficha', '/direcao']) {
    const response = await call(path);
    assert.equal(response.status, 307, path);
    assert.equal(response.headers.get('location'), '/');
  }
  assert.equal((await call('/api/access')).status, 401);
  assert.equal((await call('/api/state')).status, 401);
  assert.equal(
    (
      await call('/api/demo-login', {
        method: 'POST',
        headers: {
          Origin: 'https://anade.example.workers.dev',
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    404,
  );
  const login = await call('/auth/discord');
  assert.equal(login.status, 302, await login.clone().text());
  assert.match(login.headers.get('location'), /^https:\/\/discord.com\/oauth2\/authorize\?/);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  assert.match(login.headers.get('set-cookie'), /Secure/);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const saved = db.public.many('SELECT sess FROM anade.session');
  assert.equal(saved.length, 1);
  assert(saved[0].sess.oauth.state);
  const before = sessionReads;
  const guarded = await call('/painel', { headers: { Cookie: cookie } });
  assert.equal(guarded.status, 307);
  assert(sessionReads > before, 'Layout deve consultar a sessão pelo binding privado.');
  const callback = await call('/auth/discord/callback?state=forged', {
    headers: { Cookie: cookie },
  });
  assert.equal(callback.status, 302);
  assert.match(callback.headers.get('location'), /authError=/);
  assert.equal(db.public.many('SELECT sess FROM anade.session')[0].sess.oauth, undefined);
  console.log(
    'Cloudflare: páginas públicas, rotas privadas, binding, sessão PostgreSQL, cookie seguro e state OAuth validados.',
  );
} catch (error) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  console.error(logs.slice(-5000));
  throw error;
} finally {
  const closed = child.exitCode === null ? once(child, 'close') : Promise.resolve();
  if (child.exitCode === null && process.platform === 'win32') {
    const stop = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    await once(stop, 'close');
  } else if (child.exitCode === null) child.kill('SIGTERM');
  await closed.catch(() => {});
  database.close();
}
