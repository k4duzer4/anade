import { assert } from './domain.js';
export const RANKING_PAGE_SIZE = 20;
export function rankingFilters(query, today) {
  const period = query.period ?? '30';
  const page = query.page === undefined ? 0 : Number(query.page);
  assert(['7', '30', 'all'].includes(period), 'Escolha um período válido.');
  assert(Number.isInteger(page) && page >= 0 && page <= 100000, 'Página inválida.');
  const since =
    period === 'all'
      ? null
      : new Date(Date.parse(`${today}T12:00:00Z`) - (Number(period) - 1) * 86400000)
          .toISOString()
          .slice(0, 10);
  return { period, page, since, until: today };
}
