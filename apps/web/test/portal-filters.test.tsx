import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import Agenda from '../src/app/(portal)/agenda/page';
import Polls from '../src/app/(portal)/votacoes/page';
import Members from '../src/app/(portal)/filiados/page';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'a', admin: false },
    serverTime: '2026-10-22T12:00:00Z',
    members: [
      {
        id: 'a',
        name: 'Maria São Silva',
        blue: '@maria',
        state: 'SP',
        ideology: 'Centro',
        office: '',
        city: 'São Paulo',
        season: '1',
        joinedAt: '2026-10-01T12:00:00Z',
      },
      {
        id: 'b',
        name: 'João Alves',
        blue: '@joao',
        state: 'MG',
        ideology: 'Social-democracia',
        office: 'Deputado',
        city: 'Belo Horizonte',
        season: '1',
        joinedAt: '2026-10-21T12:00:00Z',
      },
    ],
    meetings: [
      {
        id: 'future',
        title: 'Reunião de São Paulo',
        date: '2026-10-24T15:00:00Z',
        location: 'Google Meet',
        agenda: ['Educação'],
        attendance: ['a'],
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        docsUrl: '',
        minutes: '',
      },
      {
        id: 'other',
        title: 'Diretório nacional',
        date: '2026-10-25T15:00:00Z',
        location: 'Google Meet',
        agenda: ['Organização'],
        attendance: [],
        meetUrl: '',
        docsUrl: '',
        minutes: '',
      },
      {
        id: 'past',
        title: 'Encontro realizado',
        date: '2026-10-20T15:00:00Z',
        location: 'Google Meet',
        agenda: [],
        attendance: [],
        meetUrl: '',
        docsUrl: '',
        minutes: '',
      },
    ],
    polls: [
      {
        id: 'pending',
        title: 'Decisão pendente',
        description: 'Contexto',
        closed: false,
        hasVoted: false,
        secret: true,
        options: ['Aprovar', 'Rejeitar', 'Abstenção'],
        deadline: '2026-10-25T15:00:00Z',
        total: 0,
        myVote: null,
        abstentionIndex: 2,
      },
      {
        id: 'voted',
        title: 'Decisão respondida',
        description: '',
        closed: false,
        hasVoted: true,
        secret: true,
        options: ['A', 'B', 'Abstenção'],
        deadline: '2026-10-26T15:00:00Z',
        total: 1,
        myVote: 0,
        abstentionIndex: 2,
      },
      {
        id: 'closed',
        title: 'Decisão encerrada',
        description: '',
        closed: true,
        hasVoted: false,
        secret: true,
        options: ['A', 'B', 'Abstenção'],
        deadline: '2026-10-20T15:00:00Z',
        total: 0,
        myVote: null,
        abstentionIndex: 2,
      },
    ],
  },
  config: { states: ['SP', 'MG'], ideologies: ['Centro', 'Social-democracia'] },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
beforeEach(() => {
  vi.clearAllMocks();
  portal.mutate.mockResolvedValue(undefined);
});
it('agenda filtra confirmações, busca sem acento e mantém a presença e os links de reunião', async () => {
  const user = userEvent.setup();
  render(<Agenda />);
  expect(screen.queryByText('Encontro realizado')).toBeNull();
  await user.type(screen.getByRole('textbox', { name: 'Buscar reunião ou pauta' }), 'sao');
  expect(screen.getByText('Reunião de São Paulo')).toBeTruthy();
  expect(screen.queryByText('Diretório nacional')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Limpar busca' }));
  await user.click(screen.getByRole('button', { name: /Minha presença/ }));
  expect(screen.queryByText('Diretório nacional')).toBeNull();
  expect(screen.getByRole('link', { name: 'Entrar no Meet' }).getAttribute('href')).toBe(
    'https://meet.google.com/abc-defg-hij',
  );
  await user.click(screen.getByRole('button', { name: 'Presença confirmada' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith('/api/meetings/future/attendance', 'POST', {
      confirm: false,
    }),
  );
});
it('votações distinguem pendentes e encerradas e revisam abstenção sem registrar antes da confirmação', async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <Polls />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole('button', { name: /Para votar/ }));
  expect(screen.queryByText('Decisão respondida')).toBeNull();
  await user.click(screen.getByRole('radio', { name: /Abstenção/ }));
  await user.click(screen.getByRole('button', { name: 'Revisar voto' }));
  expect(screen.getByRole('dialog', { name: 'CONFIRMAR SEU VOTO' })).toBeTruthy();
  expect(portal.mutate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Voltar' }));
  await user.click(screen.getByRole('button', { name: /Encerradas/ }));
  expect(screen.getByText('Decisão encerrada')).toBeTruthy();
  expect(screen.queryByText('Decisão pendente')).toBeNull();
});
it('filiados aceita busca sem acentos e limpa estados sem alterar cadastros', async () => {
  const user = userEvent.setup();
  render(<Members />);
  await user.type(screen.getByRole('textbox', { name: 'Buscar filiados' }), 'sao');
  expect(screen.getByRole('link', { name: 'Ver perfil de Maria São Silva' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Ver perfil de João Alves' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
  expect(screen.getByRole('link', { name: 'Ver perfil de João Alves' })).toBeTruthy();
  expect(portal.mutate).not.toHaveBeenCalled();
});
