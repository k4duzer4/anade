import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { PublicationsHub } from '../src/components/publications-hub';
import { StatutePage } from '../src/components/statute-page';
import { SeasonCountdown } from '../src/components/season-countdown';
import { loadCommunity } from '../src/lib/community';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'member', admin: false },
    serverTime: '2026-10-24T10:59:59Z',
    members: [{ id: 'member', name: 'Maria', discord: 'maria' }],
  },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/community', async (original) => ({
  ...(await original()),
  loadCommunity: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.user.admin = false;
  portal.mutate.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
const feed = {
  records: [
    {
      id: 'link',
      ownerId: 'member',
      type: 'post',
      title: 'Meu post do ciclo',
      url: 'https://example.com/post',
      createdAt: '2026-10-24T10:00:00Z',
    },
  ],
  page: 0,
  hasMore: false,
  serverTime: '2026-10-24T10:59:59Z',
  resetsAt: '2026-10-24T11:00:00Z',
  periodStart: '2026-10-23T11:00:00Z',
};
it('mural esconde links ao chegar às 8h mesmo enquanto a consulta do novo ciclo não responde', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(feed.serverTime));
  vi.mocked(loadCommunity)
    .mockResolvedValueOnce(feed)
    .mockImplementation(() => new Promise(() => {}));
  await act(async () => {
    render(<PublicationsHub />);
  });
  expect(screen.getByRole('heading', { name: 'Meu post do ciclo' })).toBeTruthy();
  expect(screen.getByRole('timer').textContent).toBe('00:00:01');
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(screen.queryByRole('heading', { name: 'Meu post do ciclo' })).toBeNull();
  expect(screen.getByText('Um novo ciclo começou.')).toBeTruthy();
  expect(loadCommunity).toHaveBeenCalledTimes(2);
});
it('filiado compartilha link sem forjar autoria, e envio fica em formulário acessível', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({ ...feed, records: [] });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <PublicationsHub />
    </TooltipProvider>,
  );
  await screen.findByText('O mural está aberto.');
  await user.click(screen.getAllByRole('button', { name: 'Compartilhar link' })[0]);
  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Meu jornal');
  await user.type(
    screen.getByRole('textbox', { name: 'Link da publicação' }),
    'https://example.com/jornal',
  );
  await user.click(screen.getByRole('button', { name: 'Compartilhar no mural' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith('/api/publications', 'POST', {
      title: 'Meu jornal',
      url: 'https://example.com/jornal',
      type: 'post',
    }),
  );
});
it('estatuto em elaboração oferece edição somente ao ADM e guarda publicação desmarcada no rascunho', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    title: 'Estatuto da ANADE',
    body: '',
    url: '',
    published: false,
    updatedAt: null,
  });
  const user = userEvent.setup(),
    view = render(
      <TooltipProvider>
        <StatutePage />
      </TooltipProvider>,
    );
  await screen.findByText('EM ELABORAÇÃO');
  expect(screen.queryByRole('button', { name: 'Preparar estatuto' })).toBeNull();
  portal.data.user.admin = true;
  view.rerender(
    <TooltipProvider>
      <StatutePage />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Preparar estatuto' }));
  await user.type(screen.getByRole('textbox', { name: 'Texto do estatuto' }), 'Texto em revisão.');
  await user.click(screen.getByRole('button', { name: 'Salvar estatuto' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith(
      '/api/statute',
      'PUT',
      expect.objectContaining({ body: 'Texto em revisão.', published: false }),
    ),
  );
});
it('resumo mostra só três próximos marcos e mantém acesso ao calendário completo', () => {
  render(
    <SeasonCountdown
      compact
      calendar={{
        serverTime: '2026-10-24T19:00:00Z',
        config: { startDate: '2026-10-15', duration: 90 },
        events: [],
        milestones: Array.from({ length: 8 }, (_, i) => ({
          id: String(i),
          title: `Marco ${i + 1}`,
          type: 'eleicao',
          date: `2026-11-${String(i + 1).padStart(2, '0')}T11:00:00Z`,
        })),
        day: 10,
        today: '2026-10-24',
        nextTick: '2026-10-25T11:00:00Z',
        source: '',
        wiki: '',
        gameDate: 'Outubro de 2018',
      }}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Marco 3' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Marco 4' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Ver todos' }).getAttribute('href')).toBe('/calendario');
});
