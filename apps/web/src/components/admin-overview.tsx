'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  FileSearch,
  Landmark,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
  Vote,
  Lightbulb,
  Megaphone,
  Rocket,
  Network,
  Wallet,
  Scale,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { MemberAvatar } from './member-avatar';
import { ErrorNotice } from './ui';
import { loadCheckins } from '@/lib/checkin-upload';
import { formatDate, type CheckinRanking } from '@/lib/types';
import { officialDirection } from '@/lib/official-direction';

export function AdminOverview({
  adminsCount,
  refreshVersion,
  onManageAccess,
}: {
  adminsCount: number | null;
  refreshVersion: number;
  onManageAccess: () => void;
}) {
  const { data } = usePortal();
  const [ranking, setRanking] = useState<CheckinRanking | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const admin = data?.user.admin === true;
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    loadCheckins<CheckinRanking>('/api/admin/checkins/ranking?period=7&page=0', controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setRanking(result);
          setError('');
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [admin, refreshVersion]);
  if (!data || !admin) return null;
  const meetings = data.meetings
    .filter((m) => Date.parse(m.date) > Date.parse(data.serverTime))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const polls = data.polls
    .filter((p) => !p.closed && Date.parse(p.deadline) > Date.parse(data.serverTime))
    .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  const latest = [...data.members]
    .sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt))
    .slice(0, 4);
  const states = new Map<string, number>();
  data.members.forEach((member) => {
    if (member.state) states.set(member.state, (states.get(member.state) || 0) + 1);
  });
  const stateList = [...states.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const tools = [
    {
      title: 'Cargos e funções',
      description: 'Defina cargos eletivos, funções partidárias e permissões.',
      href: '/administracao/cargos',
      Icon: ShieldCheck,
      detail: 'Atribuições oficiais',
    },
    {
      title: 'Grupos e diretórios',
      description: 'Participantes, lideranças e trabalho por equipe.',
      href: '/grupos',
      Icon: Network,
      detail: 'Controle de participantes',
    },
    {
      title: 'Bancadas',
      description: 'Prioridades legislativas e orientações de voto.',
      href: '/bancadas',
      Icon: Landmark,
      detail: 'Câmara e Senado',
    },
    {
      title: 'Financeiro',
      description: 'Caixas, reservas e comprovantes privados.',
      href: '/financeiro',
      Icon: Wallet,
      detail: 'Acesso por caixa',
    },
    {
      title: 'Jurídico',
      description: 'Vigência, serviços, processos e prazos.',
      href: '/juridico',
      Icon: Scale,
      detail: 'Acesso por caso e arquivo',
    },
    {
      title: 'Calendário do Legado',
      description: 'Configure a temporada e os eventos do jogo.',
      href: '/calendario',
      Icon: CalendarDays,
      detail: 'Horários de Brasília',
    },
    {
      title: 'Central de propostas',
      description: 'Ideias, apoios e encaminhamentos para votação.',
      href: '/propostas',
      Icon: Lightbulb,
      detail: 'Construção coletiva',
    },
    {
      title: 'Mural de comunicados',
      description: 'Publique avisos e acompanhe as leituras.',
      href: '/comunicados',
      Icon: Megaphone,
      detail: 'Publicação pela direção',
    },
    {
      title: 'Central de campanha',
      description: 'Pré-candidaturas e controle de abertura.',
      href: '/campanha',
      Icon: Rocket,
      detail: 'Abrir ou fechar inscrições',
    },
    {
      title: 'Agenda e reuniões',
      description: 'Encontros, chamadas no Meet e atas.',
      href: '/agenda',
      Icon: CalendarDays,
      detail: `${meetings.length} próximas`,
    },
    {
      title: 'Votações internas',
      description: 'Temas, alternativas e resultados.',
      href: '/votacoes',
      Icon: Vote,
      detail: `${polls.length} abertas`,
    },
    {
      title: 'Direção do partido',
      description: 'Dirigentes, cargos e responsabilidades.',
      href: '/direcao',
      Icon: Landmark,
      detail: `${officialDirection(data.members, data.directors).length} funções atribuídas`,
    },
    {
      title: 'Consultar pontos',
      description: 'Registros e comprovantes dos filiados.',
      href: '/administracao/pontos',
      Icon: FileSearch,
      detail: 'Consulta privada',
    },
    {
      title: 'Ranking de participação',
      description: 'Engajamento por dias de atividade.',
      href: '/administracao/pontos/ranking',
      Icon: Trophy,
      detail: '7 dias · 30 dias · total',
    },
    {
      title: 'Filiados e perfis',
      description: 'Pessoas e trajetórias da nossa aliança.',
      href: '/filiados',
      Icon: Users,
      detail: `${data.members.length} fichas`,
    },
  ];
  return (
    <>
      <section className="admin-metrics" aria-label="Resumo da administração">
        {[
          {
            title: 'Filiados no portal',
            value: data.members.length,
            caption: `${states.size} estados representados`,
            href: '/filiados',
            Icon: Users,
          },
          {
            title: 'Próximos encontros',
            value: meetings.length,
            caption: 'reuniões na agenda',
            href: '/agenda',
            Icon: CalendarDays,
          },
          {
            title: 'Decisões em aberto',
            value: polls.length,
            caption: 'votações em andamento',
            href: '/votacoes',
            Icon: Vote,
          },
          {
            title: 'Pontos em 7 dias',
            value: error ? '—' : (ranking?.summary.points ?? '…'),
            caption: error
              ? 'consulta indisponível'
              : `${ranking?.summary.participants ?? '…'} participantes`,
            href: '/administracao/pontos/ranking',
            Icon: Trophy,
          },
        ].map(({ title, value, caption, href, Icon }) => (
          <Link href={href} key={title}>
            <span>
              <Icon size={20} />
              {title}
              <ArrowUpRight size={14} />
            </span>
            <strong>{value}</strong>
            <small>{caption}</small>
          </Link>
        ))}
      </section>
      <div className="admin-workspace">
        <section className="panel admin-activity-panel">
          <header className="admin-block-heading">
            <span className="section-icon">
              <CalendarDays size={21} />
            </span>
            <div>
              <span className="eyebrow">ACOMPANHAR AGORA</span>
              <h2>Agenda e decisões</h2>
            </div>
          </header>
          <div className="admin-activity-group">
            <div className="admin-group-title">
              <h3>Próximos encontros</h3>
              <Link href="/agenda">
                Ver agenda <ArrowUpRight size={13} />
              </Link>
            </div>
            {meetings.length ? (
              meetings.slice(0, 2).map((m) => (
                <Link className="admin-activity-row" href={`/agenda#encontro-${m.id}`} key={m.id}>
                  <CalendarDays size={17} />
                  <span>
                    <strong>{m.title}</strong>
                    <small>{formatDate(m.date)} · Brasília</small>
                  </span>
                  <ArrowRight size={15} />
                </Link>
              ))
            ) : (
              <p className="admin-inline-empty">
                Sem encontros agendados. Organize a próxima reunião pela agenda.
              </p>
            )}
          </div>
          <div className="admin-activity-group">
            <div className="admin-group-title">
              <h3>Votações em andamento</h3>
              <Link href="/votacoes">
                Ver votações <ArrowUpRight size={13} />
              </Link>
            </div>
            {polls.length ? (
              polls.slice(0, 2).map((p) => (
                <Link className="admin-activity-row" href={`/votacoes#votacao-${p.id}`} key={p.id}>
                  <Vote size={17} />
                  <span>
                    <strong>{p.title}</strong>
                    <small>
                      Até {formatDate(p.deadline)} · {p.total} votos
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </Link>
              ))
            ) : (
              <p className="admin-inline-empty">
                Nenhuma decisão aberta. As próximas votações aparecerão aqui.
              </p>
            )}
          </div>
        </section>
        <section className="panel admin-engagement-panel">
          <header className="admin-block-heading">
            <span className="section-icon">
              <Trophy size={21} />
            </span>
            <div>
              <span className="eyebrow">ÚLTIMOS 7 DIAS</span>
              <h2>Participação dos filiados</h2>
            </div>
          </header>
          <ErrorNotice message={error} />
          {loading && !ranking ? (
            <div role="status" className="admin-loading">
              <LoaderCircle size={20} className="spin" />
              Carregando participação…
            </div>
          ) : (
            !error &&
            (ranking?.records.length ? (
              <div className="admin-ranking-preview">
                {ranking.records.slice(0, 4).map((row) => (
                  <Link
                    href={`/administracao/pontos?memberId=${encodeURIComponent(row.memberId)}`}
                    key={row.memberId}
                  >
                    <span className="admin-rank-position">#{row.position}</span>
                    <MemberAvatar name={row.name} src={row.avatarUrl} />
                    <strong>{row.name}</strong>
                    <span className="admin-rank-score">
                      {row.points}
                      <small> ponto{row.points === 1 ? '' : 's'}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="admin-inline-empty">
                Ainda não há pontos neste período. A participação é opcional para todos os filiados.
              </p>
            ))
          )}
          <p className="admin-ranking-caption">
            Um ponto por dia. Empates compartilham a colocação.
          </p>
          <Link href="/administracao/pontos/ranking" className="text-button admin-panel-bottom">
            Abrir ranking completo <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <header className="admin-tools-heading">
        <div>
          <span className="eyebrow">ORGANIZAR E CONSTRUIR</span>
          <h2>Gerenciar o portal</h2>
        </div>
        <button className="button secondary small-button" type="button" onClick={onManageAccess}>
          <ShieldCheck size={15} />
          Gerenciar acessos
        </button>
      </header>
      <section className="admin-tools-grid" aria-label="Ferramentas de administração">
        {tools.map(({ title, description, href, Icon, detail }) => (
          <Link href={href} key={href}>
            <div>
              <span className="section-icon">
                <Icon size={22} />
              </span>
              <ArrowUpRight size={17} />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <small>{detail}</small>
          </Link>
        ))}
      </section>
      <div className="admin-workspace admin-organization">
        <section className="panel">
          <header className="admin-block-heading">
            <span className="section-icon">
              <Users size={21} />
            </span>
            <div>
              <span className="eyebrow">NOSSA ALIANÇA</span>
              <h2>Últimas fichas</h2>
            </div>
          </header>
          {latest.length ? (
            <div className="admin-latest-members">
              {latest.map((member) => (
                <Link key={member.id} href={`/filiados/${encodeURIComponent(member.id)}`}>
                  <MemberAvatar name={member.name} src={member.avatarUrl} />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{[member.city, member.state].filter(Boolean).join(' · ')}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="admin-inline-empty">As fichas cadastradas aparecerão aqui.</p>
          )}
          <Link href="/filiados" className="text-button admin-panel-bottom">
            Ver todos os filiados <ArrowRight size={15} />
          </Link>
        </section>
        <section className="panel">
          <header className="admin-block-heading">
            <span className="section-icon">
              <MapPin size={21} />
            </span>
            <div>
              <span className="eyebrow">PRESENÇA DA ANADE</span>
              <h2>Filiados por estado</h2>
            </div>
          </header>
          <div className="admin-state-list">
            {stateList.slice(0, 5).map(([state, count]) => (
              <div key={state}>
                <span>
                  <strong>{state}</strong>
                  <small>
                    {count} filiado{count === 1 ? '' : 's'}
                  </small>
                </span>
                <div aria-hidden="true">
                  <i
                    style={{
                      width: `${data.members.length ? (count / data.members.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          {!stateList.length && (
            <p className="admin-inline-empty">
              A distribuição aparece conforme as fichas são cadastradas.
            </p>
          )}
          <button type="button" className="admin-team-link" onClick={onManageAccess}>
            <ShieldCheck size={17} />
            <span>
              <strong>{adminsCount ?? '…'} administradores locais</strong>
              <small>Gerenciar equipe e permissões</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </>
  );
}
