import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { AssignmentsAdmin } from '../src/components/assignments-admin';
import { MemberAssignments } from '../src/components/member-assignments';
import { SeasonCountdown } from '../src/components/season-countdown';
import { FinanceHub } from '../src/components/finance-hub';
import { loadCommunity } from '../src/lib/community';
import { seasonClock } from '../src/lib/season-clock';
import { type GameCalendar } from '../src/lib/organization';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'admin', admin: true },
    serverTime: '2026-10-24T19:00:00Z',
    members: [{ id: 'member', name: 'Maria', discord: 'maria', state: 'SP' }],
  },
  config: {
    partyFunctions: ['Jurídico', 'Financeiro'],
    electoralOffices: ['Deputado federal', 'Senador'],
    states: ['SP', 'MG'],
  },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/community', async (original) => ({
  ...(await original()),
  loadCommunity: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('membro=member') }));
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.user.admin = true;
  portal.mutate.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
const calendar: GameCalendar = {
  serverTime: '2026-10-24T19:00:00Z',
  today: '2026-10-24',
  nextTick: '2026-10-25T11:00:00Z',
  day: 10,
  gameDate: 'Outubro de 2018',
  config: { startDate: '2026-10-15', duration: 90 },
  source: '',
  wiki: '',
  events: [],
  milestones: [
    {
      id: 'election',
      title: '2º turno',
      date: '2026-10-25T13:00:00Z',
      gameDay: 11,
      type: 'eleicao',
    },
  ],
};
it('calendário conta segundos sem recarregar a página', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(calendar.serverTime));
  render(<SeasonCountdown calendar={calendar} />);
  expect(screen.getByRole('timer').textContent).toBe('16:00:00');
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('timer').textContent).toBe('15:59:59');
  expect(screen.getByText('Encerra em 12/01/2027')).toBeTruthy();
});
it('dia da temporada vira às 8h de Brasília e o próximo tick avança automaticamente', () => {
  const before = seasonClock(calendar, Date.parse('2026-10-25T10:59:59Z')),
    after = seasonClock(calendar, Date.parse('2026-10-25T11:00:00Z'));
  expect(before.day).toBe(10);
  expect(after.day).toBe(11);
  expect(new Date(after.nextTick).toISOString()).toBe('2026-10-26T11:00:00.000Z');
  expect(before.phase).toBe('Campanha');
  expect(after.phase).toBe('Dia de eleição');
});
it('somente administração recebe o formulário de cargo e funções; salvar não edita a ficha pessoal', async () => {
  vi.mocked(loadCommunity).mockImplementation(async (url) =>
    String(url).includes('/assignments/')
      ? { assignment: { office: '', officeState: '', functions: [], functionState: '' } }
      : { accounts: [{ id: 'member', name: 'Maria', discord: 'maria' }] },
  );
  const user = userEvent.setup();
  const view = render(
    <TooltipProvider>
      <AssignmentsAdmin />
    </TooltipProvider>,
  );
  await screen.findByRole('checkbox', { name: 'Jurídico' });
  await user.click(screen.getByRole('checkbox', { name: 'Jurídico' }));
  await user.click(screen.getByRole('button', { name: 'Salvar cargo e funções' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith(
      '/api/admin/assignments/member',
      'PUT',
      expect.objectContaining({ office: '', functions: ['Jurídico'] }),
    ),
  );
  view.unmount();
  vi.clearAllMocks();
  portal.data.user.admin = false;
  render(<AssignmentsAdmin />);
  expect(screen.getByText('Esta área é exclusiva para administradores.')).toBeTruthy();
  expect(loadCommunity).not.toHaveBeenCalled();
});
it('membro sem atribuição aparece como comum, sem permitir editar seu cargo', () => {
  render(<MemberAssignments />);
  expect(screen.getByText('Membro comum')).toBeTruthy();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Gerenciar' })).toBeNull();
});
it('administrador sem função financeira vê o caixa mas não recebe botões de lançamento', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    wallets: [
      {
        id: 'wallet',
        name: 'Caixa',
        type: 'partidario',
        memberIds: [],
        balance: 0,
        reserved: 0,
        available: 0,
        reservations: [],
      },
    ],
    canManage: false,
    records: [],
    page: 0,
    hasMore: false,
    total: 0,
  });
  render(<FinanceHub />);
  await screen.findByRole('heading', { name: 'Caixa' });
  expect(screen.queryByRole('button', { name: 'Criar caixa' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Registrar movimentação' })).toBeNull();
});
