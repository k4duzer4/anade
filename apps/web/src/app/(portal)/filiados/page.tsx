'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  ArrowUpRight,
  MapPin,
  AtSign,
  Users,
  ShieldCheck,
  BriefcaseBusiness,
  X,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Badge, Empty } from '@/components/ui';
import { MemberAvatar } from '@/components/member-avatar';
import { Select } from '@/components/select';
import { searchText } from '@/lib/types';
export default function Members() {
  const { data, config } = usePortal();
  const [search, setSearch] = useState(''),
    [state, setState] = useState('');
  const [sort, setSort] = useState('name');
  const [ideology, setIdeology] = useState('');
  if (!data) return null;
  const list = data.members
    .filter(
      (m) =>
        (!state || m.state === state) &&
        (!ideology || m.ideology === ideology) &&
        searchText(`${m.name} ${m.blue} ${m.ideology} ${m.office} ${m.city} ${m.state}`).includes(
          searchText(search),
        ),
    )
    .sort((a, b) =>
      sort === 'recent'
        ? Date.parse(b.joinedAt) - Date.parse(a.joinedAt)
        : a.name.localeCompare(b.name, 'pt-BR'),
    );
  return (
    <div className="refresh-page people-refresh">
      <PageHeading
        eyebrow="QUEM CONSTRÓI · ANADE"
        title="Nossa aliança tem nome."
        description="Encontre filiados, conheça suas trajetórias e faça parte da conversa."
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
          <Select
            value={state || 'all'}
            onValueChange={(value) => setState(value === 'all' ? '' : value)}
            aria-label="Filtrar por estado"
            options={[
              { value: 'all', label: 'Todos os estados' },
              ...(config?.states || []).map((state) => ({ value: state, label: state })),
            ]}
          />
        </label>
        <span className="toolbar-hint">
          {list.length} resultado{list.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="people-filter-row">
        <Select
          aria-label="Filtrar por ideologia"
          value={ideology || 'all'}
          onValueChange={(value) => setIdeology(value === 'all' ? '' : value)}
          options={[
            { value: 'all', label: 'Todas as ideologias' },
            ...(config?.ideologies || []).map((value) => ({ value, label: value })),
          ]}
        />
        <Select
          aria-label="Ordenar filiados"
          value={sort}
          onValueChange={setSort}
          options={[
            { value: 'name', label: 'Nome: A–Z' },
            { value: 'recent', label: 'Mais recentes' },
          ]}
        />
        {(search || state || ideology) && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSearch('');
              setState('');
              setIdeology('');
            }}
          >
            <X size={13} />
            Limpar filtros
          </button>
        )}
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
              <div
                className={`member-banner ${m.bannerUrl ? 'has-custom-banner' : ''}`}
                aria-hidden="true"
              >
                {m.bannerUrl ? (
                  <Image
                    src={m.bannerUrl}
                    alt=""
                    fill
                    sizes="(max-width: 700px) 100vw, 33vw"
                    unoptimized
                  />
                ) : (
                  <>
                    <span>
                      ALIANÇA NACIONAL
                      <br />
                      DEMOCRÁTICA
                    </span>
                    <b>
                      ANADE<em>10</em>
                    </b>
                  </>
                )}
              </div>
              <div className="member-card-top">
                <MemberAvatar className="avatar large" name={m.name} src={m.avatarUrl} />
                <Badge tone="gray">{m.state}</Badge>
              </div>
              {m.id === data.user.id && <span className="people-self">Seu perfil</span>}
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
              <h3>Ninguém por aqui com esses filtros.</h3>
              <p>Experimente outro nome, estado ou ideologia.</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setSearch('');
                  setState('');
                  setIdeology('');
                }}
              >
                Ver todos os filiados
              </button>
            </Empty>
          </section>
        )}
      </div>
      <p className="page-note">
        <ShieldCheck size={14} /> As fichas são declaradas pelos jogadores. A lista reúne os
        cadastros do portal; o cargo no Discord é verificado no login.
      </p>
    </div>
  );
}
