import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlenaryList } from '../src/components/plenary-list';
const fixture = vi.hoisted(() => ({
  data: {
    user: { id: 'member', admin: false },
    serverTime: '2026-10-25T20:00Z',
    members: Array.from({ length: 72 }, (_, i) => ({ id: String(i), name: `Pessoa ${i}` })),
  },
  value: {
    provider: { provider: 'kmeet', configured: true, maxCapacity: 40, moderation: 'shared' },
    records: [
      {
        id: 'a',
        title: 'Comissão de organização',
        date: '2026-10-26T13:00Z',
        agenda: ['A', 'B'],
        sessionStatus: 'open',
        electorate: 15,
      },
      {
        id: 'b',
        title: 'Reunião da direção',
        date: '2026-10-27T13:00Z',
        agenda: ['A'],
        sessionStatus: 'draft',
      },
      {
        id: 'c',
        title: 'Deliberação encerrada',
        date: '2026-10-24T13:00Z',
        agenda: ['A'],
        sessionStatus: 'closed',
      },
    ],
  },
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => ({ data: fixture.data }) }));
vi.mock('../src/components/organization-ui', () => ({
  useOrganization: () => ({ value: fixture.value, error: '' }),
  OrganizationLoading: () => null,
}));
beforeEach(() => vi.clearAllMocks());
it('total é o número real de filiados e não o número de sessões ou a capacidade do áudio', () => {
  render(<PlenaryList />);
  const metrics = within(screen.getByRole('region', { name: 'Indicadores do plenário' }));
  expect(metrics.getByText('72')).toBeTruthy();
  expect(metrics.queryByText('40')).toBeNull();
  expect(screen.getAllByRole('article')).toHaveLength(7);
  expect(screen.getByRole('link', { name: 'Acessar sessão' }).getAttribute('href')).toBe(
    '/plenario/a',
  );
});
it('busca ignora acentos e filtros de situação podem ser limpos sem novas consultas por tecla', async () => {
  const user = userEvent.setup();
  render(<PlenaryList />);
  await user.type(screen.getByRole('searchbox', { name: 'Buscar sessão' }), 'comissao');
  expect(screen.getByRole('heading', { name: 'Comissão de organização' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Reunião da direção' })).toBeNull();
  await user.click(screen.getByRole('button', { name: /^Encerradas/ }));
  expect(screen.getByText('Nenhuma sessão corresponde à busca')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /Limpar filtros/ }));
  expect(screen.getByRole('heading', { name: 'Reunião da direção' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Deliberação encerrada' })).toBeTruthy();
});
