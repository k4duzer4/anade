import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { MaterialsHub } from '../src/components/materials-hub';
import { portalRequest } from '../src/lib/portal-request';
const portal = vi.hoisted(() => ({
  data: { user: { admin: false } },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/portal-request', () => ({ portalRequest: vi.fn() }));
const item = {
  id: 'test-material',
  title: 'Logo principal',
  description: 'Versão institucional',
  category: 'logos',
  fileName: 'logo.png',
  mime: 'image/png',
  bytes: 2048,
  createdAt: '2026-11-05T15:00:00Z',
  updatedAt: '2026-11-05T15:00:00Z',
  downloadUrl: '/api/materials/test-material/file',
  previewUrl: '/api/materials/test-material/file?preview=1',
};
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.user.admin = false;
  portal.mutate.mockResolvedValue(undefined);
  URL.createObjectURL = vi.fn(() => 'blob:material');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(portalRequest).mockResolvedValue({
    records: [item],
    total: 1,
    page: 0,
    hasMore: false,
    storageReady: true,
  });
});
it('filiado vê prévia e download, sem controles de publicação ou exclusão', async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <MaterialsHub />
    </TooltipProvider>,
  );
  expect(await screen.findByText('Logo principal')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Baixar original' }).getAttribute('href')).toBe(
    item.downloadUrl,
  );
  expect(screen.queryByRole('button', { name: 'Adicionar material' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Editar Logo principal' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Visualizar Logo principal' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Baixar arquivo original' }).getAttribute('href')).toBe(
    item.downloadUrl,
  );
  expect(portal.mutate).not.toHaveBeenCalled();
});
it('admin publica arquivo original como multipart e rejeita arquivo maior que o limite', async () => {
  portal.data.user.admin = true;
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <MaterialsHub />
    </TooltipProvider>,
  );
  await screen.findByText('Logo principal');
  await user.click(screen.getByRole('button', { name: 'Adicionar material' }));
  const input = screen.getByLabelText('Arquivo do material');
  await user.upload(
    input,
    new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' }),
  );
  expect(screen.getByRole('alert').textContent).toContain('4 MB');
  const file = new File(['original'], 'nova-logo.png', { type: 'image/png' });
  await user.upload(input, file);
  await user.type(screen.getByRole('textbox', { name: 'Título' }), 'Nova logo');
  await user.click(screen.getByRole('button', { name: 'Publicar material' }));
  await waitFor(() => expect(portal.mutate).toHaveBeenCalledOnce());
  const [url, method, body] = portal.mutate.mock.calls[0];
  expect(url).toBe('/api/materials');
  expect(method).toBe('POST');
  expect(body).toBeInstanceOf(FormData);
  expect(body.get('file').name).toBe('nova-logo.png');
  expect(body.get('title')).toBe('Nova logo');
  expect(body.get('category')).toBe('logos');
  expect(portal.notify).toHaveBeenCalledWith('Material salvo no acervo.');
});
it('categorias e busca consultam o acervo; falha permite tentar novamente', async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <MaterialsHub />
    </TooltipProvider>,
  );
  await screen.findByText('Logo principal');
  await user.click(screen.getByRole('button', { name: 'Panfletos' }));
  await waitFor(() =>
    expect(vi.mocked(portalRequest).mock.calls.at(-1)?.[0]).toContain('category=panfletos'),
  );
  await user.type(screen.getByRole('searchbox', { name: 'Buscar materiais' }), 'educação');
  await waitFor(() =>
    expect(vi.mocked(portalRequest).mock.calls.at(-1)?.[0]).toContain('search=educa%C3%A7%C3%A3o'),
  );
  vi.mocked(portalRequest).mockRejectedValueOnce(new Error('Acervo indisponível.'));
  await user.click(screen.getByRole('button', { name: 'Todo o acervo' }));
  expect(await screen.findByText('Acervo indisponível.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Logo principal')).toBeTruthy();
});
