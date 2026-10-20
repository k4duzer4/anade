import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 3001) {
  throw new Error('PORT deve ser uma porta válida e diferente da porta interna 3001.');
}
const origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
if (!origin || new URL(origin).origin !== origin || !origin.startsWith('https://')) {
  throw new Error(
    'Defina APP_ORIGIN ou RENDER_EXTERNAL_URL com a origem pública HTTPS, sem caminho ou barra final.',
  );
}
const env = {
  ...process.env,
  NODE_ENV: 'production',
  APP_ORIGIN: origin,
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || `${origin}/auth/discord/callback`,
  API_ORIGIN: 'http://127.0.0.1:3001',
};
const children = new Set();
let stopping = false;
let timer;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 10000);
  timer.unref();
}
function launch(name, args, cwd, childEnv) {
  const child = spawn(process.execPath, args, { cwd, env: childEnv, stdio: 'inherit' });
  children.add(child);
  child.on('error', (error) => {
    console.error(`Falha ao iniciar ${name}: ${error.code || error.name}`);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${name} encerrou; finalizando o serviço para permitir a reinicialização.`);
      stop(code || 1);
    }
  });
  child.on('close', () => {
    children.delete(child);
    if (!children.size) clearTimeout(timer);
  });
}
process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
// Somente Next recebe tráfego público. Express continua restrito ao loopback.
launch('API', ['src/index.js'], `${root}apps/api`, { ...env, PORT: '3001' });
launch(
  'Next.js',
  [require.resolve('next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', String(port)],
  `${root}apps/web`,
  { ...env, PORT: String(port) },
);
