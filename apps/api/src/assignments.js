import { assert, states } from './domain.js';
import { electoralOffices } from './checkins.js';
export const partyFunctions = [
  'Presidente nacional',
  'Vice-presidente nacional',
  'Presidente estadual',
  'Coordenador estadual',
  'Presidente de honra',
  'Secretário-geral',
  'Jurídico',
  'Comunicação',
  'Financeiro',
  'Tesoureiro',
  'Líder de bancada',
  'Líder da bancada da Câmara',
  'Líder da bancada do Senado',
];
export const emptyAssignment = () => ({
  office: '',
  officeState: '',
  functions: [],
  functionState: '',
});
export const hasFunction = (user, ...names) =>
  names.some((name) => user.assignment?.functions.includes(name));
export const isLegal = (user) => hasFunction(user, 'Jurídico');
export const isFinance = (user) => hasFunction(user, 'Financeiro', 'Tesoureiro');
export const officeForGroup = (type) =>
  ({ camara: 'Deputado federal', senado: 'Senador' })[type] || '';
export function assignmentDetails(input) {
  const office = input.office || '',
    officeState = input.officeState || '',
    functions = input.functions ?? [],
    functionState = input.functionState || '';
  assert(!office || electoralOffices.includes(office), 'Escolha um cargo eletivo válido.');
  assert(!officeState || states.includes(officeState), 'Escolha um estado válido para o cargo.');
  assert(
    Array.isArray(functions) &&
      functions.length <= partyFunctions.length &&
      new Set(functions).size === functions.length &&
      functions.every((f) => partyFunctions.includes(f)),
    'Escolha funções partidárias válidas.',
  );
  assert(
    !functionState || states.includes(functionState),
    'Escolha um estado válido para a função.',
  );
  assert(
    !functions.some((f) => ['Presidente estadual', 'Coordenador estadual'].includes(f)) ||
      functionState,
    'Informe o estado da função estadual.',
  );
  assert(
    !functions.includes('Líder da bancada da Câmara') || office === 'Deputado federal',
    'A liderança da Câmara exige o cargo de deputado federal.',
  );
  assert(
    !functions.includes('Líder da bancada do Senado') || office === 'Senador',
    'A liderança do Senado exige o cargo de senador.',
  );
  return {
    office,
    officeState: office ? officeState : '',
    functions: [...functions],
    functionState: functions.some((f) =>
      ['Presidente estadual', 'Coordenador estadual'].includes(f),
    )
      ? functionState
      : '',
  };
}
export function assertParliamentaryOffice(governance, assignment, groupType = '') {
  const required = officeForGroup(groupType) || governance?.requiredOffice;
  if (required)
    assert(
      assignment?.office === required,
      `Esta votação exige o cargo de ${required}, definido pela administração.`,
      403,
    );
}
export function groupAssignment(group, members) {
  if (group.type === 'estadual') {
    const stateTeam = members.filter(
      (m) =>
        m.functionState === group.state &&
        m.functions.some((f) => ['Presidente estadual', 'Coordenador estadual'].includes(f)),
    );
    return {
      ...group,
      memberIds: [...new Set([...group.memberIds, ...stateTeam.map((m) => m.id)])],
      leaderId:
        stateTeam.find((m) => m.functions.includes('Presidente estadual'))?.id || group.leaderId,
    };
  }
  const required = officeForGroup(group.type);
  const fn = {
    juridico: ['Jurídico'],
    tesouraria: ['Financeiro', 'Tesoureiro'],
    comunicacao: ['Comunicação'],
    direcao: [
      'Presidente nacional',
      'Vice-presidente nacional',
      'Presidente de honra',
      'Secretário-geral',
    ],
  }[group.type];
  const matching = required
    ? members.filter((m) => m.office === required)
    : fn
      ? members.filter((m) => m.functions.some((f) => fn.includes(f)))
      : null;
  const leaders = {
    camara: 'Líder da bancada da Câmara',
    senado: 'Líder da bancada do Senado',
    direcao: 'Presidente nacional',
  };
  const leader = matching?.find((m) => m.functions.includes(leaders[group.type]));
  return matching
    ? {
        ...group,
        memberIds: matching.map((m) => m.id),
        leaderId:
          leader?.id ||
          (['camara', 'senado', 'direcao'].includes(group.type)
            ? ''
            : matching.some((m) => m.id === group.leaderId)
              ? group.leaderId
              : ''),
        membershipMode: 'assignment',
      }
    : group;
}
