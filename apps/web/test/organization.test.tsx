import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { GroupsHub } from '../src/components/groups-hub';
import { FinanceHub } from '../src/components/finance-hub';
import { LegalHub } from '../src/components/legal-hub';
import { GameCalendarPanel } from '../src/components/game-calendar';
import { NotificationCenter } from '../src/components/notification-center';
import { PollCard } from '../src/components/poll-card';
import { loadCommunity } from '../src/lib/community';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'member', admin: false },
    csrf: 'csrf',
    serverTime: '2026-10-24T14:00:00Z',
    members: [{ id: 'member', name: 'Maria', discord: 'maria', state: 'SP' }],
  },
  config: { states: ['SP'] },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/community', async (original) => ({
  ...(await original()),
  loadCommunity: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.user.admin = false;
  portal.mutate.mockResolvedValue(undefined);
});
it('grupo privado não oferece entrada nem edição para não participante', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    records: [
      {
        id: 'group',
        name: 'Câmara',
        type: 'camara',
        state: '',
        memberIds: ['other'],
        canAccess: false,
        leaderId: 'other',
        description: 'Bancada',
      },
    ],
  });
  render(<GroupsHub />);
  await screen.findByText('Somente participantes');
  expect(screen.queryByRole('link', { name: 'Entrar no grupo' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Criar grupo' })).toBeNull();
  expect(loadCommunity).toHaveBeenCalledTimes(1);
});
it('caixas não autorizados e jurídico sem acesso não oferecem criação de registro', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    wallets: [],
    records: [],
    page: 0,
    total: 0,
    hasMore: false,
  });
  const view = render(<FinanceHub />);
  await screen.findByText('Nenhum caixa disponível.');
  expect(screen.queryByRole('button', { name: 'Criar caixa' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Registrar movimentação' })).toBeNull();
  view.unmount();
  vi.mocked(loadCommunity).mockResolvedValue({
    records: [],
    page: 0,
    total: 0,
    hasMore: false,
    canCreate: false,
  });
  render(<LegalHub />);
  await screen.findByText('Nenhum caso disponível.');
  expect(screen.queryByRole('button', { name: 'Novo registro jurídico' })).toBeNull();
});
it('calendário sem temporada não inventa dia do jogo e mostra a origem oficial', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    serverTime: '2026-10-24T14:00:00Z',
    today: '2026-10-24',
    nextTick: '2026-10-25T11:00:00Z',
    day: null,
    gameDate: 'Temporada não configurada',
    config: {},
    milestones: [],
    events: [],
    source: 'https://legado.planalto.fun/jogo/temporada',
    wiki: 'https://legado.planalto.fun/wiki/temporada-e-tempo',
  });
  render(<GameCalendarPanel />);
  await screen.findByText('A configurar');
  expect(
    screen.getByRole('link', { name: 'Conferir temporada no Legado' }).getAttribute('href'),
  ).toBe('https://legado.planalto.fun/jogo/temporada');
  expect(screen.queryByRole('button', { name: 'Consultar data pública' })).toBeNull();
});
it('votação restrita mostra as regras sem oferecer voto a observador', () => {
  render(
    <PollCard
      poll={{
        id: 'poll',
        title: 'Liderança',
        description: '',
        options: ['A', 'B', 'Abstenção'],
        deadline: '2026-10-25T14:00:00Z',
        secret: true,
        closed: false,
        total: 0,
        hasVoted: false,
        myVote: null,
        abstentionIndex: 2,
        canVote: false,
        governance: {
          groupId: 'group',
          groupName: 'Câmara',
          electorIds: ['other'],
          quorumPercent: 50,
          rule: 'absolute',
          opensAt: '2026-10-24T12:00:00Z',
        },
      }}
    />,
  );
  expect(screen.getByText('Eleitorado restrito')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Revisar voto' })).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.getByText(/Câmara · 1 eleitor/)).toBeTruthy();
});
it('notificação só muda para lida quando a pessoa aciona a confirmação', async () => {
  const item = {
    key: 'n1',
    title: 'Você recebeu uma tarefa',
    href: '/grupos?grupo=group',
    type: 'atribuicao',
    createdAt: '2026-10-24T12:00:00Z',
    read: false,
  };
  vi.mocked(loadCommunity).mockResolvedValue({
    records: [item],
    unread: 1,
    page: 0,
    total: 1,
    hasMore: false,
  });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <NotificationCenter />
    </TooltipProvider>,
  );
  await screen.findByRole('button', { name: 'Notificações, 1 não lidas' });
  await user.click(screen.getByRole('button', { name: 'Notificações, 1 não lidas' }));
  expect(portal.mutate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: `Marcar como lida: ${item.title}` }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith('/api/notifications/read', 'PUT', { keys: ['n1'] }),
  );
});
