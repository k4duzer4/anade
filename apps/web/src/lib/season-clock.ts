import type { GameCalendar } from './organization';
export const REAL_DAY = 86400000;
export function countdown(target: number, now: number) {
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    rest = seconds % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
export function seasonClock(calendar: GameCalendar, now: number) {
  const anchor = Date.UTC(2000, 0, 1, 11);
  const nextTick = anchor + (Math.floor((now - anchor) / REAL_DAY) + 1) * REAL_DAY;
  const duration = calendar.config.duration || 90;
  const start = calendar.config.startDate
    ? Date.parse(`${calendar.config.startDate}T08:00:00-03:00`)
    : null;
  const day = start === null ? null : Math.floor((now - start) / REAL_DAY) + 1;
  const end = start === null ? null : start + (duration - 1) * REAL_DAY + 14 * 3600000;
  const ended = end !== null && now >= end;
  let phase = 'Temporada',
    description = 'Acompanhe as próximas etapas do jogo.';
  if (day !== null) {
    const cycle = Math.max(0, Math.floor((day - 5) / 24)),
      relative = day - cycle * 24;
    if (day < 1) {
      phase = 'Em breve';
      description = 'A temporada ainda não começou.';
    } else if (ended) {
      phase = 'Encerrada';
      description = 'A temporada chegou ao fim.';
    } else if (day <= 4) {
      phase = 'Pré-temporada';
      description = 'Organização dos partidos, candidaturas e registros.';
    } else if ([8, 11].includes(relative)) {
      phase = 'Dia de eleição';
      description = 'Urna das 10h às 18h de Brasília.';
    } else if ([5, 6, 7, 9, 10].includes(relative)) {
      phase = 'Campanha';
      description = 'Comício, propaganda e debates.';
    } else {
      phase = 'Mandato em andamento';
      description = 'Trabalho parlamentar e construção partidária.';
    }
  }
  const gameDate =
    day === null
      ? 'Temporada não configurada'
      : day < 1
        ? 'Aguardando início'
        : day <= 4
          ? '2018 · pré-temporada'
          : day <= 11
            ? 'Outubro de 2018'
            : new Intl.DateTimeFormat('pt-BR', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(Date.UTC(2019, (day - 12) * 2, 1)));
  return {
    day,
    duration,
    nextTick,
    start,
    end,
    phase,
    description,
    gameDate,
    ended,
    progress: day === null ? 0 : Math.min(100, Math.max(0, (day / duration) * 100)),
    remaining: day === null ? null : Math.max(0, duration - day),
  };
}
