import { assert } from './domain.js';

export function votingRules(input, availableIds, group) {
  const ids = input.electorIds ?? availableIds;
  assert(
    Array.isArray(ids) &&
      ids.length > 0 &&
      ids.length <= 5000 &&
      new Set(ids).size === ids.length &&
      ids.every((id) => availableIds.includes(id)),
    'Escolha eleitores pertencentes ao grupo e com ficha cadastrada.',
  );
  const quorumPercent = Number(input.quorumPercent ?? 0);
  const rule = input.approvalRule || 'plurality';
  assert(
    Number.isInteger(quorumPercent) && quorumPercent >= 0 && quorumPercent <= 100,
    'O quórum deve estar entre 0 e 100%.',
  );
  assert(['plurality', 'absolute', 'two_thirds'].includes(rule), 'Escolha uma regra de aprovação.');
  const opensAt = input.opensAt ? new Date(input.opensAt).getTime() : Date.now();
  assert(
    Number.isFinite(opensAt) && opensAt < Date.parse(input.deadline),
    'A abertura deve ser anterior ao encerramento.',
  );
  return {
    groupId: group?.id || '',
    groupName: group?.name || 'Todos os filiados',
    electorIds: [...ids],
    quorumPercent,
    rule,
    opensAt: new Date(opensAt).toISOString(),
  };
}
export function assertElector(governance, id) {
  if (!governance) return;
  assert(
    governance.electorIds.includes(id),
    'Você não faz parte do eleitorado desta votação.',
    403,
  );
  assert(Date.parse(governance.opensAt) <= Date.now(), 'Esta votação ainda não abriu.', 409);
}
export function pollOutcome(poll, counts) {
  const g = poll.governance;
  if (!g) return undefined;
  const total = counts.reduce((a, b) => a + b, 0);
  const quorum = Math.ceil((g.electorIds.length * g.quorumPercent) / 100);
  const valid = counts
    .map((count, index) => ({ count, index }))
    .filter((x) => poll.options[x.index] !== 'Abstenção');
  const best = Math.max(0, ...valid.map((x) => x.count));
  const winners = valid.filter((x) => x.count === best && best > 0);
  const threshold =
    g.rule === 'absolute'
      ? Math.floor(g.electorIds.length / 2) + 1
      : g.rule === 'two_thirds'
        ? Math.ceil((g.electorIds.length * 2) / 3)
        : 1;
  return {
    quorum,
    quorumReached: total >= quorum,
    electorate: g.electorIds.length,
    threshold,
    winner: total >= quorum && winners.length === 1 && best >= threshold ? winners[0].index : null,
    reason:
      total < quorum
        ? 'Quórum não atingido'
        : winners.length !== 1
          ? 'Sem vencedor único'
          : best < threshold
            ? 'Regra de aprovação não atingida'
            : 'Alternativa vencedora',
  };
}
