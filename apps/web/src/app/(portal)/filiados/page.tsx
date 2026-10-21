'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowUpRight,
  MapPin,
  AtSign,
  Users,
  ShieldCheck,
  BriefcaseBusiness,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Badge, Empty } from '@/components/ui';
import { initials } from '@/lib/types';
export default function Members() {
  const { data, config } = usePortal();
  const [search, setSearch] = useState(''),
    [state, setState] = useState('');
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
            <Link
              href={`/filiados/${encodeURIComponent(m.id)}`}
              className="member-card"
              key={m.id}
              aria-label={`Ver perfil de ${m.name}`}
            >
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
                <span className="text-button">
                  Ver perfil
                  <ArrowUpRight size={14} />
                </span>
              </div>
            </Link>
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
        cadastros do portal; o cargo no Discord é verificado no login.
      </p>
    </>
  );
}
