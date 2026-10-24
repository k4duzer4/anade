import { type Member, type Director, searchText } from './types';
const order = [
  'Presidente nacional',
  'Vice-presidente nacional',
  'Presidente de honra',
  'Secretário-geral',
  'Presidente estadual',
  'Coordenador estadual',
  'Líder de bancada',
  'Líder da bancada da Câmara',
  'Líder da bancada do Senado',
  'Jurídico',
  'Comunicação',
  'Financeiro',
  'Tesoureiro',
];
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
