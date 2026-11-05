'use client';
import { Landmark, Plus, Pencil, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePortal } from './portal-provider';
import { PageHeading, Empty } from './ui';
import { officialDirection, directionSections } from '@/lib/official-direction';
import { type Director } from '@/lib/types';
import { MemberAvatar } from './member-avatar';
const stateNames: Record<string, string> = {
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  RS: 'Rio Grande do Sul',
  BA: 'Bahia',
  RJ: 'Rio de Janeiro',
  CE: 'Ceará',
  MT: 'Mato Grosso',
};
export default function DirectionContent() {
  const { data } = usePortal();
  if (!data) return null;
  const directors = officialDirection(data.members, data.directors);
  const sections = directionSections(directors);
  const members = data.members;
  const isAdmin = data.user.admin;
  function renderDirector(director: Director, featured = false) {
    const member = members.find((m) => m.id === director.memberId);
    const name = member?.name || 'Ficha indisponível';
    const state = ['Presidente estadual', 'Coordenador estadual'].includes(
      director.title.split(' · ')[0],
    )
      ? member?.functionState || member?.state
      : member?.state;
    return (
      <article className={`director-card ${featured ? 'is-featured' : ''}`} key={director.id}>
        <Link
          className="director-profile-link"
          href={`/filiados/${encodeURIComponent(director.memberId)}`}
          aria-label={`Ver perfil de ${name}`}
        >
          <MemberAvatar className="director-avatar" name={name} src={member?.avatarUrl} />
          <span className="director-title">{director.title}</span>
          <h3>{name}</h3>
          <span className="director-state">
            {stateNames[state || ''] || state || 'Domicílio não informado'}
          </span>
        </Link>
        {isAdmin && (
          <div className="director-management">
            <Link
              href={`/administracao/cargos?membro=${director.memberId}`}
              aria-label={`Editar funções de ${name}`}
            >
              <Pencil size={13} />
              Gerenciar funções
            </Link>
          </div>
        )}
      </article>
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZAÇÃO PARTIDÁRIA"
        title="DIREÇÃO DA ANADE"
        description="Quem organiza nossa aliança e transforma decisões em ação coletiva."
        action={
          data.user.admin && (
            <Link href="/administracao/cargos" className="button primary">
              <Plus size={17} /> Cargos e funções
            </Link>
          )
        }
      />
      <section className="direction-banner">
        <div className="direction-banner-emblem" aria-hidden="true">
          <Landmark size={35} strokeWidth={1.2} />
        </div>
        <div className="direction-banner-copy">
          <span>ALIANÇA NACIONAL DEMOCRÁTICA</span>
          <h2>
            Construir juntos.
            <br />
            <em>Conduzir com propósito.</em>
          </h2>
          <p>Conheça as pessoas e as responsabilidades que compõem a direção do partido.</p>
        </div>
        <div className="direction-total">
          <Users size={18} />
          <strong>
            {new Set(directors.map((d) => d.memberId)).size.toString().padStart(2, '0')}
          </strong>
          <span>pessoas na direção</span>
        </div>
        <span className="direction-watermark" aria-hidden="true">
          10
        </span>
      </section>
      <div className="direction-section-title">
        <span className="eyebrow">COMPOSIÇÃO DO DIRETÓRIO</span>
        <span>
          {directors.length} {directors.length === 1 ? 'função atribuída' : 'funções atribuídas'}
        </span>
      </div>
      {directors.length ? (
        <section className="direction-directory" aria-label="Composição do diretório">
          {sections.map((section) => (
            <section
              key={section.id}
              className={`direction-tier direction-tier-${section.id}`}
              aria-labelledby={`direction-${section.id}`}
            >
              <header className="direction-tier-heading">
                <h2 id={`direction-${section.id}`}>{section.title}</h2>
              </header>
              <div
                className={`direction-grid ${section.featured ? 'direction-featured' : 'direction-members'}`}
              >
                {section.directors.map((director) => renderDirector(director, section.featured))}
              </div>
            </section>
          ))}
        </section>
      ) : (
        <section className="panel full">
          <Empty>
            <Landmark size={32} />
            <h3>A direção será apresentada aqui.</h3>
            <p>
              {data.user.admin
                ? 'Defina as funções partidárias dos filiados na administração.'
                : 'A administração ainda não publicou a composição do diretório.'}
            </p>
            {data.user.admin && (
              <Link href="/administracao/cargos" className="button primary">
                <Plus size={16} /> Definir funções partidárias
              </Link>
            )}
          </Empty>
        </section>
      )}
      <p className="page-note">
        <ShieldCheck size={15} /> Composição publicada pela administração · Visível apenas aos
        filiados.
      </p>
    </>
  );
}
