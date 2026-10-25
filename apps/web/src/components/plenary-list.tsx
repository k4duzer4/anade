'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Landmark,
  ListOrdered,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { PageHeading, ErrorNotice } from './ui';
import { usePortal } from './portal-provider';
import { useOrganization, OrganizationLoading } from './organization-ui';
import { formatDate, searchText } from '@/lib/types';
import type { PlenaryMeeting, PlenaryProvider } from '@/lib/plenary';

const filters = [
  ['all', 'Todas as sessões'],
  ['open', 'Em andamento'],
  ['draft', 'Agendadas'],
  ['closed', 'Encerradas'],
] as const;
const statusLabel = { open: 'Sessão aberta', draft: 'Em preparação', closed: 'Sessão encerrada' };
export function PlenaryList() {
  const { data } = usePortal();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [version, setVersion] = useState(0);
  const { value, error } = useOrganization<{
    provider: PlenaryProvider;
    records: PlenaryMeeting[];
  }>('/api/plenaries', `${data?.serverTime}:${version}`);
  if (!data) return null;
  const records = value?.records || [];
  const count = (status: string) => records.filter((m) => m.sessionStatus === status).length;
  const filtered = records
    .filter(
      (m) =>
        (filter === 'all' || m.sessionStatus === filter) &&
        searchText(m.title).includes(searchText(query)),
    )
    .sort((a, b) => {
      const order = { open: 0, draft: 1, closed: 2 };
      return (
        order[a.sessionStatus] - order[b.sessionStatus] ||
        (a.sessionStatus === 'closed'
          ? Date.parse(b.date) - Date.parse(a.date)
          : Date.parse(a.date) - Date.parse(b.date))
      );
    });
  return (
    <div className="refresh-page plenary-page plenary-directory">
      <PageHeading
        eyebrow="ANADE · ORGANIZAÇÃO PARTIDÁRIA"
        title="Plenário virtual"
        description="Gestão de reuniões, acompanhamento de pautas e deliberações do partido."
        action={
          data.user.admin && (
            <Link className="button primary" href="/agenda?nova=1&modalidade=plenario">
              <Plus size={17} />
              Agendar plenário
            </Link>
          )
        }
      />
      <section className="plenary-institutional">
        <div className="plenary-institutional-copy">
          <span className="plenary-seal">
            <Landmark size={28} />
          </span>
          <div>
            <span className="eyebrow">DIRETÓRIO DIGITAL · ANADE 10</span>
            <h2>Sessões deliberativas</h2>
            <p>
              Um ambiente para conduzir os trabalhos, registrar presenças e formalizar decisões.
            </p>
          </div>
        </div>
        <ol className="plenary-process" aria-label="Etapas da sessão">
          <li>
            <span>01</span>
            <div>
              <b>Preparação</b>
              <small>Pautas e composição</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <b>Participação</b>
              <small>Áudio e presença</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <b>Deliberação</b>
              <small>Quórum e votação</small>
            </div>
          </li>
        </ol>
      </section>
      <section className="plenary-metrics" aria-label="Indicadores do plenário">
        {[
          {
            label: 'Filiados no portal',
            value: data.members.length,
            detail: 'Mesma base da visão geral',
            Icon: Users,
          },
          {
            label: 'Sessões abertas',
            value: value ? count('open') : '—',
            detail: 'Trabalhos em andamento',
            Icon: Radio,
          },
          {
            label: 'Em preparação',
            value: value ? count('draft') : '—',
            detail: 'Aguardando abertura',
            Icon: CalendarDays,
          },
          {
            label: 'Sessões encerradas',
            value: value ? count('closed') : '—',
            detail: 'Histórico de deliberações',
            Icon: CheckCircle2,
          },
        ].map((item) => (
          <article key={item.label}>
            <div className="plenary-metric-top">
              <span>{item.label}</span>
              <item.Icon size={18} />
            </div>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>
      <section className="plenary-sessions" aria-label="Consultar sessões">
        <header className="plenary-section-heading">
          <div>
            <span className="eyebrow">REUNIÕES DO PARTIDO</span>
            <h2>Sessões do plenário</h2>
          </div>
          <button className="button outline small-button" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw size={14} />
            Atualizar sessões
          </button>
        </header>
        <div className="plenary-directory-toolbar">
          <div className="plenary-filters" role="group" aria-label="Filtrar sessões">
            {filters.map(([key, label]) => (
              <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}
                <span>{key === 'all' ? records.length : count(key)}</span>
              </button>
            ))}
          </div>
          <label className="plenary-search">
            <Search size={16} />
            <input
              type="search"
              aria-label="Buscar sessão"
              placeholder="Buscar pelo título da reunião"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Limpar busca de sessões" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </label>
        </div>
        <ErrorNotice message={error} />
        {!value && !error && <OrganizationLoading />}
        {value && (
          <>
            <div className="plenary-results-summary" aria-live="polite">
              <span>
                {filtered.length}{' '}
                {filtered.length === 1 ? 'sessão encontrada' : 'sessões encontradas'}
              </span>
              <span>
                <Clock3 size={13} />
                Horários de Brasília
              </span>
            </div>
            <div className="plenary-room-grid">
              {filtered.map((meeting) => {
                const date = new Date(meeting.date),
                  status = meeting.sessionStatus;
                const day = new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                }).format(date);
                const month = new Intl.DateTimeFormat('pt-BR', {
                  month: 'short',
                  timeZone: 'America/Sao_Paulo',
                })
                  .format(date)
                  .replace('.', '');
                return (
                  <article className={`panel plenary-session-card is-${status}`} key={meeting.id}>
                    <header>
                      <span className={`plenary-session-status is-${status}`}>
                        <i />
                        {statusLabel[status]}
                      </span>
                      <span className="plenary-session-scope">
                        {meeting.groupId ? 'Grupo' : 'Nacional'}
                      </span>
                    </header>
                    <div className="plenary-session-title">
                      <time dateTime={meeting.date} className="plenary-session-date">
                        <b>{day}</b>
                        <span>{month}</span>
                      </time>
                      <div>
                        <h3>{meeting.title}</h3>
                        <p>
                          <Clock3 size={13} />
                          {formatDate(meeting.date)}
                        </p>
                      </div>
                    </div>
                    <div className="plenary-session-details">
                      <span>
                        <ListOrdered size={15} />
                        {meeting.agenda.length} {meeting.agenda.length === 1 ? 'pauta' : 'pautas'}
                      </span>
                      {meeting.electorate !== undefined && (
                        <span>
                          <Users size={15} />
                          {meeting.electorate} eleitores
                        </span>
                      )}
                    </div>
                    <footer>
                      <span>
                        {status === 'open'
                          ? 'Acompanhe os trabalhos'
                          : status === 'closed'
                            ? 'Consulte os registros'
                            : 'Consulte a ordem do dia'}
                      </span>
                      <a className="button secondary" href={`/plenario/${meeting.id}`}>
                        {status === 'open'
                          ? 'Acessar sessão'
                          : status === 'closed'
                            ? 'Ver registros'
                            : 'Abrir plenário'}
                        <ArrowUpRight size={16} />
                      </a>
                    </footer>
                  </article>
                );
              })}
            </div>
            {!filtered.length && (
              <div className="plenary-empty-state">
                <span className="plenary-empty-icon">
                  <Landmark size={30} />
                </span>
                <h3>
                  {records.length
                    ? 'Nenhuma sessão corresponde à busca'
                    : 'Nenhuma sessão agendada'}
                </h3>
                <p>
                  {records.length
                    ? 'Ajuste o título ou a situação para consultar outras reuniões.'
                    : 'Os encontros nacionais e dos grupos serão organizados neste espaço.'}
                </p>
                {records.length ? (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setFilter('all');
                      setQuery('');
                    }}
                  >
                    Limpar filtros
                    <ArrowRight size={15} />
                  </button>
                ) : data.user.admin ? (
                  <Link className="button primary" href="/agenda?nova=1&modalidade=plenario">
                    Agendar primeiro plenário
                    <Plus size={15} />
                  </Link>
                ) : (
                  <span className="plenary-empty-caption">
                    As novas sessões aparecerão aqui quando forem agendadas.
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </section>
      <footer className="plenary-directory-footer">
        <Landmark size={17} />
        <span>
          Aliança Nacional Democrática <b>·</b> Ambiente interno de reuniões
        </span>
        <Link href="/agenda">
          Consultar agenda
          <ChevronRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
