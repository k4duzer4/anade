import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import DirectionContent from '../src/components/direction-content';
import type { Member, Director } from '../src/lib/types';
const portal = vi.hoisted(() => ({
  data: { user: { admin: false }, members: [] as Member[], directors: [] as Director[] },
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
beforeEach(() => {
  portal.data.user.admin = false;
  portal.data.members = [
    {
      id: 'coord',
      name: 'Coordenação Ceará',
      state: 'SP',
      functionState: 'CE',
      functions: ['Coordenador estadual'],
    },
    { id: 'honor', name: 'Presidência de honra', state: 'MT', functions: ['Presidente de honra'] },
    {
      id: 'senate',
      name: 'Liderança Senado',
      state: 'MT',
      functions: ['Líder da bancada do Senado'],
    },
    { id: 'vice', name: 'Vice-presidência', state: 'SP', functions: ['Vice-presidente nacional'] },
    { id: 'president', name: 'Presidência', state: 'SP', functions: ['Presidente nacional'] },
    {
      id: 'chamber',
      name: 'Liderança Câmara',
      state: 'RJ',
      functions: ['Líder da bancada da Câmara'],
    },
  ] as Member[];
  // Existing manual positions must not move a coordinator above the leadership.
  portal.data.directors = [
    {
      id: 'old',
      memberId: 'coord',
      title: 'Coordenador estadual',
      position: 1,
      responsibility: '',
    },
  ];
});
it('direção separa presidência, líderes e estados nessa ordem, preservando outras funções', () => {
  const { container } = render(<DirectionContent />);
  const sections = within(
    screen.getByRole('region', { name: 'Composição do diretório' }),
  ).getAllByRole('region');
  expect(sections.map((s) => within(s).getByRole('heading', { level: 2 }).textContent)).toEqual([
    'Presidência nacional',
    'Lideranças de bancada',
    'Coordenações estaduais',
    'Demais funções partidárias',
  ]);
  const presidency = screen.getByRole('region', { name: 'Presidência nacional' });
  expect(
    within(presidency)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent),
  ).toEqual(['Presidência', 'Vice-presidência']);
  expect(presidency.querySelectorAll('.director-card.is-featured').length).toBe(2);
  const leaders = screen.getByRole('region', { name: 'Lideranças de bancada' });
  expect(
    within(leaders)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent),
  ).toEqual(['Liderança Câmara', 'Liderança Senado']);
  const states = screen.getByRole('region', { name: 'Coordenações estaduais' });
  expect(within(states).getByText('Ceará')).toBeTruthy();
  expect(within(states).queryByText('São Paulo')).toBeNull();
  expect(container.querySelectorAll('.director-card').length).toBe(6);
  expect(
    screen.getByRole('link', { name: 'Ver perfil de Coordenação Ceará' }).getAttribute('href'),
  ).toBe('/filiados/coord');
  expect(screen.queryByRole('link', { name: 'Cargos e funções' })).toBeNull();
});
it('sem funções atribuídas mostra a orientação existente, sem inventar integrantes', () => {
  portal.data.members = [];
  render(<DirectionContent />);
  expect(screen.getByRole('heading', { name: 'A direção será apresentada aqui.' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Presidência nacional' })).toBeNull();
});
