import { randomUUID } from 'node:crypto';
import { assertElector, pollOutcome } from './governance.js';
export const ideologies = [
  'Socialismo',
  'Social-democracia',
  'Trabalhismo e desenvolvimentismo',
  'Centro',
  'Liberalismo social',
  'Liberalismo econômico',
  'Centro-direita conservadora',
  'Conservadorismo nacionalista',
];
export const degrees = [
  'Direito',
  'Economia',
  'Administração',
  'Ciências Contábeis',
  'Jornalismo',
  'Ciência Política',
  'Engenharia',
  'Medicina',
  'Agronomia',
];
export const states = ['SP', 'MG', 'RS', 'BA'];
export function assert(ok, message, status = 400) {
  if (!ok) throw Object.assign(new Error(message), { status });
}
export function text(value, max = 200, required = true) {
  assert(typeof value === 'string', 'Informe um texto válido.');
  const clean = value.trim();
  assert(
    (!required || clean.length > 0) && clean.length <= max,
    `Texto obrigatório ou maior que ${max} caracteres.`,
  );
  return clean;
}
export function directorDetails(input) {
  const position = input.position;
  assert(
    Number.isInteger(position) && position >= 1 && position <= 99,
    'A ordem deve ser um número de 1 a 99.',
  );
  return {
    memberId: text(input.memberId, 100),
    title: text(input.title, 100),
    responsibility: text(input.responsibility ?? '', 500, false),
    position,
  };
}
export function profile(input) {
  const result = {};
  for (const key of [
    'name',
    'blue',
    'legapp',
    'state',
    'ideology',
    'profession',
    'city',
    'season',
    'oab',
    'bio',
  ])
    result[key] = text(
      input[key] ?? '',
      key === 'bio' ? 280 : 120,
      ['name', 'state', 'ideology', 'season'].includes(key),
    );
  assert(states.includes(result.state), 'Domicílio deve ser SP, MG, RS ou BA.');
  assert(ideologies.includes(result.ideology), 'Escolha uma das oito ideologias do Legado.');
  assert(
    !result.blue || /^@[\p{L}\p{N}_.]{1,40}$/u.test(result.blue),
    'Informe o Blue no formato @usuario.',
  );
  const number = result.legapp.replace(/\D/g, '');
  const ddds = [
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '31',
    '32',
    '33',
    '34',
    '35',
    '37',
    '38',
    '51',
    '53',
    '54',
    '55',
    '71',
    '73',
    '74',
    '75',
    '77',
  ];
  assert(
    !result.legapp ||
      (number.length === 8 && ddds.includes(number.slice(0, 2)) && /[2-9]/.test(number[2])),
    'LegApp: DDD do jogo e seis dígitos, por exemplo (11) 423-653.',
  );
  result.legapp = number ? `(${number.slice(0, 2)}) ${number.slice(2, 5)}-${number.slice(5)}` : '';
  result.shareLegapp = input.shareLegapp === true;
  result.age = Number(input.age);
  assert(
    Number.isInteger(result.age) && result.age >= 18 && result.age <= 120,
    'Informe a idade do personagem entre 18 e 120.',
  );
  assert(
    Array.isArray(input.degrees) &&
      input.degrees.length <= 2 &&
      new Set(input.degrees).size === input.degrees.length &&
      input.degrees.every((d) => degrees.includes(d)),
    'Escolha até duas faculdades da lista do jogo.',
  );
  result.degrees = input.degrees;
  return result;
}
export function publicMember(member, viewerId) {
  const result = { ...member };
  if (member.id !== viewerId && !member.shareLegapp) delete result.legapp;
  return result;
}
export function meetingLink(value, kind, required = false) {
  const label = kind === 'meet' ? 'Google Meet' : 'Google Docs da ata';
  const clean = text(value ?? '', 2048, false);
  assert(!required || clean, `Informe o link do ${label}.`);
  if (!clean) return '';
  let url;
  try {
    url = new URL(clean);
  } catch {
    assert(false, `Informe um link válido do ${label}.`);
  }
  const validPath =
    kind === 'meet'
      ? /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname) ||
        /^\/lookup\/[a-z0-9_-]{3,100}\/?$/i.test(url.pathname)
      : /^\/document\/(?:u\/\d+\/)?d\/[a-z0-9_-]+(?:\/(?:edit|view|preview))?\/?$/i.test(
          url.pathname,
        ) || /^\/document\/d\/e\/[a-z0-9_-]+\/pub\/?$/i.test(url.pathname);
  assert(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname === (kind === 'meet' ? 'meet.google.com' : 'docs.google.com') &&
      validPath,
    `Use um link HTTPS do ${label}, com o endereço da ${kind === 'meet' ? 'chamada' : 'ata'}.`,
  );
  return url.toString();
}
export function meetingDetails(input, { creating = false } = {}) {
  assert(input && typeof input === 'object', 'Informe os dados da reunião.');
  const timestamp = Date.parse(input.date);
  assert(
    Number.isFinite(timestamp) && (!creating || timestamp > Date.now()),
    creating ? 'Informe uma data futura válida.' : 'Informe uma data válida.',
  );
  assert(
    Array.isArray(input.agenda) && input.agenda.length > 0 && input.agenda.length <= 30,
    'Informe de 1 a 30 pautas.',
  );
  return {
    title: text(input.title),
    date: new Date(timestamp).toISOString(),
    location: 'Google Meet',
    meetUrl: meetingLink(input.meetUrl, 'meet', true),
    docsUrl: meetingLink(input.docsUrl, 'docs'),
    agenda: input.agenda.map((item) => text(item, 500)),
    minutes: text(input.minutes ?? '', 10000, false),
  };
}
export function newPoll(input, author) {
  assert(Array.isArray(input.options), 'Informe uma lista de alternativas.');
  const options = input.options
    .map((o) => text(o, 120))
    .filter(
      (option) =>
        option
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase() !== 'abstencao',
    );
  assert(
    Array.isArray(options) &&
      options.length >= 2 &&
      options.length <= 10 &&
      new Set(options).size === options.length,
    'Informe de 2 a 10 alternativas diferentes.',
  );
  assert(
    Number.isFinite(Date.parse(input.deadline)) && Date.parse(input.deadline) > Date.now(),
    'O prazo deve estar no futuro.',
  );
  return {
    id: randomUUID(),
    title: text(input.title),
    description: text(input.description ?? '', 6000, false),
    options: [...options, 'Abstenção'],
    deadline: new Date(input.deadline).toISOString(),
    secret: input.secret === true,
    author,
    createdAt: new Date().toISOString(),
    closed: false,
    votes: {},
  };
}
export function castVote(poll, userId, option) {
  assertElector(poll.governance, userId);
  assert(
    !poll.closed && Date.parse(poll.deadline) > Date.now(),
    'Esta votação está encerrada.',
    409,
  );
  assert(!Object.hasOwn(poll.votes, userId), 'Seu voto já foi registrado.', 409);
  assert(
    Number.isInteger(option) && option >= 0 && option < poll.options.length,
    'Alternativa inválida.',
  );
  poll.votes[userId] = option;
}
export function presentPoll(poll, userId) {
  const { votes, ...result } = poll;
  result.closed = poll.closed || Date.parse(poll.deadline) <= Date.now();
  result.total = Object.keys(votes).length;
  result.hasVoted = Object.hasOwn(votes, userId);
  result.myVote = votes[userId] ?? null;
  result.canVote =
    !poll.governance ||
    (poll.governance.electorIds.includes(userId) &&
      Date.parse(poll.governance.opensAt) <= Date.now());
  result.abstentionIndex = poll.options.findIndex((label) => label === 'Abstenção');
  if (result.closed || !poll.secret) {
    result.counts = poll.options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
    result.abstentions = result.abstentionIndex >= 0 ? result.counts[result.abstentionIndex] : 0;
    result.validVotes = result.total - result.abstentions;
  }
  if (!poll.secret) result.ballots = Object.entries(votes).map(([id, option]) => ({ id, option }));
  if (result.closed && result.counts) result.outcome = pollOutcome(poll, result.counts);
  return result;
}
