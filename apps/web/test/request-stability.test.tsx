import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { portalRequest, createRefreshQueue } from '../src/lib/portal-request';
import { PortalProvider, usePortal } from '../src/components/portal-provider';
import { StrictMode } from 'react';
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const state = {
  serverTime: '2026-10-25T14:00Z',
  csrf: 'csrf',
  user: { id: 'member' },
  members: [],
  polls: [],
  meetings: [],
  directors: [],
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
beforeEach(() => vi.clearAllMocks());
it('consultas concorrentes se agrupam e alterações exigem uma leitura posterior à que estava pendente', async () => {
  const release: Array<() => void> = [],
    work = vi.fn(() => new Promise<void>((resolve) => release.push(resolve))),
    refresh = createRefreshQueue(work);
  const first = refresh(),
    second = refresh(),
    afterWrite = refresh(true);
  expect(work).toHaveBeenCalledTimes(1);
  expect(second).toBe(first);
  expect(afterWrite).toBe(first);
  release.shift()!();
  await Promise.resolve();
  expect(work).toHaveBeenCalledTimes(2);
  release.shift()!();
  await first;
  const next = refresh();
  expect(work).toHaveBeenCalledTimes(3);
  release.shift()!();
  await next;
});
it('timeout cancela a consulta; alterações não são reenviadas automaticamente', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(
    (_url, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        ),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const request = portalRequest('/api/profile', {
    method: 'PUT',
    body: { name: 'Maria' },
    timeoutMs: 100,
  });
  const rejected = expect(request).rejects.toThrow('Confira se ela foi aplicada');
  await vi.advanceTimersByTimeAsync(100);
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
function Probe() {
  const { data, refresh, logout, error } = usePortal();
  return (
    <>
      <output>{data?.user.id || error || 'empty'}</output>
      <button onClick={() => void refresh()}>Refresh</button>
      <button onClick={() => void logout()}>Logout</button>
    </>
  );
}
it('resposta antiga não restaura dados privados depois do logout', async () => {
  let finish: ((value: Response) => void) | undefined,
    reads = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (url === '/api/config') return Promise.resolve(json({}));
      if (url === '/api/activity') return Promise.resolve(json({ sections: {} }));
      if (url === '/api/logout') return Promise.resolve(json({ ok: true }));
      if (++reads === 1) return Promise.resolve(json(state));
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    }),
  );
  const user = userEvent.setup();
  render(
    <PortalProvider>
      <Probe />
    </PortalProvider>,
  );
  await screen.findByText('member');
  await user.click(screen.getByRole('button', { name: 'Refresh' }));
  await user.click(screen.getByRole('button', { name: 'Logout' }));
  await screen.findByText('empty');
  await act(async () => finish!(json(state)));
  expect(screen.queryByText('member')).toBeNull();
});
it('Strict Mode recupera inicialização cancelada sem repetir consultas indefinidamente', async () => {
  const fetcher = vi.fn(
    (url, options) =>
      new Promise<Response>((resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
        queueMicrotask(() => {
          if (!options.signal?.aborted)
            resolve(
              json(url === '/api/state' ? state : url === '/api/activity' ? { sections: {} } : {}),
            );
        });
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  render(
    <StrictMode>
      <PortalProvider>
        <Probe />
      </PortalProvider>
    </StrictMode>,
  );
  await screen.findByText('member');
  expect(fetcher.mock.calls.filter(([url]) => url === '/api/state').length).toBeLessThanOrEqual(2);
});
it('aba oculta pausa polling; voltar à aba realiza uma única atualização', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-25T14:00:00Z'));
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const fetcher = vi.fn(async (url) =>
    json(url === '/api/state' ? state : url === '/api/activity' ? { sections: {} } : {}),
  );
  vi.stubGlobal('fetch', fetcher);
  await act(async () => {
    render(
      <PortalProvider>
        <Probe />
      </PortalProvider>,
    );
  });
  const initial = fetcher.mock.calls.filter(([url]) => url === '/api/state').length;
  visibility.mockReturnValue('hidden');
  await act(async () => {
    vi.advanceTimersByTime(120000);
  });
  expect(fetcher.mock.calls.filter(([url]) => url === '/api/state').length).toBe(initial);
  visibility.mockReturnValue('visible');
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  expect(fetcher.mock.calls.filter(([url]) => url === '/api/state').length).toBe(initial + 1);
});
