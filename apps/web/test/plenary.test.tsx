import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { PlenaryRoom } from '../src/components/plenary-room';
import { portalRequest } from '../src/lib/portal-request';

const portal = vi.hoisted(() => ({
  data: {
    user: { id: 'member', admin: false },
    csrf: 'csrf',
    members: [{ id: 'member', name: 'Maria' }],
  },
  notify: vi.fn(),
}));
vi.mock('../src/components/portal-provider', () => ({ usePortal: () => portal }));
vi.mock('../src/lib/portal-request', () => ({ portalRequest: vi.fn() }));
vi.mock('next/script', () => ({
  default: function MockScript({ onReady }: { onReady: () => void }) {
    useEffect(() => {
      onReady();
    }, [onReady]);
    return null;
  },
}));
const admission = {
  domain: 'kmeet.infomaniak.com',
  roomName: 'anade10000000000040008000000000000001',
  userName: 'Maria',
  canModerate: false,
  moderation: 'shared',
};
const state = () => ({
  meeting: {
    id: 'meeting',
    title: 'Plenário de teste',
    date: '2026-10-25T20:00:00Z',
    agenda: [],
    groupId: '',
  },
  session: {
    status: 'open',
    capacity: 40,
    quorumPercent: 50,
    electorIds: ['member'],
    moderatorIds: [],
    activeTopic: 0,
    sharedModerationAccepted: true,
  },
  provider: { provider: 'kmeet', configured: true, maxCapacity: 40, moderation: 'shared' },
  canManage: false,
  canModerate: false,
  availableIds: ['member'],
  attendees: [],
  present: 0,
  quorum: 1,
  quorumReached: false,
  polls: [],
  serverTime: '2026-10-25T20:00:00Z',
});
let events: Record<string, (event: Record<string, unknown>) => void>;
let dispose = vi.fn<() => void>();
beforeEach(() => {
  vi.clearAllMocks();
  portal.data.members = [{ id: 'member', name: 'Maria' }];
  events = {};
  dispose = vi.fn();
  window.JitsiMeetExternalAPI = class {
    frame: HTMLIFrameElement;
    constructor(domain: string, options: Record<string, unknown>) {
      expect(domain).toBe('kmeet.infomaniak.com');
      this.frame = document.createElement('iframe');
      (options.parentNode as HTMLElement).append(this.frame);
    }
    addListener(name: string, fn: (event: Record<string, unknown>) => void) {
      events[name] = fn;
    }
    executeCommand() {}
    getIFrame() {
      return this.frame;
    }
    dispose() {
      dispose();
      this.frame.remove();
    }
  };
  vi.mocked(portalRequest).mockImplementation(async (url) => {
    if (url.endsWith('/join')) return admission;
    if (url === '/api/plenaries/meeting') return state();
    return { ok: true };
  });
});
afterEach(() => {
  delete window.JitsiMeetExternalAPI;
});

it('áudio só carrega após entrada explícita; presença depende do evento da conferência', async () => {
  const user = userEvent.setup(),
    view = render(<PlenaryRoom id="meeting" />);
  await screen.findByRole('button', { name: 'Entrar no áudio' });
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Preparar plenário' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Entrar no áudio' }));
  await screen.findByTitle('Reunião kMeet do plenário ANADE');
  expect(vi.mocked(portalRequest).mock.calls.some(([u]) => u.endsWith('/presence'))).toBe(false);
  await act(async () => {
    events.videoConferenceJoined({});
  });
  await screen.findByText('Conectado ao kMeet');
  const frame = screen.getByTitle('Reunião kMeet do plenário ANADE');
  await user.click(screen.getByRole('button', { name: 'Ampliar sala' }));
  expect(screen.getByTitle('Reunião kMeet do plenário ANADE')).toBe(frame);
  expect(dispose).not.toHaveBeenCalled();
  expect(
    vi
      .mocked(portalRequest)
      .mock.calls.some(
        ([u, o]) => u.endsWith('/presence') && (o?.body as { connected?: boolean }).connected,
      ),
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Confirmar presença' })).toBeNull();
  expect(screen.getByText(/moderação de áudio é compartilhada/)).toBeTruthy();
  view.unmount();
  await waitFor(() => expect(dispose).toHaveBeenCalledTimes(1));
});

it('lista inclui filiados ainda não conectados, pagina e permite busca nominal', async () => {
  portal.data.members = Array.from({ length: 26 }, (_, i) => ({
    id: `p${i}`,
    name: `Pessoa ${String(i).padStart(2, '0')}`,
  }));
  vi.mocked(portalRequest).mockImplementation(async () => ({
    ...state(),
    availableIds: portal.data.members.map((m) => m.id),
  }));
  const user = userEvent.setup();
  render(<PlenaryRoom id="meeting" />);
  const roster = within(await screen.findByRole('region', { name: 'Lista de presença' }));
  expect(roster.getAllByRole('article')).toHaveLength(24);
  expect(roster.getAllByText('Não conectado')).toHaveLength(24);
  await user.click(roster.getByRole('button', { name: /Mostrar mais/ }));
  expect(roster.getAllByRole('article')).toHaveLength(26);
  await user.type(roster.getByRole('searchbox', { name: 'Buscar participante' }), 'Pessoa 25');
  expect(roster.getAllByRole('article')).toHaveLength(1);
  expect(roster.getByText('Pessoa 25')).toBeTruthy();
});

it('mesa confirma presença pelo endpoint próprio, separado de entrada no áudio', async () => {
  vi.mocked(portalRequest).mockImplementation(async (url) =>
    url === '/api/plenaries/meeting'
      ? {
          ...state(),
          canModerate: true,
          attendees: [
            {
              id: 'member',
              active: true,
              verified: false,
              connected: true,
              handRaised: false,
              excluded: false,
            },
          ],
        }
      : { ok: true },
  );
  const user = userEvent.setup();
  render(<PlenaryRoom id="meeting" />);
  await user.click(await screen.findByRole('button', { name: 'Confirmar presença' }));
  expect(portalRequest).toHaveBeenCalledWith(
    '/api/plenaries/meeting/attendees/member',
    expect.objectContaining({ method: 'PUT', body: { verified: true }, csrf: 'csrf' }),
  );
  expect(document.querySelector('iframe')).toBeNull();
});
