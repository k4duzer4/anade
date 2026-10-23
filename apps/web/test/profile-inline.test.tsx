import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import MemberProfile from '../src/components/member-profile';
import { exportProfileCrop } from '../src/lib/profile-crop';
const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'owner', admin: true },
    members: [
      {
        id: 'owner',
        name: 'Pessoa do RPG',
        degrees: [],
        age: 35,
        state: 'SP',
        city: 'São Paulo',
        season: '1',
        avatarUrl: '/api/members/owner/media/avatar',
        bannerUrl: '/api/members/owner/media/banner',
      },
      {
        id: 'another',
        name: 'Outro Filiado',
        degrees: [],
        age: 30,
        state: 'MG',
        city: 'Belo Horizonte',
        season: '1',
        avatarUrl: '/api/members/another/media/avatar',
        bannerUrl: '/api/members/another/media/banner',
      },
    ],
    directors: [],
  },
  mutate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/profile-crop', async (original) => ({
  ...(await original<typeof import('../src/lib/profile-crop')>()),
  exportProfileCrop: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:inline-test');
  URL.revokeObjectURL = vi.fn();
  portal.mutate.mockResolvedValue(undefined);
  vi.mocked(exportProfileCrop).mockResolvedValue(
    new File(['cropped'], 'avatar.webp', { type: 'image/webp' }),
  );
});
it('controles de foto e banner aparecem só no perfil do dono, inclusive para administrador', () => {
  const { rerender } = render(
    <TooltipProvider>
      <MemberProfile />
    </TooltipProvider>,
  );
  expect(screen.getByLabelText('Trocar foto de perfil')).toBeTruthy();
  expect(screen.getByLabelText('Trocar banner do perfil')).toBeTruthy();
  rerender(
    <TooltipProvider>
      <MemberProfile memberId="another" />
    </TooltipProvider>,
  );
  expect(screen.queryByLabelText('Trocar foto de perfil')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Outro Filiado' })).toBeTruthy();
});
it('recortar exige confirmação antes de salvar e cancelar preserva a foto atual', async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <MemberProfile />
    </TooltipProvider>,
  );
  await user.upload(
    screen.getByLabelText('Trocar foto de perfil'),
    new File(['png'], 'foto.png', { type: 'image/png' }),
  );
  const img = await screen.findByRole('img', { name: 'Imagem em edição' });
  Object.defineProperties(img, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
  fireEvent.load(img);
  await user.click(screen.getByRole('button', { name: 'Usar recorte' }));
  expect(await screen.findByRole('dialog', { name: 'Salvar foto de perfil' })).toBeTruthy();
  expect(portal.mutate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(portal.mutate).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Retirar foto de perfil' }));
  await waitFor(() =>
    expect(portal.mutate).toHaveBeenCalledWith('/api/profile/media/avatar', 'DELETE', undefined),
  );
});
