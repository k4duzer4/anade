'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { type GameCalendar } from '@/lib/organization';
import { countdown, seasonClock } from '@/lib/season-clock';
import { formatDate } from '@/lib/types';
export function SeasonCountdown({
  calendar,
  compact = false,
}: {
  calendar: GameCalendar;
  compact?: boolean;
}) {
  const [elapsed, setElapsed] = useState({ source: calendar.serverTime, ms: 0 });
  useEffect(() => {
    const started = Date.now();
    const interval = setInterval(
      () => setElapsed({ source: calendar.serverTime, ms: Date.now() - started }),
      1000,
    );
    return () => clearInterval(interval);
  }, [calendar.serverTime]);
  const now =
      Date.parse(calendar.serverTime) + (elapsed.source === calendar.serverTime ? elapsed.ms : 0),
    clock = seasonClock(calendar, now);
  const events = [...calendar.milestones, ...calendar.events]
    .filter(
      (e) =>
        e.status !== 'concluido' &&
        Date.parse(e.date) > now &&
        !e.title.startsWith('Fim da votação') &&
        !e.title.startsWith('Fim da campanha') &&
        e.title !== 'Posse da direção partidária',
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);
  return (
    <div className={`season-dashboard ${compact ? 'is-compact' : ''}`}>
      <section className="panel season-phase">
        <span className="eyebrow">TEMPORADA 1 · {clock.gameDate}</span>
        <h2>{clock.phase}</h2>
        <p>{clock.description}</p>
        <div className="season-counters">
          <div>
            <span>DIA DO JOGO</span>
            <strong>
              {clock.day ?? '—'}
              <small>/{clock.duration}</small>
            </strong>
          </div>
          <div>
            <span>FALTAM</span>
            <strong>
              {clock.remaining ?? '—'}
              <small> dias</small>
            </strong>
          </div>
        </div>
        <div className="season-tick">
          <span>
            <Clock3 size={16} />
            Próximo tick · 8h de Brasília
          </span>
          <strong role="timer" aria-label="Contagem regressiva para o próximo tick">
            {countdown(clock.nextTick, now)}
          </strong>
        </div>
        <div
          className="season-progress"
          role="progressbar"
          aria-label="Progresso da temporada"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clock.progress)}
        >
          <span style={{ width: `${clock.progress}%` }} />
        </div>
        <footer>
          <span>
            Dia 1:{' '}
            {calendar.config.startDate
              ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' }).format(
                  new Date(`${calendar.config.startDate}T12:00Z`),
                )
              : 'A configurar'}
          </span>
          <span>
            {clock.end
              ? `Encerra em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(clock.end))}`
              : ''}
          </span>
        </footer>
      </section>
      <aside className="panel season-milestones">
        <header>
          <h2>Próximos marcos</h2>
          {compact && (
            <Link className="text-button" href="/calendario">
              Ver todos
              <ArrowUpRight size={13} />
            </Link>
          )}
        </header>
        {events.length ? (
          events.map((event) => {
            const days =
              event.gameDay && clock.day !== null
                ? Math.max(0, event.gameDay - clock.day)
                : Math.ceil((Date.parse(event.date) - now) / 86400000);
            return (
              <article key={event.id}>
                <div className={event.type === 'eleicao' ? 'is-election' : ''}>
                  <strong>{days}</strong>
                  <small>{days === 1 ? 'dia' : 'dias'}</small>
                </div>
                <section>
                  <h3>{event.title}</h3>
                  {event.body && <p>{event.body}</p>}
                  <span>
                    {event.gameDay ? `Dia ${event.gameDay} · ` : ''}
                    {formatDate(event.date)}
                  </span>
                  <time dateTime={event.date}>{countdown(Date.parse(event.date), now)}</time>
                </section>
              </article>
            );
          })
        ) : (
          <p>Os próximos marcos aparecerão aqui.</p>
        )}
        <small className="season-reference">
          Marcos previstos pelo calendário de referência; confira mudanças no Legado.
        </small>
      </aside>
    </div>
  );
}
