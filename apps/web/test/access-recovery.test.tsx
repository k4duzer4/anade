import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorPage from '../src/app/error';
import { requireMember } from '../src/lib/member-access';
const mocks = vi.hoisted(() => ({
  cookie: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookie.mockReturnValue({ value: 'session-cookie' });
});
afterEach(() => vi.unstubAllGlobals());
it('API indisponível mantém a sessão no fluxo de recuperação, sem redirecionar para login', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 503 })),
  );
  await expect(requireMember()).rejects.toThrow('temporariamente indisponível');
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it('sessão inválida e filiado fora da administração continuam bloqueados', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 401 })),
  );
  await expect(requireMember()).rejects.toThrow('REDIRECT:/');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ user: { id: 'member', admin: false } }))),
  );
  await expect(requireMember({ adminOnly: true })).rejects.toThrow('REDIRECT:/painel');
});
it('resposta incompleta não concede acesso', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ user: { admin: true } }))),
  );
  await expect(requireMember()).rejects.toThrow('temporariamente indisponível');
});
it('convidado não executa páginas de filiados fora da reescrita; layout pode renderizar a navegação vazia', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ user: { id: 'guest', admin: false, guest: true } })),
  );
  await expect(requireMember()).rejects.toThrow('REDIRECT:/convidado');
  await expect(requireMember({ allowGuest: true })).resolves.toBeUndefined();
});
it('botão de recuperação usa a API retry do Next instalado', async () => {
  const retry = vi.fn();
  render(<ErrorPage retry={retry} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
