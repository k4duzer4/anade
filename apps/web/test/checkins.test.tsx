import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import CheckinContent from '../src/components/checkin-content';
import { CheckinHistory } from '../src/components/checkin-history';
import { loadCheckins, prepareCheckinProof } from '../src/lib/checkin-upload';

const portal = vi.hoisted(() => ({
  data: { user: { id: 'member', admin: false } },
  config: { electoralOffices: ['Presidente', 'Senador'] },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/checkin-upload', () => ({
  loadCheckins: vi.fn(),
  prepareCheckinProof: vi.fn(),
}));

const record = {
  id: 'test-record',
  memberId: 'member',
  name: 'Pessoa do RPG',
  discord: 'pessoa',
  blue: '@pessoa.blue',
  office: '',
  day: '2026-10-22',
  createdAt: '2026-10-22T15:00:00Z',
  proofs: { actions: '/api/checkins/test/proofs/actions', blue: '/api/checkins/test/proofs/blue' },
};
const empty = {
  today: '2026-10-22',
  todayRecord: null,
  storageReady: true,
  records: [],
  hasMore: false,
  members: [{ id: 'member', name: 'Pessoa do RPG', discord: 'pessoa' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview-test');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(loadCheckins).mockResolvedValue(empty);
  vi.mocked(prepareCheckinProof).mockResolvedValue(new Blob(['prepared'], { type: 'image/webp' }));
  portal.mutate.mockResolvedValue(undefined);
});

describe('página de ponto', () => {
  it('qualquer filiado envia os dois prints sem cargo obrigatório e recebe confirmação', async () => {
    const user = userEvent.setup();
    portal.mutate.mockImplementation(async () => {
      vi.mocked(loadCheckins).mockResolvedValue({
        ...empty,
        todayRecord: record,
        records: [record],
      });
    });
    render(
      <TooltipProvider>
        <CheckinContent />
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Bater ponto' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText(/Participar é opcional/)).toBeTruthy();
    await user.upload(
      screen.getByLabelText('Print das três ações'),
      new File(['actions'], 'acoes.png', { type: 'image/png' }),
    );
    await user.upload(
      screen.getByLabelText('Print do post no Blue'),
      new File(['blue'], 'blue.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(button);
    await waitFor(() => expect(portal.mutate).toHaveBeenCalledOnce());
    const [url, method, body] = portal.mutate.mock.calls[0];
    expect(url).toBe('/api/checkins');
    expect(method).toBe('POST');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('confirmed')).toBe('true');
    expect(body.get('office')).toBe('');
    expect(body.get('actions').type).toBe('image/webp');
    expect(body.get('blue').type).toBe('image/webp');
    expect(await screen.findByText('Tudo certo por hoje!')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bater ponto' })).toBeNull();
    expect(portal.notify).toHaveBeenCalledWith('Ponto registrado com os dois comprovantes.');
  });

  it('sem Storage mostra a configuração pendente e desabilita o envio', async () => {
    vi.mocked(loadCheckins).mockResolvedValue({ ...empty, storageReady: false });
    render(<CheckinContent />);
    expect(await screen.findByText(/ainda precisa configurar o Supabase Storage/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Bater ponto' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(portal.mutate).not.toHaveBeenCalled();
  });

  it('não envia sem os dois prints e sem confirmar as atividades', async () => {
    const user = userEvent.setup();
    render(<CheckinContent />);
    const button = screen.getByRole('button', { name: 'Bater ponto' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    await user.click(button);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(portal.mutate).not.toHaveBeenCalled();
    expect(prepareCheckinProof).not.toHaveBeenCalled();
  });

  it('falha de envio preserva os prints e mantém o erro após atualizar a situação do dia', async () => {
    const user = userEvent.setup();
    portal.mutate.mockRejectedValue(new Error('Não foi possível salvar os prints.'));
    render(<CheckinContent />);
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Bater ponto' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    await user.upload(
      screen.getByLabelText('Print das três ações'),
      new File(['a'], 'acoes.png', { type: 'image/png' }),
    );
    await user.upload(
      screen.getByLabelText('Print do post no Blue'),
      new File(['b'], 'blue.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Bater ponto' }));
    expect(await screen.findByText('Não foi possível salvar os prints.')).toBeTruthy();
    expect(screen.getByText('acoes.png')).toBeTruthy();
    expect(screen.getByText('blue.png')).toBeTruthy();
  });

  it('consulta administrativa filtra por Brasília e repetir Só hoje não trava o carregamento', async () => {
    const user = userEvent.setup();
    vi.mocked(loadCheckins).mockResolvedValue({ ...empty, records: [record] });
    render(
      <TooltipProvider>
        <CheckinHistory admin />
      </TooltipProvider>,
    );
    expect(await screen.findByText('Pessoa do RPG')).toBeTruthy();
    const today = screen.getByRole('button', { name: 'Só hoje' });
    await user.click(today);
    await waitFor(() =>
      expect(vi.mocked(loadCheckins).mock.calls.at(-1)?.[0]).toContain('day=2026-10-22'),
    );
    await waitFor(() => expect((today as HTMLButtonElement).disabled).toBe(false));
    await user.click(today);
    expect(screen.queryByText('Carregando registros…')).toBeNull();
    const member = screen.getByRole('combobox', { name: 'Filtrar pontos por filiado' });
    member.focus();
    await user.keyboard('{ArrowDown}{End}{Enter}');
    await waitFor(() =>
      expect(vi.mocked(loadCheckins).mock.calls.at(-1)?.[0]).toContain('memberId=member'),
    );
    await user.click(
      screen.getByRole('button', { name: 'Ver print das três ações de Pessoa do RPG' }),
    );
    const image = screen.getByRole('img', {
      name: 'Comprovante das ações enviado por Pessoa do RPG',
    });
    expect(new URL(image.getAttribute('src')!, window.location.origin).pathname).toBe(
      record.proofs.actions,
    );
  });
});
