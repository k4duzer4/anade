import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
import { PortalSidebar, useSidebarPreferences } from '../src/components/portal-sidebar';
let wide = true;
const navigate = vi.fn();
function Harness({
  admin = false,
  path = '/votacoes',
  menuOpen = false,
  unseenCounts = {},
  folderCounts = {},
}: {
  admin?: boolean;
  path?: string;
  menuOpen?: boolean;
  unseenCounts?: Record<string, number>;
  folderCounts?: Record<string, number>;
}) {
  const sidebar = useSidebarPreferences();
  return (
    <TooltipProvider>
      <div
        className={sidebar.preferences.collapsed ? 'sidebar-is-collapsed' : ''}
        data-testid="shell"
      >
        <PortalSidebar
          {...sidebar}
          path={path}
          admin={admin}
          name="Maria Silva"
          menuOpen={menuOpen}
          onNavigate={navigate}
          onExit={vi.fn()}
          pendingVotes={2}
          unseenCounts={unseenCounts}
          folderCounts={folderCounts}
        />
      </div>
    </TooltipProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  wide = true;
  vi.clearAllMocks();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: wide,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
it('menu recolhido mantém contadores e submenu fechado mostra o total de novidades', async () => {
  const user = userEvent.setup();
  render(
    <Harness
      path="/painel"
      unseenCounts={{ '/propostas': 4, '/comunicados': 2 }}
      folderCounts={{ participation: 4 }}
    />,
  );
  await screen.findByLabelText('4 novidades não vistas em Participação');
  await user.click(screen.getByRole('button', { name: 'Recolher menu' }));
  expect(
    screen.getByRole('link', { name: 'Central de propostas, 4 novidades não vistas' }),
  ).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Comunicados, 2 novidades não vistas' })).toBeTruthy();
});
it('abre a seção da página atual e mantém conteúdo de outros submenus fora do teclado', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getByRole('button', { name: 'Participação' }).getAttribute('aria-expanded')).toBe(
    'true',
  );
  expect(screen.getByRole('link', { name: 'Votações internas' }).getAttribute('aria-current')).toBe(
    'page',
  );
  expect(screen.queryByRole('link', { name: 'Agenda do partido' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Dia a dia' }));
  expect(screen.getByRole('link', { name: 'Agenda do partido' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Participação' }));
  expect(screen.queryByRole('link', { name: 'Votações internas' })).toBeNull();
});
it('modo compacto preserva acesso aos ícones, esconde administração e guarda a preferência', async () => {
  const user = userEvent.setup();
  const view = render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Recolher menu' }));
  expect(screen.getByTestId('shell').className).toBe('sidebar-is-collapsed');
  expect(screen.getByRole('link', { name: 'Agenda do partido' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Financeiro' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Administração' })).toBeNull();
  expect(JSON.parse(localStorage.getItem('anade:navigation:v1') || '{}').collapsed).toBe(true);
  view.unmount();
  render(<Harness admin />);
  await screen.findByRole('button', { name: 'Expandir menu' });
  expect(screen.getByRole('link', { name: 'Administração' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Expandir menu' }));
  expect(screen.getByTestId('shell').className).toBe('');
});
it('mobile mantém submenus em vez de aplicar o modo de ícones salvo e Escape fecha a gaveta', async () => {
  wide = false;
  localStorage.setItem(
    'anade:navigation:v1',
    JSON.stringify({ collapsed: true, openGroups: { routine: false } }),
  );
  render(<Harness menuOpen />);
  await screen.findByRole('button', { name: 'Expandir menu' });
  expect(screen.queryByRole('link', { name: 'Agenda do partido' })).toBeNull();
  await userEvent.setup().keyboard('{Escape}');
  expect(navigate).toHaveBeenCalled();
});
it('preferências inválidas ou armazenamento indisponível não impedem navegação', async () => {
  localStorage.setItem('anade:navigation:v1', 'invalid JSON');
  const user = userEvent.setup();
  render(<Harness />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Recolher menu' })).toBeTruthy());
  const fail = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('unavailable');
  });
  await user.click(screen.getByRole('button', { name: 'Recolher menu' }));
  expect(screen.getByRole('button', { name: 'Expandir menu' })).toBeTruthy();
  fail.mockRestore();
});
