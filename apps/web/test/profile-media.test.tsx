import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileMediaEditor } from '../src/components/profile-media-editor';
import { MemberAvatar } from '../src/components/member-avatar';
import type { Member } from '../src/lib/types';

const portal = vi.hoisted(() => ({ mutate: vi.fn(), notify: vi.fn() }));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
const member = {
  id: 'member',
  name: 'Pessoa',
  avatarUrl: '/api/members/member/media/avatar?v=old',
} as Member;
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:media-preview');
  URL.revokeObjectURL = vi.fn();
  portal.mutate.mockResolvedValue(undefined);
});
describe('imagens do perfil', () => {
  it('mostra prévia, salva foto e banner separadamente e libera a URL temporária', async () => {
    const user = userEvent.setup();
    render(<ProfileMediaEditor member={member} />);
    const file = new File(['foto'], 'foto.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Foto de perfil', { selector: 'input' }), file);
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Prévia: Foto de perfil' }).getAttribute('src')).toBe(
        'blob:media-preview',
      ),
    );
    expect(portal.mutate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Salvar foto' }));
    expect(portal.mutate).toHaveBeenCalledOnce();
    const [path, method, body] = portal.mutate.mock.calls[0];
    expect(path).toBe('/api/profile/media/avatar');
    expect(method).toBe('PUT');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('image')).toBe(file);
    expect(Array.from(body.keys())).toEqual(['image']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:media-preview');
    expect(portal.notify).toHaveBeenCalledWith('Foto de perfil atualizada.');
    await user.upload(
      screen.getByLabelText('Banner do perfil', { selector: 'input' }),
      new File(['banner'], 'banner.webp', { type: 'image/webp' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar banner' }));
    expect(portal.mutate.mock.calls[1][0]).toBe('/api/profile/media/banner');
  });
  it('rejeita arquivos acima de 4 MB e formatos inválidos; permite descartar sem enviar', async () => {
    const user = userEvent.setup();
    render(<ProfileMediaEditor member={member} />);
    const input = screen.getByLabelText('Foto de perfil', { selector: 'input' });
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' }),
        ],
      },
    });
    expect(screen.getByRole('alert').textContent).toContain('até 4 MB');
    fireEvent.change(input, {
      target: { files: [new File(['svg'], 'imagem.svg', { type: 'image/svg+xml' })] },
    });
    expect(screen.queryByRole('button', { name: 'Salvar foto' })).toBeNull();
    fireEvent.change(input, {
      target: { files: [new File(['ok'], 'valida.jpg', { type: 'image/jpeg' })] },
    });
    await user.click(screen.getByRole('button', { name: 'Descartar foto de perfil' }));
    expect(screen.queryByRole('button', { name: 'Salvar foto' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(portal.mutate).not.toHaveBeenCalled();
  });
  it('falha mantém a seleção para tentar novamente; remover usa somente a rota do dono', async () => {
    const user = userEvent.setup();
    portal.mutate.mockRejectedValueOnce(new Error('Armazenamento indisponível.'));
    render(<ProfileMediaEditor member={member} />);
    await user.upload(
      screen.getByLabelText('Foto de perfil', { selector: 'input' }),
      new File(['ok'], 'foto.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar foto' }));
    expect(await screen.findByText('Armazenamento indisponível.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar foto' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Descartar foto de perfil' }));
    await user.click(screen.getByRole('button', { name: 'Remover foto' }));
    expect(portal.mutate.mock.calls[1]).toEqual(['/api/profile/media/avatar', 'DELETE', undefined]);
  });
  it('foto indisponível volta às iniciais e cadastro novo orienta salvar a ficha primeiro', () => {
    render(
      <>
        <MemberAvatar name="Maria Silva" src="/api/members/a/media/avatar" />
        <ProfileMediaEditor />
      </>,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Foto de Maria Silva' }));
    expect(screen.getByText('MS')).toBeTruthy();
    expect(screen.getByText(/Salve sua ficha abaixo/)).toBeTruthy();
    expect(screen.queryByLabelText('Foto de perfil', { selector: 'input' })).toBeNull();
  });
});
