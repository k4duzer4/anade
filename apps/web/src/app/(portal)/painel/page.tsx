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
  Clock3,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { Badge, PageHeading, Empty } from '@/components/ui';
import { MeetingCard } from '@/components/meeting-card';
import { formatDate } from '@/lib/types';
import { MemberAvatar } from '@/components/member-avatar';
export default function Dashboard() {
  const { data } = usePortal();
  if (!data) return null;
  const me = data.members.find((m) => m.id === data.user.id),
    meetings = data.meetings
      .filter((m) => Date.parse(m.date) > Date.parse(data.serverTime))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    polls = data.polls
      .filter((p) => !p.closed)
      .sort(
        (a, b) =>
          Number(a.hasVoted) - Number(b.hasVoted) ||
          Date.parse(a.deadline) - Date.parse(b.deadline),
      );
  const pending = polls.filter((p) => !p.hasVoted);
  const focus = !me
    ? {
        label: 'SUA IDENTIDADE NA ANADE',
        title: 'Sua história começa com você.',
        description: 'Complete a ficha do seu personagem para participar da nossa aliança.',
        href: '/ficha/editar',
        action: 'Criar meu perfil',
      }
    : pending[0]
      ? {
          label: 'SUA PARTICIPAÇÃO FAZ DIFERENÇA',
          title: pending[0].title,
          description: `Uma decisão aguarda seu voto. Participe até ${formatDate(pending[0].deadline)}.`,
          href: `/votacoes#votacao-${pending[0].id}`,
          action: 'Participar da votação',
        }
      : meetings[0]
        ? {
            label: 'NOSSO PRÓXIMO ENCONTRO',
            title: meetings[0].title,
            description: `Reserve na agenda: ${formatDate(meetings[0].date)} · Brasília.`,
            href: `/agenda#encontro-${meetings[0].id}`,
            action: 'Ver encontro',
          }
        : {
            label: 'SEU ESPAÇO NA ANADE',
            title: 'Cada participação constrói a nossa aliança.',
            description: 'Registre suas atividades do dia e acompanhe o que acontece no partido.',
            href: '/ponto',
            action: 'Bater ponto',
          };
  return (
    <div className="refresh-page home-refresh">
      <PageHeading
        eyebrow="DIRETÓRIO DIGITAL · ANADE 10"
        title={`Bom ter você aqui${me ? `, ${me.name.split(' ')[0]}` : ''}.`}
        description="Seu dia no partido começa aqui."
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
      <section className="home-focus">
        <div>
          <span className="eyebrow">{focus.label}</span>
          <h2>{focus.title}</h2>
          <p>{focus.description}</p>
          <Link href={focus.href} className="button primary">
            {focus.action}
            <ArrowRight size={15} />
          </Link>
        </div>
        <div className="home-focus-art">
          <Image
            src="/brand/brasil.png"
            alt="Ilustração da diversidade brasileira na ANADE"
            fill
            priority
            sizes="(max-width:700px) 50vw, 30vw"
          />
          <span>
            ANADE<strong>10</strong>
          </span>
        </div>
      </section>
      <section className="home-shortcuts" aria-label="Acesso rápido">
        {[
          {
            href: '/agenda',
            name: 'Agenda',
            value: meetings.length,
            label: 'próximos encontros',
            Icon: CalendarDays,
          },
          {
            href: '/votacoes',
            name: 'Votações',
            value: pending.length,
            label: 'aguardando seu voto',
            Icon: Vote,
          },
          {
            href: '/ponto',
            name: 'Bater ponto',
            value: 'Diário',
            label: 'participação opcional',
            Icon: Clock3,
          },
          {
            href: '/filiados',
            name: 'Filiados',
            value: data.members.length,
            label: 'pessoas na aliança',
            Icon: Users,
          },
        ].map((item) => (
          <Link href={item.href} key={item.href}>
            <span>
              <item.Icon size={19} />
              {item.name}
              <ArrowUpRight size={14} />
            </span>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </Link>
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
    </div>
  );
}
