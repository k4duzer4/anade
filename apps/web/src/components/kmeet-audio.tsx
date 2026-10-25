'use client';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { Hand, LogOut, Mic, MicOff, ShieldCheck } from 'lucide-react';
import { portalRequest } from '@/lib/portal-request';
import { ErrorNotice } from './ui';
import type { Admission } from '@/lib/plenary';

type Conference = {
  addListener: (name: string, listener: (event: Record<string, unknown>) => void) => void;
  executeCommand: (name: string, ...args: unknown[]) => void;
  getIFrame: () => HTMLIFrameElement;
  dispose: () => void;
};
declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => Conference;
  }
}
export function KmeetAudio({
  admission,
  meetingId,
  csrf,
  onEnded,
  closing = false,
}: {
  admission: Admission;
  meetingId: string;
  csrf: string;
  onEnded: (message?: string) => void;
  closing?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    api = useRef<Conference | null>(null),
    connected = useRef(false),
    hand = useRef(false),
    generation = useRef(0);
  const [ready, setReady] = useState(false),
    [joined, setJoined] = useState(false),
    [muted, setMuted] = useState(true),
    [raised, setRaised] = useState(false),
    [error, setError] = useState('');
  const base = `/api/plenaries/${meetingId}`;
  useEffect(() => {
    const current = ++generation.current;
    const lifecycle = generation;
    const controller = new AbortController();
    let ended = false,
      running = false;
    const end = (message?: string) => {
      if (!ended && !controller.signal.aborted) {
        ended = true;
        onEnded(message);
      }
    };
    const presence = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        await portalRequest(`${base}/presence`, {
          method: 'PUT',
          csrf,
          body: { connected: true, handRaised: hand.current },
          signal: controller.signal,
        });
      } catch (failure) {
        if (!controller.signal.aborted) {
          const status = (failure as Error & { status?: number }).status;
          if (status && [401, 403, 404, 409].includes(status)) end((failure as Error).message);
          else
            setError(
              'A presença não pôde ser atualizada. O áudio continua; confira sua conexão com o portal.',
            );
        }
      } finally {
        running = false;
      }
    };
    if (ready && container.current && window.JitsiMeetExternalAPI) {
      // The provider controls native audio roles; canModerate refers only to the portal.
      const conference = new window.JitsiMeetExternalAPI('kmeet.infomaniak.com', {
        roomName: admission.roomName,
        parentNode: container.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName: admission.userName },
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          startAudioOnly: true,
          disableDeepLinking: true,
          enableWelcomePage: false,
          prejoinConfig: { enabled: true },
        },
      });
      api.current = conference;
      const frame = conference.getIFrame();
      frame.title = 'Reunião kMeet do plenário ANADE';
      frame.allow = 'microphone https://kmeet.infomaniak.com; autoplay; fullscreen';
      frame.referrerPolicy = 'no-referrer';
      conference.addListener('videoConferenceJoined', () => {
        connected.current = true;
        setJoined(true);
        void presence();
      });
      conference.addListener('videoConferenceLeft', () => end());
      conference.addListener('readyToClose', () => end());
      conference.addListener('audioMuteStatusChanged', (event) => setMuted(event.muted !== false));
      conference.addListener('errorOccurred', () =>
        setError('O kMeet informou uma falha. Confira sua conexão e as permissões do microfone.'),
      );
    }
    const timer = setInterval(() => {
      if (connected.current) void presence();
    }, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
      connected.current = false;
      api.current?.dispose();
      api.current = null;
      queueMicrotask(() => {
        if (lifecycle.current === current)
          void portalRequest(`${base}/leave`, { method: 'POST', csrf, body: {} }).catch(() => {});
      });
    };
  }, [ready, admission, base, csrf, onEnded]);
  useEffect(() => {
    if (closing) {
      api.current?.executeCommand('hangup');
      onEnded();
    }
  }, [closing, onEnded]);
  return (
    <section className="plenary-audio">
      <Script
        src="https://kmeet.infomaniak.com/external_api.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setError('Não foi possível carregar o kMeet. Tente novamente.')}
      />
      <div className="plenary-audio-status">
        <span className={joined ? 'is-live' : ''} />
        {joined ? 'Conectado ao kMeet' : 'Preparando entrada no kMeet…'}
        <ShieldCheck size={15} />
      </div>
      <div className="plenary-kmeet-frame" ref={container} />
      <ErrorNotice message={error} />
      <div className="plenary-audio-controls">
        <button
          className={`button ${muted ? 'secondary' : 'primary'}`}
          disabled={!joined}
          onClick={() => api.current?.executeCommand('toggleAudio')}
        >
          {muted ? <MicOff size={16} /> : <Mic size={16} />}
          {muted ? 'Ligar meu microfone' : 'Silenciar meu microfone'}
        </button>
        <button
          className="button secondary"
          aria-pressed={raised}
          disabled={!joined}
          onClick={async () => {
            const next = !hand.current;
            try {
              await portalRequest(`${base}/presence`, {
                method: 'PUT',
                csrf,
                body: { connected: true, handRaised: next },
              });
              hand.current = next;
              setRaised(next);
            } catch (failure) {
              setError((failure as Error).message);
            }
          }}
        >
          <Hand size={16} />
          {raised ? 'Retirar pedido' : 'Pedir a palavra'}
        </button>
        <button
          className="button outline"
          onClick={() => {
            api.current?.executeCommand('hangup');
            onEnded();
          }}
        >
          <LogOut size={16} />
          Sair do áudio
        </button>
      </div>
      <p className="plenary-presence-help">
        A mesa precisa confirmar sua presença para liberar quórum e voto. No kMeet gratuito, a
        moderação de áudio é compartilhada e não segue os cargos da ANADE. Sair do portal ou
        suspender uma entrada não bloqueia o link externo da sala.
      </p>
    </section>
  );
}
