import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config } from '../src/proxy';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function request(path: string) {
  return new NextRequest(`https://portal.test${path}`, {
    headers: { Cookie: 'anade.sid=test-session' },
  });
}
it('convidado é reescrito antes da página original, sem transportar queries com identificadores internos', async () => {
  vi.stubEnv('API_ORIGIN', 'https://backend.test');
  const fetchMock = vi.fn(async () =>
    Response.json({ user: { id: 'guest', admin: false, guest: true } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  for (const path of [
    '/agenda?nova=1',
    '/administracao/filiacoes?status=approved',
    '/plenario/unknown?room=secret',
    '/filiados/unknown',
    '/juridico',
    '/financeiro',
    '/partido',
  ]) {
    const result = await proxy(request(path));
    const rewritten = new URL(result.headers.get('x-middleware-rewrite')!);
    expect(rewritten.pathname).toBe('/convidado');
    expect(rewritten.searchParams.get('pagina')).toBe(path.split('?')[0]);
    expect(rewritten.searchParams.has('room')).toBe(false);
    expect(result.headers.get('Cache-Control')).toContain('no-store');
  }
  expect(fetchMock).toHaveBeenCalledWith(
    new URL('https://backend.test/api/access'),
    expect.objectContaining({ cache: 'no-store' }),
  );
  expect(config.matcher).toContain('/administracao/:path*');
  expect(config.matcher).toContain('/filiados/:path*');
});
it('filiado segue o fluxo original; erro de autorização não libera páginas por suposição', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ user: { id: 'member', admin: false } })),
  );
  expect((await proxy(request('/agenda'))).headers.get('x-middleware-rewrite')).toBeNull();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'unavailable' }, { status: 503 })),
  );
  expect((await proxy(request('/agenda'))).status).toBe(503);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ user: { guest: true } })),
  );
  expect((await proxy(request('/agenda'))).status).toBe(503);
});
