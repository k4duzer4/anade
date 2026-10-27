import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import AdministrationContent from '../src/components/administration-content';
import { loadCheckins } from '../src/lib/checkin-upload';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: '123456789012345678', admin: true },
    serverTime: '2026-10-23T12:00:00Z',
    members: [
      {
        id: '123456789012345678',
        name: 'Maria',
        state: 'SP',
        city: 'São Paulo',
        joinedAt: '2026-10-22T12:00:00Z',
      },
    ],
    meetings: [],
    polls: [],
    directors: [],
  },
  refresh: vi.fn(),
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/checkin-upload', () => ({ loadCheckins: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.user.admin = true;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            accounts: [
              { id: '123456789012345678', name: 'Maria', discord: 'maria', isAdmin: true },
              { id: '223456789012345678', name: 'João', discord: 'joao', isAdmin: false },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    ),
  );
  vi.mocked(loadCheckins).mockResolvedValue({
    records: [],
    summary: { points: 0, participants: 0 },
    hasMore: false,
  });
});
it('painel administrativo não consulta contas nem participação de um filiado comum', () => {
  portal.data.user.admin = false;
  render(<AdministrationContent />);
  expect(screen.getByText('Esta área é exclusiva para administradores.')).toBeTruthy();
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(loadCheckins).not.toHaveBeenCalled();
});
it('visão geral reúne ferramentas e permite revisar uma conta sem conceder administração antes de confirmar', async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <AdministrationContent />
    </TooltipProvider>,
  );
  await waitFor(() =>
    expect(loadCheckins).toHaveBeenCalledWith(
      '/api/admin/checkins/ranking?period=7&page=0',
      expect.any(AbortSignal),
    ),
  );
  expect(screen.getByRole('heading', { name: 'Agenda e decisões' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Ranking de participação/ })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Acessos e equipe' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Localizar conta' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
  await user.type(
    screen.getByRole('textbox', { name: /ID do usuário Discord/ }),
    '223456789012345678',
  );
  await user.click(screen.getByRole('button', { name: 'Localizar conta' }));
  expect(screen.getByText('João')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Conceder administração' })).toBeTruthy();
  expect(portal.mutate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Visão geral' }));
  expect(screen.getByRole('heading', { name: 'Gerenciar o portal' })).toBeTruthy();
});
it('administrador concede e remove somente acesso de convidado pelo ID localizado', async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <AdministrationContent />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Acessos e equipe' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Localizar conta' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
  await user.type(
    screen.getByRole('textbox', { name: /ID do usuário Discord/ }),
    '223456789012345678',
  );
  await user.click(screen.getByRole('button', { name: 'Localizar conta' }));
  await user.click(screen.getByRole('button', { name: 'Conceder acesso de convidado' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith('/api/admin/guests', 'PUT', {
      discordId: '223456789012345678',
      enabled: true,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Remover acesso de convidado' }).hasAttribute('disabled'),
    ).toBe(false),
  );
  await user.click(screen.getByRole('button', { name: 'Remover acesso de convidado' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith('/api/admin/guests', 'PUT', {
      discordId: '223456789012345678',
      enabled: false,
    }),
  );
  expect(portal.mutate.mock.calls.some(([url]) => url === '/api/admin/admins')).toBe(false);
});
