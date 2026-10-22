'use client';
import Image from 'next/image';
import Link from 'next/link';
import {
  Users,
  CalendarDays,
  Vote,
  ArrowRight,
  ArrowUpRight,
  LockKeyhole,
  CheckCircle2,
  ContactRound,
  Flag,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { Badge, PageHeading, Empty } from '@/components/ui';
import { MeetingCard } from '@/components/meeting-card';
import { formatDate } from '@/lib/types';
import { MemberAvatar } from '@/components/member-avatar';
import { AnimatedNumber } from '@/components/animated-number';
import { Spotlight } from '@/components/spotlight';
import { m } from 'motion/react';
export default function Dashboard() {
  const { data } = usePortal();
  if (!data) return null;
  const me = data.members.find((m) => m.id === data.user.id),
    meetings = data.meetings
      .filter((m) => Date.parse(m.date) > Date.parse(data.serverTime))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    polls = data.polls.filter((p) => !p.closed);
  return (
    <>
      <PageHeading
        eyebrow="DIRETÓRIO DIGITAL · ANADE 10"
        title={`BOM TER VOCÊ AQUI${me ? `, ${me.name.split(' ')[0].toLocaleUpperCase('pt-BR')}` : ''}.`}
        description="Acompanhe o partido. Participe das decisões. Construa com a gente."
        action={
          <span className="today-label">
            <CalendarDays size={15} />
            {new Intl.DateTimeFormat('pt-BR', {
              day: 'numeric',
              month: 'long',
              timeZone: 'America/Sao_Paulo',
            }).format(new Date(data.serverTime))}
          </span>
        }
      />
      <Spotlight className="dashboard-hero">
        <Image
          src="/brand/brasil.png"
          alt="Ilustração da ANADE celebrando a diversidade brasileira"
          fill
          priority
          sizes="(max-width: 700px) 100vw, 80vw"
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="eyebrow">DIFERENTES CORRENTES.</span>
          <h2>
            UM PROJETO
            <br />
            <em>COMUM.</em>
          </h2>
          <p>
            Nossa força está nas pessoas.
            <br />E as próximas decisões começam com você.
          </p>
          <Link href="/partido">
            Conheça o nosso projeto
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="hero-signature">
          ANADE<span>10</span>
        </div>
      </Spotlight>
      <section className="stats-grid" aria-label="Resumo do partido">
        {[
          {
            name: 'Filiados no portal',
            value: data.members.length,
            label: 'Pessoas que constroem a aliança',
            icon: Users,
            href: '/filiados',
          },
          {
            name: 'Próximos encontros',
            value: meetings.length,
            label: 'Espaços para organizar e debater',
            icon: CalendarDays,
            href: '/agenda',
          },
          {
            name: 'Votações abertas',
            value: polls.length,
            label: 'Sua participação faz a diferença',
            icon: Vote,
            href: '/votacoes',
          },
        ].map((stat, index) => (
          <m.div
            key={stat.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.45 }}
            className="stat-motion"
          >
            <Link href={stat.href} className="stat-card" data-metric={index}>
              <stat.icon size={98} className="metric-watermark" aria-hidden="true" />
              <div>
                <span>{stat.name}</span>
                <strong>
                  <AnimatedNumber value={stat.value} />
                </strong>
                <small>{stat.label}</small>
              </div>
              <span className="stat-icon">
                <stat.icon size={20} />
              </span>
              <span className="metric-action">
                {['Conhecer filiados', 'Explorar agenda', 'Participar'][index]}
                <ArrowUpRight size={14} />
              </span>
            </Link>
          </m.div>
        ))}
      </section>
      {!me && (
        <div className="profile-callout">
          <ContactRound size={23} />
          <div>
            <strong>Vamos conhecer seu personagem?</strong>
            <p>Complete sua ficha com Blue, LegApp e sua trajetória no Legado.</p>
          </div>
          <Link className="button primary small-button" href="/ficha/editar">
            Preencher ficha
            <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <div className="dashboard-columns">
        <section className="panel">
          <header className="panel-heading">
            <div>
              <span className="eyebrow">NOSSA AGENDA</span>
              <h2>PRÓXIMO ENCONTRO</h2>
            </div>
            <Link className="text-button" href="/agenda">
              Ver agenda
              <ArrowUpRight size={14} />
            </Link>
          </header>
          {meetings[0] ? (
            <MeetingCard meeting={meetings[0]} compact />
          ) : (
            <Empty>Os próximos encontros aparecerão aqui.</Empty>
          )}
        </section>
        <section className="panel">
          <header className="panel-heading">
            <div>
              <span className="eyebrow">DECISÕES COLETIVAS</span>
              <h2>A PALAVRA É SUA</h2>
            </div>
            <Badge>
              {polls.length} aberta{polls.length === 1 ? '' : 's'}
            </Badge>
          </header>
          {polls.length ? (
            polls.slice(0, 2).map((p) => (
              <article className="dashboard-poll" key={p.id}>
                <div className="poll-label">
                  <span>
                    {p.secret ? <LockKeyhole size={13} /> : <Vote size={13} />}Voto{' '}
                    {p.secret ? 'secreto' : 'nominal'}
                  </span>
                  {p.hasVoted && (
                    <span className="voted-label">
                      <CheckCircle2 size={13} />
                      Você votou
                    </span>
                  )}
                </div>
                <h3>{p.title}</h3>
                <p>
                  Até {formatDate(p.deadline)} · {p.total} votos
                </p>
                <Link href="/votacoes" className="text-button">
                  {p.hasVoted ? 'Acompanhar votação' : 'Participar da votação'}
                  <ArrowRight size={15} />
                </Link>
              </article>
            ))
          ) : (
            <Empty>Nenhuma votação aberta no momento.</Empty>
          )}
        </section>
      </div>
      <section className="panel members-preview">
        <header className="panel-heading">
          <div>
            <span className="eyebrow">UMA ALIANÇA DE PESSOAS</span>
            <h2>QUEM CONSTRÓI A ANADE</h2>
          </div>
          <Link href="/filiados" className="text-button">
            Conhecer filiados
            <ArrowUpRight size={14} />
          </Link>
        </header>
        <div className="member-strip">
          {data.members.slice(0, 4).map((m) => (
            <Link href={`/filiados/${encodeURIComponent(m.id)}`} className="member-mini" key={m.id}>
              <MemberAvatar name={m.name} src={m.avatarUrl} />
              <div>
                <strong>{m.name}</strong>
                <span>
                  {m.state} · {m.office || 'Filiado ANADE'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <div className="values-strip">
        <Flag size={16} />
        <span>DEMOCRACIA</span>
        <i />
        <span>TRABALHO</span>
        <i />
        <span>JUSTIÇA SOCIAL</span>
        <i />
        <span>DESENVOLVIMENTO</span>
      </div>
    </>
  );
}
