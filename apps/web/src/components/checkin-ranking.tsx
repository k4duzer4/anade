'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  Trophy,
  Users,
} from 'lucide-react';
import { ErrorNotice } from './ui';
import { MemberAvatar } from './member-avatar';
import { loadCheckins } from '@/lib/checkin-upload';
import { usePortal } from './portal-provider';
import type { CheckinRanking as Ranking } from '@/lib/types';

export function CheckinRanking() {
  const { data } = usePortal();
  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Ranking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const admin = data?.user.admin === true;
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    loadCheckins<Ranking>(
      `/api/admin/checkins/ranking?period=${period}&page=${page}`,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) {
          setResult(value);
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
  }, [admin, period, page, version]);
  if (!admin) return null;
  const maximum = result?.records[0]?.points || 1;
  return (
    <section className="ranking-board" aria-label="Ranking de participação dos filiados">
      <div className="ranking-controls">
        <div className="refresh-filters" role="group" aria-label="Período do ranking">
          {[
            ['7', '7 dias'],
            ['30', '30 dias'],
            ['all', 'Todo o período'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => {
                if (period !== value) {
                  setLoading(true);
                  setPage(0);
                  setPeriod(value as typeof period);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="button secondary small-button"
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setVersion((v) => v + 1);
          }}
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>
      {result && !error && (
        <div className="ranking-metrics">
          <div>
            <Trophy size={20} />
            <strong>{result.summary.points}</strong>
            <span>pontos no período</span>
          </div>
          <div>
            <Users size={20} />
            <strong>{result.summary.participants}</strong>
            <span>filiados participantes</span>
          </div>
          <div>
            <CalendarDays size={20} />
            <strong>1 ponto</strong>
            <span>por dia de participação</span>
          </div>
        </div>
      )}
      <p className="ranking-explainer">
        Mais dias registrados, mais pontos. Empates compartilham a mesma colocação. Participar
        continua sendo opcional.
      </p>
      <ErrorNotice message={error} />
      {loading ? (
        <div className="checkin-loading" role="status">
          <LoaderCircle className="spin" size={20} /> Carregando ranking…
        </div>
      ) : (
        !error &&
        (result?.records.length ? (
          <div className="ranking-list">
            {result.records.map((row) => (
              <article
                className={`ranking-row ${row.position === 1 ? 'is-leader' : ''}`}
                key={row.memberId}
              >
                <span className="ranking-position" aria-label={`${row.position}º lugar`}>
                  {row.position === 1 ? <Trophy size={17} /> : <span>#{row.position}</span>}
                </span>
                <Link
                  className="ranking-person"
                  href={`/filiados/${encodeURIComponent(row.memberId)}`}
                >
                  <MemberAvatar name={row.name} src={row.avatarUrl} />
                  <span>
                    <strong>{row.name}</strong>
                    <small>
                      Último ponto em{' '}
                      {new Intl.DateTimeFormat('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${row.lastDay}T12:00:00Z`))}
                    </small>
                  </span>
                </Link>
                <div className="ranking-score">
                  <strong>
                    {row.points}
                    <small> ponto{row.points === 1 ? '' : 's'}</small>
                  </strong>
                  <span aria-hidden="true">
                    <i style={{ width: `${(row.points / maximum) * 100}%` }} />
                  </span>
                </div>
                <Link
                  className="ranking-records"
                  href={`/administracao/pontos?memberId=${encodeURIComponent(row.memberId)}`}
                  aria-label={`Consultar pontos de ${row.name}`}
                >
                  <FileSearch size={16} />
                  <span>Registros</span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="ranking-empty">
            <Trophy size={32} />
            <h3>A participação começa no primeiro ponto.</h3>
            <p>Não há registros neste período. Experimente ampliar a consulta.</p>
          </div>
        ))
      )}
      {!!result?.records.length && !error && (
        <div className="checkin-pagination">
          <span>Página {page + 1} · Horário de Brasília</span>
          <div>
            <button
              className="button secondary small-button"
              disabled={!page || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p - 1);
              }}
            >
              <ArrowLeft size={14} /> Anterior
            </button>
            <button
              className="button secondary small-button"
              disabled={!result.hasMore || loading}
              onClick={() => {
                setLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Próxima <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
