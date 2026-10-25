'use client';
import Link from 'next/link';
import { ArrowUpRight, Lightbulb, Megaphone, Newspaper } from 'lucide-react';
import { usePortal } from './portal-provider';
const areas = [
  {
    path: '/propostas',
    name: 'Central de propostas',
    description: 'Ideias que podem virar decisões.',
    empty: 'A próxima ideia pode ser sua.',
    Icon: Lightbulb,
  },
  {
    path: '/comunicados',
    name: 'Mural de comunicados',
    description: 'Acompanhe os avisos do partido.',
    empty: 'Os próximos comunicados aparecerão aqui.',
    Icon: Megaphone,
  },
  {
    path: '/divulgacao',
    name: 'Mural de divulgação',
    description: 'Posts e matérias dos filiados.',
    empty: 'Compartilhe sua primeira publicação do ciclo.',
    Icon: Newspaper,
  },
];
export function HomeCommunity() {
  const { activity } = usePortal();
  return (
    <section className="home-community" aria-label="Propostas, comunicados e divulgação">
      {areas.map((area) => {
        const section = activity?.sections[area.path];
        return (
          <article className="panel home-community-card" key={area.path}>
            <header>
              <span className="home-community-icon">
                <area.Icon size={22} />
              </span>
              {!!section?.unseen && (
                <span className="community-new-badge">
                  {section.unseen} {section.unseen === 1 ? 'novidade' : 'novidades'}
                </span>
              )}
            </header>
            <h2>
              <Link href={area.path}>{area.name}</Link>
            </h2>
            <p>{area.description}</p>
            {section?.latest.length ? (
              <ul>
                {section.latest.slice(0, 2).map((item) => (
                  <li key={item.key}>
                    <Link href={item.href}>
                      {item.unseen && <i aria-label="Ainda não visto" />}
                      <span>{item.title}</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="home-community-empty">
                {activity ? area.empty : 'Carregando as novidades…'}
              </div>
            )}
            <Link className="text-button home-community-open" href={area.path}>
              Explorar
              <ArrowUpRight size={14} />
            </Link>
          </article>
        );
      })}
    </section>
  );
}
