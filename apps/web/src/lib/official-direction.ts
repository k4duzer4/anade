import { type Member, type Director, searchText } from './types';
const order = [
  'Presidente nacional',
  'Vice-presidente nacional',
  'Líder da bancada da Câmara',
  'Líder da bancada do Senado',
  'Líder de bancada',
  'Presidente de honra',
  'Secretário-geral',
  'Presidente estadual',
  'Coordenador estadual',
  'Jurídico',
  'Comunicação',
  'Financeiro',
  'Tesoureiro',
];
const roleOf = (director: Director) => director.title.split(' · ')[0];
export function directionSections(directors: Director[]) {
  const presidency = ['Presidente nacional', 'Vice-presidente nacional'];
  const leaders = ['Líder da bancada da Câmara', 'Líder da bancada do Senado', 'Líder de bancada'];
  const states = ['Presidente estadual', 'Coordenador estadual'];
  const selected = [...presidency, ...leaders, ...states];
  return [
    {
      id: 'presidency',
      title: 'Presidência nacional',
      featured: true,
      directors: directors
        .filter((d) => presidency.includes(roleOf(d)))
        .sort(
          (a, b) =>
            presidency.indexOf(roleOf(a)) - presidency.indexOf(roleOf(b)) ||
            a.position - b.position,
        ),
    },
    {
      id: 'leaders',
      title: 'Lideranças de bancada',
      featured: false,
      directors: directors
        .filter((d) => leaders.includes(roleOf(d)))
        .sort(
          (a, b) =>
            leaders.indexOf(roleOf(a)) - leaders.indexOf(roleOf(b)) || a.position - b.position,
        ),
    },
    {
      id: 'states',
      title: 'Coordenações estaduais',
      featured: false,
      directors: directors.filter((d) => states.includes(roleOf(d))),
    },
    {
      id: 'other',
      title: 'Demais funções partidárias',
      featured: false,
      directors: directors.filter((d) => !selected.includes(roleOf(d))),
    },
  ].filter((section) => section.directors.length);
}
export function officialDirection(members: Member[], metadata: Director[] = []): Director[] {
  return members
    .flatMap((m) =>
      (m.functions || [])
        .filter((f) => order.includes(f))
        .map((f) => {
          const old = metadata.find(
            (d) => d.memberId === m.id && searchText(d.title) === searchText(f),
          );
          return {
            id: `assignment:${m.id}:${f}`,
            memberId: m.id,
            title:
              f +
              (['Presidente estadual', 'Coordenador estadual'].includes(f) && m.functionState
                ? ` · ${m.functionState}`
                : ''),
            responsibility: old?.responsibility || '',
            position: old?.position ?? order.indexOf(f) + 1,
          };
        }),
    )
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.title.localeCompare(b.title, 'pt-BR') ||
        a.memberId.localeCompare(b.memberId),
    );
}
