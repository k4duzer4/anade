import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckinRanking } from '../src/components/checkin-ranking';
import { loadCheckins } from '../src/lib/checkin-upload';
const portal = vi.hoisted(() => ({ data: { user: { admin: true } } }));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/checkin-upload', () => ({ loadCheckins: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.user.admin = true;
  vi.mocked(loadCheckins).mockResolvedValue({
    records: [
      {
        memberId: 'a',
        name: 'Pessoa do RPG',
        position: 1,
        points: 5,
        lastDay: '2026-10-22',
        avatarUrl: '',
      },
    ],
    summary: { points: 5, participants: 1 },
    hasMore: false,
  });
});
it('não renderiza nem consulta a classificação para um filiado sem administração', () => {
  portal.data.user.admin = false;
  render(<CheckinRanking />);
  expect(screen.queryByRole('region')).toBeNull();
  expect(loadCheckins).not.toHaveBeenCalled();
});
it('administrador filtra o período, consulta registros e pode atualizar sem alterar pontos', async () => {
  const user = userEvent.setup();
  render(<CheckinRanking />);
  expect(await screen.findByText('Pessoa do RPG')).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Consultar pontos de Pessoa do RPG' }).getAttribute('href'),
  ).toBe('/administracao/pontos?memberId=a');
  await user.click(screen.getByRole('button', { name: '7 dias' }));
  await waitFor(() =>
    expect(vi.mocked(loadCheckins).mock.calls.at(-1)?.[0]).toContain('period=7&page=0'),
  );
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'Atualizar' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  await user.click(screen.getByRole('button', { name: '7 dias' }));
  expect(screen.queryByText('Carregando ranking…')).toBeNull();
});
