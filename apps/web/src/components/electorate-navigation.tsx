'use client';
import { Landmark, Layers3, Users } from 'lucide-react';
export type ElectorateItem = { groupId?: string; groupName?: string };
export function electorateGroups(records: ElectorateItem[]) {
  const groups = new Map<string, { id: string; name: string; count: number }>();
  for (const record of records) {
    const id = record.groupId || 'national';
    const current = groups.get(id);
    groups.set(id, {
      id,
      name: id === 'national' ? 'Todos os filiados' : record.groupName || 'Grupo do partido',
      count: (current?.count || 0) + 1,
    });
  }
  return [...groups.values()].sort((a, b) =>
    a.id === 'national' ? -1 : b.id === 'national' ? 1 : a.name.localeCompare(b.name, 'pt-BR'),
  );
}
export function ElectorateNavigation({
  records,
  value,
  onChange,
  noun = 'votações',
}: {
  records: ElectorateItem[];
  value: string;
  onChange: (value: string) => void;
  noun?: string;
}) {
  const groups = electorateGroups(records);
  const quantity = (count: number) =>
    `${count} ${count === 1 ? (noun === 'sessões' ? 'sessão' : 'votação') : noun}`;
  return (
    <section className="electorate-navigation">
      <div className="electorate-navigation-heading">
        <span>
          <Users size={16} />
          Grupo eleitor
        </span>
        <small>Escolha o grupo para consultar as {noun}.</small>
      </div>
      <nav aria-label="Grupos eleitores">
        <button
          type="button"
          aria-label={`Todos os grupos, ${quantity(records.length)}`}
          aria-pressed={value === 'all'}
          onClick={() => onChange('all')}
        >
          <Layers3 size={17} />
          <span>Todos os grupos</span>
          <b>{records.length}</b>
        </button>
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            aria-pressed={value === group.id}
            aria-label={`${group.name}, ${quantity(group.count)}`}
            onClick={() => onChange(group.id)}
          >
            {group.id === 'national' ? <Landmark size={17} /> : <Users size={17} />}
            <span>{group.name}</span>
            <b>{group.count}</b>
          </button>
        ))}
      </nav>
    </section>
  );
}
