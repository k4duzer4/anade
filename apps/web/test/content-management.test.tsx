import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { DeleteAction } from '../src/components/delete-action';
import { AgendaConversation } from '../src/components/agenda-conversation';
import { loadCommunity } from '../src/lib/community';

const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'member', admin: false },
    members: [
      { id: 'member', name: 'Maria' },
      { id: 'other', name: 'João' },
    ],
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

it('exclusão exige confirmação explícita e nome para votação; cancelar não altera dados', async () => {
  const user = userEvent.setup(),
    deleted = vi.fn();
  render(
    <TooltipProvider>
      <DeleteAction
        url="/api/polls/poll"
        title="Eleição da Câmara"
        label="Excluir votação"
        description="Apaga os votos."
        requireName
        onDeleted={deleted}
      />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Excluir votação: Eleição da Câmara' }));
  expect(portal.mutate).not.toHaveBeenCalled();
  const dialog = within(screen.getByRole('dialog'));
  expect(
    dialog.getByRole('button', { name: 'Excluir definitivamente' }).hasAttribute('disabled'),
  ).toBe(true);
  await user.click(dialog.getByRole('button', { name: 'Cancelar' }));
  expect(portal.mutate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Excluir votação: Eleição da Câmara' }));
  await user.type(screen.getByRole('textbox'), 'Eleição da Câmara');
  await user.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
  await waitFor(() => expect(portal.mutate).toHaveBeenCalledWith('/api/polls/poll', 'DELETE', {}));
  expect(deleted).toHaveBeenCalledOnce();
});

it('falha ao excluir permanece visível na confirmação sem anunciar sucesso', async () => {
  const user = userEvent.setup();
  portal.mutate.mockRejectedValue(new Error('Exclua primeiro as movimentações.'));
  render(
    <TooltipProvider>
      <DeleteAction url="/api/finance/wallets/w" title="Caixa" description="Apaga o caixa." />
    </TooltipProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Excluir: Caixa' }));
  await user.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
  await screen.findByText('Exclua primeiro as movimentações.');
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(portal.notify).not.toHaveBeenCalled();
});

it('conversa carrega só ao abrir e comenta no assunto correto, preservando autoria e moderação', async () => {
  const user = userEvent.setup();
  vi.mocked(loadCommunity).mockResolvedValue({
    records: [
      {
        id: 'c1',
        authorId: 'member',
        body: 'Minha contribuição',
        createdAt: '2026-10-25T14:00:00Z',
      },
      { id: 'c2', authorId: 'other', body: 'Outra opinião', createdAt: '2026-10-25T14:01:00Z' },
    ],
    page: 0,
    hasMore: false,
  });
  render(
    <TooltipProvider>
      <AgendaConversation
        kind="meeting"
        id="m1"
        title="Educação e saúde"
        topic="Educação e saúde"
      />
    </TooltipProvider>,
  );
  expect(loadCommunity).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Comentar: Educação e saúde' }));
  await screen.findByText('Minha contribuição');
  expect(loadCommunity).toHaveBeenCalledWith(
    '/api/meetings/m1/comments?topic=Educa%C3%A7%C3%A3o%20e%20sa%C3%BAde&page=0',
    expect.any(AbortSignal),
  );
  expect(
    screen.getAllByRole('button', { name: 'Excluir comentário: Comentário da pauta' }),
  ).toHaveLength(1);
  await user.type(
    screen.getByRole('textbox', { name: 'Seu comentário' }),
    'Proponho uma atualização',
  );
  await user.click(screen.getByRole('button', { name: 'Publicar comentário' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith(
      '/api/meetings/m1/comments?topic=Educa%C3%A7%C3%A3o%20e%20sa%C3%BAde',
      'POST',
      { body: 'Proponho uma atualização' },
    ),
  );
});
