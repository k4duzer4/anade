import { expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from '@radix-ui/react-tooltip';
import PortalShell from '../src/components/portal-shell';
const fixture = vi.hoisted(() => ({
  privatePage: vi.fn(),
  data: {
    user: { id: 'guest', discord: 'conta_convidada', admin: false, guest: true },
    members: [],
    meetings: [],
    polls: [],
    directors: [],
    csrf: 'own-csrf',
    serverTime: '2026-10-26T16:00Z',
  },
}));
vi.mock('../src/components/portal-provider', () => ({
  usePortal: () => ({
    data: fixture.data,
    config: { demo: false },
    loading: false,
    error: '',
    activity: null,
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/agenda',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('../src/components/theme-switcher', () => ({ ThemeSwitcher: () => null }));
vi.mock('../src/components/global-search', () => ({
  GlobalSearch: () => {
    throw new Error('Não montar busca privada para convidado');
  },
}));
vi.mock('../src/components/notification-center', () => ({
  NotificationCenter: () => {
    throw new Error('Não montar notificações privadas para convidado');
  },
}));
vi.mock('../src/components/section-activity', () => ({
  SectionActivity: () => {
    throw new Error('Não consultar atividade para convidado');
  },
}));
it('convidado recebe apenas estrutura vazia: página privada e controles de dados nunca são montados', () => {
  function PrivatePage() {
    fixture.privatePage();
    return <p>CONTEÚDO INTERNO SIGILOSO</p>;
  }
  render(
    <Provider>
      <PortalShell>
        <PrivatePage />
      </PortalShell>
    </Provider>,
  );
  expect(screen.getByRole('heading', { name: 'Agenda do partido' })).toBeTruthy();
  expect(screen.getByText('Você está conhecendo o portal.')).toBeTruthy();
  expect(screen.queryByText('CONTEÚDO INTERNO SIGILOSO')).toBeNull();
  expect(fixture.privatePage).not.toHaveBeenCalled();
  expect(screen.queryByText('Filiado verificado')).toBeNull();
  expect(screen.queryByRole('article')).toBeNull();
  expect(screen.queryByRole('searchbox')).toBeNull();
});
