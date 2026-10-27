import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as Tooltip from '@radix-ui/react-tooltip';
import AffiliationContent from '../src/components/affiliation-content';
import AffiliationsAdmin from '../src/components/affiliations-admin';
import LegalDocument from '../src/components/legal-document';
const mock = vi.hoisted(() => ({
  request: vi.fn(),
  admin: false,
  value: {
    user: { id: 'candidate', discord: 'candidate', member: false },
    csrf: 'test-csrf',
    request: null as unknown,
    legalVersion: '2026-10-26',
    currents: ['Social-democracia'],
  },
}));
vi.mock('../src/lib/portal-request', () => ({ portalRequest: mock.request }));
vi.mock('../src/components/portal-provider', () => ({
  usePortal: () => ({
    config: { configured: true, states: ['SP', 'MG'], degrees: ['Direito', 'Economia'] },
    data: mock.admin ? { user: { admin: true }, csrf: 'csrf-admin' } : null,
    notify: vi.fn(),
  }),
}));
vi.mock('../src/components/theme-switcher', () => ({ ThemeSwitcher: () => null }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.admin = false;
  mock.value.request = null;
  mock.value.user.member = false;
  mock.request.mockResolvedValue(mock.value);
  window.scrollTo = vi.fn();
});
it('visitante recebe entrada Discord, sem formulário nem conteúdo interno', async () => {
  mock.request.mockRejectedValue(Object.assign(new Error('Entre'), { status: 401 }));
  render(<AffiliationContent />);
  expect(await screen.findByRole('link', { name: /Continuar com Discord/ })).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: 'Nome do personagem' })).toBeNull();
});
it('formulário exige aceite explícito e usa somente a sessão autenticada no envio', async () => {
  const user = userEvent.setup();
  render(<AffiliationContent />);
  await user.type(await screen.findByRole('textbox', { name: 'Nome do personagem' }), 'Personagem');
  await user.type(screen.getByRole('textbox', { name: 'Cidade de atuação' }), 'São Paulo');
  await user.type(screen.getByRole('spinbutton', { name: 'Idade do personagem' }), '30');
  for (const [label, value] of [
    ['Estado de atuação', 'SP'],
    ['Formação', 'Direito'],
    ['Corrente com que tenho afinidade', 'Social-democracia'],
  ]) {
    await user.click(screen.getByRole('combobox', { name: label }));
    await user.click(await screen.findByRole('option', { name: value }));
  }
  await user.type(screen.getByRole('textbox', { name: 'Número LegApp' }), '(11) 423-653');
  await user.type(screen.getByRole('textbox', { name: '@ do Blue' }), '@personagem');
  await user.type(
    screen.getByRole('textbox', { name: /E-mail no sistema do Legado/ }),
    'personagem@legado.test',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'O que pretende fazer no Legado?' }),
    'Atuar no Legislativo.',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Qual sua forma de contribuir com a ANADE?' }),
    'Construir propostas.',
  );
  const accept = screen.getByRole('checkbox', { name: /Li e concordo/ });
  expect((accept as HTMLInputElement).checked).toBe(false);
  await user.click(screen.getByRole('button', { name: /Enviar solicitação/ }));
  expect(
    mock.request.mock.calls.filter(([url]) => url === '/api/affiliation/requests'),
  ).toHaveLength(0);
  await user.click(accept);
  await user.click(screen.getByRole('button', { name: /Enviar solicitação/ }));
  await waitFor(() =>
    expect(mock.request).toHaveBeenCalledWith(
      '/api/affiliation/requests',
      expect.objectContaining({
        method: 'POST',
        csrf: 'test-csrf',
        body: expect.objectContaining({
          accepted: true,
          legalVersion: '2026-10-26',
          degrees: ['Direito'],
          current: 'Social-democracia',
        }),
      }),
    ),
  );
});
it('solicitação pendente mostra acompanhamento e não reapresenta cadastro nem consulta dados privados', async () => {
  mock.value.request = {
    id: 'request',
    status: 'pending',
    data: { name: 'Personagem', city: 'São Paulo', state: 'SP' },
    reviewNote: '',
  };
  render(<AffiliationContent />);
  expect(await screen.findByRole('heading', { name: 'Em análise' })).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: 'Nome do personagem' })).toBeNull();
  expect(mock.request.mock.calls.every(([url]) => url === '/api/affiliation/session')).toBe(true);
});
it('política e termos públicos têm versão, canal de privacidade e contexto do RPG', () => {
  const { unmount } = render(<LegalDocument privacy />);
  expect(screen.getByRole('heading', { name: 'Política de Privacidade' })).toBeTruthy();
  expect(screen.getByText(/Versão 2026-10-26/)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'servidor oficial do Discord' }).getAttribute('href'),
  ).toContain('discord.com/channels/');
  unmount();
  render(<LegalDocument />);
  expect(screen.getByRole('heading', { name: 'Termos e Condições de Uso' })).toBeTruthy();
});
it('fila administrativa mostra integração pendente e solicita confirmação antes de decidir', async () => {
  mock.admin = true;
  mock.request.mockResolvedValue({
    requests: [
      {
        id: 'a',
        accountId: 'candidate',
        discord: 'candidate',
        status: 'pending',
        submittedAt: '2026-10-26T16:00Z',
        data: {
          name: 'Personagem',
          city: 'São Paulo',
          state: 'SP',
          age: 30,
          degrees: ['Direito'],
          legapp: '(11) 423-653',
          email: 'rpg@legado.test',
          blue: '@personagem',
          current: 'Social-democracia',
          plans: 'Participar',
          contribution: 'Contribuir',
          legalVersion: '2026-10-26',
          acceptedAt: '2026-10-26T16:00Z',
        },
      },
    ],
    total: 1,
    botConfigured: false,
  });
  const user = userEvent.setup();
  render(
    <Tooltip.Provider>
      <AffiliationsAdmin />
    </Tooltip.Provider>,
  );
  expect(await screen.findByText('Integração do bot pendente de configuração')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /Ver solicitação/ }));
  await user.click(screen.getByRole('button', { name: 'Aprovar filiação' }));
  expect(screen.getByRole('button', { name: 'Confirmar aprovação' })).toBeTruthy();
  expect(mock.request.mock.calls.filter(([url]) => url.includes('/review'))).toHaveLength(0);
});
