import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { GroupsHub } from '../src/components/groups-hub';
import { FinanceHub } from '../src/components/finance-hub';
import { LegalHub } from '../src/components/legal-hub';
import { GameCalendarPanel } from '../src/components/game-calendar';
import { NotificationCenter } from '../src/components/notification-center';
import { PollCard } from '../src/components/poll-card';
import { GroupWorkspace } from '../src/components/group-workspace';
import { loadCommunity } from '../src/lib/community';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'member', admin: false },
    csrf: 'csrf',
    serverTime: '2026-10-24T14:00:00Z',
    members: [{ id: 'member', name: 'Maria', discord: 'maria', state: 'SP' }],
    polls: [],
    meetings: [],
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
const notificationPush = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: notificationPush }),
}));
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
it('entrar no grupo aponta para página própria e o detalhe não repete a listagem', async () => {
  const group = {
    id: 'group',
    name: 'Câmara',
    type: 'camara',
    state: '',
    memberIds: ['member'],
    canAccess: true,
    leaderId: 'member',
    description: 'Bancada',
  };
  vi.mocked(loadCommunity).mockImplementation(async (url) =>
    String(url).includes('/notes')
      ? { records: [], page: 0, total: 0, hasMore: false }
      : { records: [group] },
  );
  const view = render(<GroupsHub />);
  await screen.findByRole('link', { name: 'Entrar no grupo' });
  expect(screen.getByRole('link', { name: 'Entrar no grupo' }).getAttribute('href')).toBe(
    '/grupos/group',
  );
  view.unmount();
  render(<GroupsHub groupId="group" />);
  await screen.findByRole('heading', { name: 'Câmara', level: 1 });
  expect(screen.queryByRole('textbox', { name: 'Buscar grupo' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Entrar no grupo' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Maria' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Votações/ })).toBeTruthy();
});
it('página do grupo mostra apenas seus próprios votos e participantes', async () => {
  const group = {
    id: 'group',
    name: 'Câmara',
    type: 'camara',
    state: '',
    memberIds: ['member'],
    canAccess: true,
    leaderId: 'member',
    description: 'Bancada',
  };
  const user = userEvent.setup();
  render(
    <GroupWorkspace group={group} onCreateNote={vi.fn()}>
      <p>Pauta exclusiva da Câmara</p>
    </GroupWorkspace>,
  );
  expect(screen.getByText('Pauta exclusiva da Câmara')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /^Votações/ }));
  await screen.findByText('Nenhuma votação neste grupo.');
  expect(screen.queryByText('Pauta exclusiva da Câmara')).toBeNull();
  await user.click(screen.getByRole('button', { name: /^Participantes/ }));
  expect(screen.getByRole('link', { name: /Maria Liderança/ }).getAttribute('href')).toBe(
    '/filiados/member',
  );
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
it('votação restrita mostra as regras sem oferecer voto a observador', async () => {
  render(
    <TooltipProvider>
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
      />
    </TooltipProvider>,
  );
  await userEvent.setup().click(screen.getByRole('button', { name: 'Ver detalhes' }));
  expect(screen.getByRole('dialog', { name: 'Votação interna' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Revisar voto' })).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
  expect(screen.getByText(/Câmara · 1 eleitor/)).toBeTruthy();
});
it('card com voto registrado recolhe o contexto e mantém ações administrativas atrás do menu', async () => {
  portal.data.user.admin = true;
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <PollCard
        poll={{
          id: 'registered',
          title: 'Decisão da bancada',
          description: 'Texto completo da proposta',
          options: ['Aprovar', 'Recusar', 'Abstenção'],
          deadline: '2026-10-27T21:00:00Z',
          secret: true,
          closed: false,
          total: 2,
          hasVoted: true,
          myVote: 1,
          abstentionIndex: 2,
          canVote: false,
        }}
      />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Ver meu voto' }));
  expect(screen.getByText('Você já participou desta decisão.')).toBeTruthy();
  expect(screen.getByText('Recusar')).toBeTruthy();
  expect(screen.queryByRole('radio')).toBeNull();
  expect(
    within(screen.getByRole('dialog', { name: 'Votação interna' }))
      .getByText('Texto completo da proposta')
      .closest('details')?.open,
  ).toBe(false);
  expect(screen.getByRole('button', { name: 'Encerrar votação' }).closest('details')?.open).toBe(
    false,
  );
  await user.click(screen.getByText('Gerenciar votação'));
  await user.click(screen.getByRole('button', { name: 'Encerrar votação' }));
  expect(screen.getByRole('dialog', { name: 'ENCERRAR VOTAÇÃO' })).toBeTruthy();
  expect(portal.mutate).not.toHaveBeenCalled();
});
it('abrir o painel não confirma avisos; clicar na notificação persiste a leitura e navega', async () => {
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
  await user.click(screen.getByRole('button', { name: `Abrir notificação: ${item.title}` }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith('/api/notifications/read', 'PUT', { keys: ['n1'] }),
  );
  expect(notificationPush).toHaveBeenCalledWith(item.href);
});
it('falha ao salvar leitura mantém o aviso pendente no painel flutuante e não navega', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    records: [
      { key: 'n2', title: 'Prazo importante', href: '/agenda', type: 'prazo', read: false },
    ],
    unread: 1,
    page: 0,
    hasMore: false,
  });
  portal.mutate.mockRejectedValueOnce(new Error('Não foi possível salvar a leitura.'));
  const user = userEvent.setup();
  render(<NotificationCenter />);
  await user.click(await screen.findByRole('button', { name: 'Notificações, 1 não lidas' }));
  await user.click(screen.getByRole('button', { name: 'Abrir notificação: Prazo importante' }));
  await screen.findByText('Não foi possível salvar a leitura.');
  expect(notificationPush).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Suas notificações' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Notificações, 1 não lidas' })).toBeTruthy();
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Suas notificações' })).toBeNull(),
  );
});
