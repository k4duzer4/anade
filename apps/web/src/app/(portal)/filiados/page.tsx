'use client';
import { useState } from 'react';
import {
  Search,
  ArrowUpRight,
  MapPin,
  AtSign,
  Users,
  ContactRound,
  Phone,
  ShieldCheck,
  BriefcaseBusiness,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Badge, Modal, Empty } from '@/components/ui';
import { initials, type Member } from '@/lib/types';
export default function Members() {
  const { data, config } = usePortal();
  const [search, setSearch] = useState(''),
    [state, setState] = useState(''),
    [selected, setSelected] = useState<Member | null>(null);
  if (!data) return null;
  const list = data.members.filter(
    (m) =>
      (!state || m.state === state) &&
      `${m.name} ${m.blue} ${m.ideology} ${m.office}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <PageHeading
        title="NOSSA FORÇA TEM NOME."
        description="Diferentes trajetórias, a mesma vontade de construir um projeto comum."
        action={<Badge tone="gold">{data.members.length} filiados no portal</Badge>}
      />
      <div className="members-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, Blue, cargo ou ideologia"
            aria-label="Buscar filiados"
          />
        </label>
        <label className="filter-field">
          <MapPin size={16} />
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos os estados</option>
            {config?.states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span className="toolbar-hint">
          {list.length} resultado{list.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="members-grid">
        {list.length ? (
          list.map((m) => (
            <article className="member-card" key={m.id}>
              <div className="member-banner" aria-hidden="true">
                <span>
                  ALIANÇA NACIONAL
                  <br />
                  DEMOCRÁTICA
                </span>
                <b>
                  ANADE<em>10</em>
                </b>
              </div>
              <div className="member-card-top">
                <div className="avatar large">{initials(m.name)}</div>
                <Badge tone="gray">{m.state}</Badge>
              </div>
              <h2>{m.name}</h2>
              <span className="blue-handle">
                <AtSign size={13} />
                {m.blue?.replace(/^@/, '') || 'Blue não informado'}
              </span>
              <p className="member-office">
                <BriefcaseBusiness size={14} />
                {m.office || 'Sem cargo informado'}
              </p>
              <div className="member-ideology">{m.ideology}</div>
              <div className="member-card-bottom">
                <span>{m.season}</span>
                <button className="text-button" onClick={() => setSelected(m)}>
                  Ver ficha
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <section className="panel full">
            <Empty>
              <Users size={28} />
              <p>Nenhum filiado encontrado com esses filtros.</p>
            </Empty>
          </section>
        )}
      </div>
      <p className="page-note">
        <ShieldCheck size={14} /> As fichas são declaradas pelos jogadores. A lista reúne os
        cadastros do portal; o cargo no Discord é verificado ao acessar.
      </p>
      {selected && (
        <Modal title="FICHA DO FILIADO" onClose={() => setSelected(null)}>
          <div className="member-detail-heading">
            <div className="avatar large">{initials(selected.name)}</div>
            <div>
              <h3>{selected.name}</h3>
              <span>{selected.blue || 'Blue não informado'}</span>
            </div>
          </div>
          <p className="member-bio">
            {selected.bio || 'Este personagem ainda não compartilhou sua biografia.'}
          </p>
          <dl className="member-details">
            {Object.entries({
              Discord: selected.discord,
              'Número do LegApp': selected.legapp || 'Não compartilhado',
              Temporada: selected.season,
              Idade: `${selected.age} anos`,
              'Domicílio eleitoral': selected.state,
              Cidade: selected.city,
              'Ideologia declarada': selected.ideology,
              'Cargo no RPG': selected.office,
              Profissão: selected.profession,
              Faculdades: selected.degrees?.join(', '),
              'OAB no RPG': selected.oab,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || 'Não informado'}</dd>
              </div>
            ))}
          </dl>
          <div className="detail-note">
            <ContactRound size={15} /> Dados do personagem no RPG Legado.{' '}
            {selected.legapp && (
              <>
                <Phone size={13} /> Número fictício.
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
