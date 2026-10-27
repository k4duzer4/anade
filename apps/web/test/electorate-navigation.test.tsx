import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ElectorateNavigation, electorateGroups } from '../src/components/electorate-navigation';
it('separa escopo nacional e grupos definidos sem duplicar os submenus', async () => {
  const records = [
    {},
    { groupId: 'camara', groupName: 'Bancada da Câmara' },
    { groupId: 'camara', groupName: 'Bancada da Câmara' },
    { groupId: 'senado', groupName: 'Bancada do Senado' },
  ];
  const onChange = vi.fn();
  render(<ElectorateNavigation records={records} value="camara" onChange={onChange} />);
  const nav = within(screen.getByRole('navigation', { name: 'Grupos eleitores' }));
  expect(nav.getAllByRole('button')).toHaveLength(4);
  expect(
    nav.getByRole('button', { name: 'Bancada da Câmara, 2 votações' }).getAttribute('aria-pressed'),
  ).toBe('true');
  await userEvent.setup().click(nav.getByRole('button', { name: 'Bancada do Senado, 1 votação' }));
  expect(onChange).toHaveBeenCalledWith('senado');
  expect(electorateGroups(records)[0]).toEqual({
    id: 'national',
    name: 'Todos os filiados',
    count: 1,
  });
});
