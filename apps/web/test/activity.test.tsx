import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SectionActivity } from '../src/components/section-activity';
import { HomeCommunity } from '../src/components/home-community';
import { acknowledgeActivity, uniqueUnseenCount, type ActivityState } from '../src/lib/activity';
const portal = vi.hoisted(() => ({
  data: { user: { id: 'member' } },
  activity: null as ActivityState | null,
  markActivitySeen: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
const section = (keys: string[], title = 'Uma ideia') => ({
  total: keys.length,
  unseen: keys.length,
  keys,
  unseenKeys: keys,
  latest: keys
    .slice(0, 2)
    .map((key) => ({
      key,
      title: `${title} ${key}`,
      href: '/propostas?registro=abc',
      date: '',
      unseen: true,
    })),
});
beforeEach(() => {
  vi.clearAllMocks();
  portal.markActivitySeen.mockResolvedValue(undefined);
  portal.activity = {
    serverTime: '2026-10-25T14:00Z',
    sections: { '/propostas': section(['a', 'b']) },
  };
});
it('abrir seção confirma somente as chaves recebidas na entrada; atualização posterior continua não vista', async () => {
  const view = render(<SectionActivity path="/propostas" />);
  await waitFor(() =>
    expect(portal.markActivitySeen).toHaveBeenCalledWith('/propostas', ['a', 'b']),
  );
  portal.activity = { ...portal.activity!, sections: { '/propostas': section(['a', 'b', 'new']) } };
  view.rerender(<SectionActivity path="/propostas" />);
  expect(portal.markActivitySeen).toHaveBeenCalledTimes(1);
  view.rerender(<SectionActivity path="/painel" />);
  view.rerender(<SectionActivity path="/propostas" />);
  await waitFor(() => expect(portal.markActivitySeen).toHaveBeenCalledTimes(2));
  expect(portal.markActivitySeen).toHaveBeenLastCalledWith('/propostas', ['a', 'b', 'new']);
});
it('recibo confirmado atualiza seções relacionadas sem esconder itens que chegaram depois nem duplicar alerta da pasta', () => {
  const value: ActivityState = {
    serverTime: 'now',
    sections: { '/grupos': section(['g', 'n']), '/bancadas': section(['g', 'n', 'new']) },
  };
  expect(uniqueUnseenCount(value, ['/grupos', '/bancadas'])).toBe(3);
  const updated = acknowledgeActivity(value, ['g', 'n'])!;
  expect(updated.sections['/grupos'].unseen).toBe(0);
  expect(updated.sections['/bancadas'].unseenKeys).toEqual(['new']);
  expect(value.sections['/grupos'].unseen).toBe(2);
});
it('visão geral inclui três cards, prévias, contadores e links das novas centrais', () => {
  portal.activity!.sections['/comunicados'] = section(['c'], 'Aviso');
  portal.activity!.sections['/divulgacao'] = section(['d'], 'Matéria');
  render(<HomeCommunity />);
  expect(screen.getByRole('heading', { name: 'Central de propostas' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Mural de comunicados' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Mural de divulgação' })).toBeTruthy();
  expect(screen.getByText('2 novidades')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Uma ideia a/ }).getAttribute('href')).toBe(
    '/propostas?registro=abc',
  );
});
