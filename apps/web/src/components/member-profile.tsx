'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  AtSign,
  BriefcaseBusiness,
  ContactRound,
  GraduationCap,
  Landmark,
  LockKeyhole,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  Copy,
  CalendarDays,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { Badge, Empty, PageHeading } from './ui';
import { MemberAvatar } from './member-avatar';
import { ProfileImageControl } from './profile-media-editor';

function Biography({ text = '' }: { text?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <p className={`member-profile-bio ${!expanded && text.length > 420 ? 'is-collapsed' : ''}`}>
        {text || 'Este personagem ainda não compartilhou sua biografia.'}
      </p>
      {text.length > 420 && (
        <button
          className="text-button bio-toggle"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Ler menos' : 'Ler trajetória completa'} <ArrowUpRight size={14} />
        </button>
      )}
    </>
  );
}

function CopyContact({ value, label }: { value: string; label: string }) {
  const { notify } = usePortal();
  return (
    <button
      className="profile-copy"
      type="button"
      aria-label={`Copiar ${label}`}
      title={`Copiar ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          notify(`${label} copiado.`);
        } catch {
          notify('Não foi possível copiar. Selecione o texto e tente novamente.');
        }
      }}
    >
      <Copy size={14} />
    </button>
  );
}

export default function MemberProfile({ memberId }: { memberId?: string }) {
  const { data } = usePortal();
  if (!data) return null;
  const id = memberId ?? data.user.id;
  const own = id === data.user.id;
  const member = data.members.find((person) => person.id === id);
  const positions = data.directors.filter((director) => director.memberId === id);
  const renderCover = (src?: string) => (
    <>
      <Image
        src={src || '/brand/filie-se.png'}
        alt={src ? `Banner de ${member?.name}` : ''}
        fill
        sizes="(max-width: 800px) 100vw, 75vw"
        unoptimized={!!src}
      />
      {!src && (
        <>
          <div className="member-profile-cover-copy">
            <span>ALIANÇA NACIONAL DEMOCRÁTICA</span>
            <strong>
              Diferentes histórias.
              <br />
              Um projeto comum.
            </strong>
          </div>
          <span className="member-profile-number" aria-hidden="true">
            10
          </span>
        </>
      )}
    </>
  );

  if (!member) {
    return (
      <>
        <PageHeading
          title={own ? 'MEU PERFIL.' : 'PERFIL NÃO ENCONTRADO.'}
          description={
            own
              ? 'Seu espaço dentro da nossa aliança.'
              : 'Essa ficha não está disponível no diretório.'
          }
        />
        <section className="panel profile-empty">
          <Empty>
            <span className="profile-empty-symbol">
              <ContactRound size={32} />
            </span>
            <h2>{own ? 'Sua história começa com você.' : 'Ainda não há uma ficha por aqui.'}</h2>
            <p>
              {own
                ? 'Cadastre o nome, a biografia e os contatos do seu personagem para montar seu perfil no portal.'
                : 'O filiado pode ainda não ter cadastrado sua ficha, ou o endereço pode estar incorreto.'}
            </p>
            <Link className="button primary" href={own ? '/ficha/editar' : '/filiados'}>
              {own ? (
                <>
                  <Pencil size={16} /> Criar minha ficha
                </>
              ) : (
                <>
                  <ArrowLeft size={16} /> Voltar aos filiados
                </>
              )}
            </Link>
          </Empty>
        </section>
      </>
    );
  }

  return (
    <div className="member-profile refresh-page profile-refresh">
      <PageHeading
        title={own ? 'Meu perfil.' : 'Conheça este filiado.'}
        description={
          own
            ? 'Sua identidade, sua trajetória e seu lugar na ANADE.'
            : 'Conheça quem constrói nossa aliança.'
        }
        action={
          own ? (
            <Link href="/ficha/editar" className="button primary">
              <Pencil size={16} /> Editar meu perfil
            </Link>
          ) : (
            <Link href="/filiados" className="button secondary">
              <ArrowLeft size={16} /> Nossos filiados
            </Link>
          )
        }
      />
      <section className="member-profile-hero" aria-labelledby="member-profile-name">
        <div className={`member-profile-cover ${member.bannerUrl ? 'has-custom-banner' : ''}`}>
          {own ? (
            <ProfileImageControl kind="banner" current={member.bannerUrl}>
              {renderCover}
            </ProfileImageControl>
          ) : (
            renderCover(member.bannerUrl)
          )}
        </div>
        <div className="member-profile-identity">
          {own ? (
            <ProfileImageControl kind="avatar" current={member.avatarUrl}>
              {(src) => (
                <MemberAvatar className="member-profile-avatar" name={member.name} src={src} />
              )}
            </ProfileImageControl>
          ) : (
            <MemberAvatar
              className="member-profile-avatar"
              name={member.name}
              src={member.avatarUrl}
            />
          )}
          <div className="member-profile-name">
            <span className="eyebrow">
              {own ? 'SEU PERSONAGEM NO LEGADO' : 'NOSSA ALIANÇA, NOSSA GENTE'}
            </span>
            <h2 id="member-profile-name">{member.name}</h2>
            <p>
              <MapPin size={14} /> {[member.city, member.state].filter(Boolean).join(' · ')}
              <span aria-hidden="true">/</span>
              {member.season}
            </p>
            <div className="profile-identity-links">
              {member.blue && (
                <a href="#perfil-contatos">
                  <AtSign size={13} />
                  {member.blue.replace(/^@/, '')}
                </a>
              )}
              {member.joinedAt && (
                <span>
                  <CalendarDays size={13} />
                  No portal desde{' '}
                  {new Intl.DateTimeFormat('pt-BR', {
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(member.joinedAt))}
                </span>
              )}
            </div>
          </div>
          <Badge tone="green">
            <ShieldCheck size={13} /> Filiado ANADE
          </Badge>
        </div>
        <dl className="member-profile-highlights">
          <div>
            <dt>
              <UserRound size={15} /> Idade no RPG
            </dt>
            <dd>
              {member.age}
              <small>anos</small>
            </dd>
          </div>
          <div>
            <dt>
              <Sparkles size={15} /> Ideologia declarada
            </dt>
            <dd>{member.ideology}</dd>
          </div>
          <div>
            <dt>
              <BriefcaseBusiness size={15} /> Cargo no RPG
            </dt>
            <dd>{member.office || 'Não informado'}</dd>
          </div>
        </dl>
      </section>
      <nav className="profile-section-nav" aria-label="Seções do perfil">
        <a href="#perfil-sobre">Sobre</a>
        <a href="#perfil-formacao">Formação</a>
        {positions.length > 0 && <a href="#perfil-direcao">Na direção</a>}
        <a href="#perfil-contatos">Contatos</a>
      </nav>
      <div className="member-profile-columns">
        <div className="member-profile-main">
          <section className="panel member-profile-section" id="perfil-sobre">
            <header>
              <span className="section-icon">
                <ContactRound size={20} />
              </span>
              <div>
                <span className="eyebrow">ALÉM DO NOME</span>
                <h2>{own ? 'Minha trajetória' : 'Trajetória'}</h2>
              </div>
            </header>
            <Biography text={member.bio} />
            <dl className="member-profile-facts">
              <div>
                <dt>Profissão</dt>
                <dd>{member.profession || 'Não informada'}</dd>
              </div>
              <div>
                <dt>Domicílio eleitoral</dt>
                <dd>{member.state}</dd>
              </div>
            </dl>
          </section>
          <section className="panel member-profile-section" id="perfil-formacao">
            <header>
              <span className="section-icon">
                <GraduationCap size={21} />
              </span>
              <div>
                <span className="eyebrow">CONHECIMENTO QUE CONSTRÓI</span>
                <h2>Formação e atuação</h2>
              </div>
            </header>
            {member.degrees.length ? (
              <div className="member-profile-degrees">
                {member.degrees.map((degree) => (
                  <span key={degree}>
                    <GraduationCap size={17} />
                    {degree}
                  </span>
                ))}
              </div>
            ) : (
              <p className="member-profile-muted">Formação ainda não informada.</p>
            )}
            {member.oab && (
              <dl className="member-profile-facts">
                <div>
                  <dt>OAB no RPG</dt>
                  <dd>{member.oab}</dd>
                </div>
              </dl>
            )}
          </section>
          {positions.length > 0 && (
            <section className="panel member-profile-section" id="perfil-direcao">
              <header>
                <span className="section-icon">
                  <Landmark size={20} />
                </span>
                <div>
                  <span className="eyebrow">CONSTRUÇÃO COLETIVA</span>
                  <h2>Atuação na direção</h2>
                </div>
              </header>
              <div className="member-profile-positions">
                {positions.map((position) => (
                  <div key={position.id}>
                    <strong>{position.title}</strong>
                    {position.responsibility && <p>{position.responsibility}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="panel member-profile-section member-profile-contact" id="perfil-contatos">
          <header>
            <span className="section-icon">
              <AtSign size={20} />
            </span>
            <div>
              <span className="eyebrow">VAMOS CONVERSAR</span>
              <h2>Contatos</h2>
            </div>
          </header>
          <dl>
            <div>
              <dt>
                <AtSign size={16} /> Blue
              </dt>
              <dd>
                {member.blue || 'Não informado'}
                {member.blue && <CopyContact value={member.blue} label="Blue" />}
              </dd>
            </div>
            <div>
              <dt>
                <Phone size={16} /> LegApp
              </dt>
              <dd>
                {member.legapp || (own ? 'Não informado' : 'Não compartilhado')}
                {member.legapp && <CopyContact value={member.legapp} label="LegApp" />}
              </dd>
              {own && member.legapp && !member.shareLegapp && (
                <small>
                  <LockKeyhole size={12} /> Visível somente para você
                </small>
              )}
            </div>
            <div>
              <dt>
                <ContactRound size={16} /> Discord vinculado
              </dt>
              <dd>
                {member.discord || 'Vinculação pendente'}
                {member.discord && <CopyContact value={member.discord} label="Discord" />}
              </dd>
            </div>
          </dl>
          <div className="member-profile-footnote">
            <ShieldCheck size={17} />
            <p>
              Dados do personagem no RPG Legado, declarados pelo jogador. O LegApp é um número
              fictício do jogo.
            </p>
          </div>
          {own && (
            <Link href="/ficha/editar" className="text-button">
              Atualizar meus contatos <ArrowUpRight size={15} />
            </Link>
          )}
        </aside>
      </div>
      <Link href="/filiados" className="text-button member-profile-back">
        <ArrowLeft size={15} /> Explorar nossos filiados
      </Link>
    </div>
  );
}
