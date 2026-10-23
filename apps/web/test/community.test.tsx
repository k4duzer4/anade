import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { CommunityHub } from '../src/components/community-hub';
import { GlobalSearch } from '../src/components/global-search';
import { MemberTimeline } from '../src/components/member-timeline';
import { loadCommunity } from '../src/lib/community';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'member', admin: false },
    serverTime: '2026-10-23T12:00:00Z',
    members: [{ id: 'member', name: 'Maria', state: 'SP' }],
  },
  config: { states: ['SP', 'MG'], electoralOffices: ['Presidente', 'Deputado federal'] },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/community', async (original) => ({
  ...(await original()),
  loadCommunity: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));
const item = {
  id: 'a-proposal',
  ownerId: 'other',
  title: 'Mais ensino técnico',
  body: 'Uma proposta para educação',
  createdAt: '2026-10-23T12:00:00Z',
  updatedAt: '2026-10-23T12:00:00Z',
  supports: 2,
  comments: 0,
  reads: 0,
  supported: false,
  read: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.user.admin = false;
  portal.mutate.mockResolvedValue(undefined);
  vi.mocked(loadCommunity).mockResolvedValue({ records: [], page: 0, hasMore: false, open: false });
});
it('central fechada não oferece cadastro ao filiado e só administrador recebe controle de abertura', async () => {
  const user = userEvent.setup();
  const view = render(
    <TooltipProvider>
      <CommunityHub kind="campaign" />
    </TooltipProvider>,
  );
  await screen.findByText('Central de campanha fechada');
  expect(screen.queryByRole('button', { name: 'Cadastrar pré-candidatura' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Abrir central' })).toBeNull();
  view.unmount();
  portal.data.user.admin = true;
  render(
    <TooltipProvider>
      <CommunityHub kind="campaign" />
    </TooltipProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Abrir central' }).hasAttribute('disabled')).toBe(
      false,
    ),
  );
  await user.click(screen.getByRole('button', { name: 'Abrir central' }));
  expect(screen.getByRole('dialog', { name: 'Abrir Central de campanha' })).toBeTruthy();
  expect(portal.mutate).not.toHaveBeenCalled();
});
it('apoio usa a conta atual e encaminhamento para votação é oferecido somente ao administrador', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({ records: [item], page: 0, hasMore: false });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <CommunityHub kind="proposal" />
    </TooltipProvider>,
  );
  await screen.findByText(item.title);
  expect(screen.queryByRole('button', { name: 'Encaminhar para votação' })).toBeNull();
  await user.click(screen.getByRole('button', { name: '2 apoios' }));
  expect(portal.mutate).toHaveBeenCalledWith('/api/proposals/a-proposal/support', 'PUT', {
    enabled: true,
  });
});
it('confirmar leitura envia somente o registro selecionado e não oferece publicação a um filiado', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    records: [{ ...item, pinned: true }],
    page: 0,
    hasMore: false,
  });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <CommunityHub kind="announcement" />
    </TooltipProvider>,
  );
  await screen.findByText(item.title);
  expect(screen.queryByRole('button', { name: 'Publicar comunicado' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Confirmar leitura' }));
  expect(portal.mutate).toHaveBeenCalledWith('/api/announcements/a-proposal/read', 'PUT', {});
});
it('busca geral pode ser aberta pelo teclado e usa os destinos devolvidos pela API', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    results: [
      {
        type: 'Votação',
        id: 'poll',
        title: 'Plano de educação',
        excerpt: 'Resultado publicado',
        href: '/votacoes?votacao=poll#votacao-poll',
      },
    ],
    limited: false,
  });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <GlobalSearch />
    </TooltipProvider>,
  );
  await user.keyboard('{Control>}k{/Control}');
  await user.type(screen.getByRole('textbox', { name: 'Pesquisar no portal' }), 'educação');
  const link = await screen.findByRole('link', { name: /Plano de educação/ });
  expect(link.getAttribute('href')).toBe('/votacoes?votacao=poll#votacao-poll');
  expect(loadCommunity).toHaveBeenCalledWith(
    '/api/search?q=educa%C3%A7%C3%A3o',
    expect.any(AbortSignal),
  );
});
it('a linha do tempo de outro filiado é somente leitura', async () => {
  vi.mocked(loadCommunity).mockResolvedValue({
    records: [{ ...item, type: 'mandato', start: '2026-10-01', end: '' }],
    page: 0,
    hasMore: false,
  });
  render(<MemberTimeline memberId="other" own={false} />);
  await screen.findByText(item.title);
  expect(screen.queryByRole('button', { name: 'Adicionar' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
  expect(portal.mutate).not.toHaveBeenCalled();
});
