import { brasiliaDay } from './checkins.js';
const DAY = 86400000;
export const seasonSource = 'https://legado.planalto.fun/jogo/temporada';
export const wikiSource = 'https://legado.planalto.fun/wiki/temporada-e-tempo';
export function legadoCalendar(config = {}, now = new Date()) {
  const today = brasiliaDay(now);
  const tickToday = new Date(`${today}T08:00:00-03:00`);
  const nextTick = new Date(tickToday.getTime() + (now >= tickToday ? DAY : 0)).toISOString();
  if (!config.startDate)
    return {
      serverTime: now.toISOString(),
      today,
      nextTick,
      day: null,
      gameDate: 'Temporada não configurada',
      milestones: [],
      source: seasonSource,
      wiki: wikiSource,
      config,
    };
  const start = new Date(`${config.startDate}T08:00:00-03:00`).getTime();
  const day = Math.floor((now.getTime() - start) / DAY) + 1;
  const milestones = [];
  const add = (d, h, title, type, body = '') =>
    milestones.push({
      id: `wiki-${d}-${h}-${type}`,
      title,
      type,
      gameDay: d,
      body,
      date: new Date(start + (d - 1) * DAY + (h - 8) * 3600000).toISOString(),
      estimated: true,
    });
  for (let cycle = 0; cycle < 4; cycle++) {
    const first = 8 + cycle * 24;
    add(first - 1, 23, `Fim da campanha · eleição ${cycle + 1}`, 'campanha');
    add(first, 10, `1º turno · eleição ${cycle + 1}`, 'eleicao');
    add(first, 18, `Fim da votação · 1º turno ${cycle + 1}`, 'eleicao');
    add(first + 2, 23, `Fim da campanha · 2º turno ${cycle + 1}`, 'campanha');
    add(
      first + 3,
      10,
      `2º turno · eleição ${cycle + 1}`,
      'eleicao',
      'Urna das 10h às 18h; apuração até as 20h50.',
    );
    add(first + 3, 18, `Fim da votação · 2º turno ${cycle + 1}`, 'eleicao');
    add(first + 4, 8, `Posse · mandato ${cycle + 1}`, 'posse');
    if (cycle < 3) {
      const internal = 19 + cycle * 24;
      add(
        internal,
        8,
        'Chapas da eleição interna',
        'partido',
        'Inscrições da direção até as 21h do dia seguinte.',
      );
      add(
        internal + 2,
        8,
        'Eleição interna dos partidos',
        'partido',
        'Votação até as 21h do dia seguinte.',
      );
      add(internal + 4, 8, 'Posse da direção partidária', 'posse');
    }
    if (cycle > 0) {
      const window = 24 + (cycle - 1) * 24;
      add(window, 8, 'Janela partidária', 'partido', 'Dois dias para mudar de partido.');
      add(window + 2, 21, 'Fim da filiação e do domicílio', 'prazo');
      add(
        window + 3,
        8,
        'Convenções e DRAP',
        'partido',
        'Dois dias para chapas, coligações e registros.',
      );
      add(
        window + 5,
        8,
        'Começa a campanha',
        'campanha',
        'Julgamento dos DRAPs e início da campanha.',
      );
    }
  }
  add(config.duration || 90, 22, 'Encerramento previsto da temporada', 'temporada');
  const months = (day - 12) * 2;
  const gameDate =
    day < 1
      ? 'A temporada ainda não começou'
      : day <= 4
        ? '2018 · pré-temporada'
        : day <= 11
          ? 'Outubro de 2018'
          : new Intl.DateTimeFormat('pt-BR', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(Date.UTC(2019, months, 1)));
  return {
    serverTime: now.toISOString(),
    today,
    nextTick,
    day,
    gameDate,
    milestones: milestones
      .filter((x) => Date.parse(x.date) <= start + (config.duration || 90) * DAY)
      .sort((a, b) => a.date.localeCompare(b.date)),
    source: seasonSource,
    wiki: wikiSource,
    config,
  };
}
// Only the fixed public season URL is queried. Never use a player's cookies or scrape a login.
export async function publicSeason(request = fetch) {
  const response = await request(seasonSource, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || response.status >= 300) return null;
  const html = await response.text();
  // Import only an explicitly declared season start, never dates from scripts or examples.
  const start = html.match(/data-temporada-inicio=["'](\d{4}-\d{2}-\d{2})["']/)?.[1];
  return start || null;
}
