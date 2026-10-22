'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileImage,
  Filter,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { Badge, Empty, ErrorNotice, Modal } from './ui';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import { loadCheckins } from '@/lib/checkin-upload';
import { formatDate, type Checkin, type CheckinList } from '@/lib/types';

function dayLabel(day: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

export function CheckinHistory({
  admin = false,
  revision = 0,
}: {
  admin?: boolean;
  revision?: number;
}) {
  const { config } = usePortal();
  const [result, setResult] = useState<CheckinList | null>(null);
  const [filters, setFilters] = useState({ day: '', memberId: '', office: '' });
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState<{ record: Checkin; kind: 'actions' | 'blue' } | null>(null);
  const [proofError, setProofError] = useState('');
  const query = new URLSearchParams({ ...filters, page: String(page) }).toString();
  useEffect(() => {
    const controller = new AbortController();
    loadCheckins<CheckinList>(
      `${admin ? '/api/admin/checkins' : '/api/checkins'}?${query}`,
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) {
          setResult(response);
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
  }, [admin, query, version, revision]);
  function filter(key: 'day' | 'memberId' | 'office', value: string) {
    if (filters[key] === value) return;
    setLoading(true);
    setPage(0);
    setFilters((current) => ({ ...current, [key]: value }));
  }
  return (
    <section
      className="checkin-history"
      aria-label={admin ? 'Consulta de pontos dos filiados' : 'Meu histórico de pontos'}
    >
      <header className="checkin-section-header">
        <div>
          <span className="eyebrow">
            {admin ? 'ACOMPANHAMENTO DO PARTIDO' : 'SUA PARTICIPAÇÃO'}
          </span>
          <h2>{admin ? 'Consulta de pontos' : 'Meu histórico'}</h2>
          <p>
            {admin
              ? 'Confira os envios e abra os dois comprovantes de cada registro.'
              : 'Seus registros ficam aqui, com os dois comprovantes enviados.'}
          </p>
        </div>
        <button
          className="button secondary small-button"
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setVersion((value) => value + 1);
          }}
        >
          <RefreshCw size={15} /> Atualizar
        </button>
      </header>
      <div className={`checkin-filters ${admin ? 'is-admin' : ''}`}>
        <label className="field">
          Dia do ponto
          <DateTimePicker
            name="day"
            label="Filtrar pontos por dia"
            dateOnly
            value={filters.day}
            onValueChange={(value) => filter('day', value)}
          />
        </label>
        {admin && (
          <>
            <label className="field">
              Filiado
              <Select
                aria-label="Filtrar pontos por filiado"
                value={filters.memberId || 'all'}
                onValueChange={(value) => filter('memberId', value === 'all' ? '' : value)}
                options={[
                  { value: 'all', label: 'Todos os filiados' },
                  ...(result?.members || []).map((member) => ({
                    value: member.id,
                    label: member.name || `@${member.discord}`,
                  })),
                ]}
              />
            </label>
            <label className="field">
              Cargo pretendido
              <Select
                aria-label="Filtrar pontos por cargo"
                value={filters.office || 'all'}
                onValueChange={(value) => filter('office', value === 'all' ? '' : value)}
                options={[
                  { value: 'all', label: 'Todos os cargos' },
                  ...(config?.electoralOffices || []).map((office) => ({
                    value: office,
                    label: office,
                  })),
                ]}
              />
            </label>
          </>
        )}
        <div className="checkin-quick-filters">
          <button
            type="button"
            disabled={!result || loading}
            onClick={() => result && filter('day', result.today)}
          >
            <CalendarDays size={14} /> Só hoje
          </button>
          {(filters.day || filters.memberId || filters.office) && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setPage(0);
                setFilters({ day: '', memberId: '', office: '' });
              }}
            >
              <Filter size={13} /> Limpar filtros
            </button>
          )}
        </div>
      </div>
      <ErrorNotice message={error} />
      {loading ? (
        <div className="checkin-loading" role="status">
          <LoaderCircle className="spin" size={22} /> Carregando registros…
        </div>
      ) : error ? null : !result?.records.length ? (
        <section className="panel">
          <Empty>
            <Clock3 size={30} />
            <p>Nenhum ponto registrado{filters.day ? ' neste dia' : ''}.</p>
          </Empty>
        </section>
      ) : (
        <div className="checkin-records">
          {result.records.map((record) => (
            <article className="checkin-record panel" key={record.id}>
              <div className="checkin-record-heading">
                <div>
                  <span className="eyebrow">{dayLabel(record.day)}</span>
                  <h3>{record.name}</h3>
                  <p>
                    @{record.discord}
                    {record.blue ? ` · ${record.blue}` : ''}
                  </p>
                </div>
                <Badge>
                  <CheckCheck size={14} /> Ponto registrado
                </Badge>
              </div>
              <div className="checkin-record-meta">
                <span>
                  <Clock3 size={14} /> {formatDate(record.createdAt, true)} · Brasília
                </span>
                {record.office && <span>{record.office}</span>}
              </div>
              <div className="checkin-proofs">
                {(['actions', 'blue'] as const).map((kind) => (
                  <button
                    type="button"
                    key={kind}
                    onClick={() => {
                      setProofError('');
                      setProof({ record, kind });
                    }}
                    aria-label={`Ver print ${kind === 'actions' ? 'das três ações' : 'do Blue'} de ${record.name}`}
                  >
                    <span>
                      <FileImage size={19} />
                    </span>
                    <span>
                      <strong>
                        {kind === 'actions' ? 'Três ações realizadas' : 'Publicação no Blue'}
                      </strong>
                      <small>Abrir comprovante</small>
                    </span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {!error && (
        <div className="checkin-pagination">
          <span>Página {page + 1} · até 20 registros por página</span>
          <div>
            <button
              type="button"
              className="button secondary small-button"
              disabled={page === 0 || loading}
              onClick={() => {
                setLoading(true);
                setPage((value) => value - 1);
              }}
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <button
              type="button"
              className="button secondary small-button"
              disabled={!result?.hasMore || loading}
              onClick={() => {
                setLoading(true);
                setPage((value) => value + 1);
              }}
            >
              Próxima <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
      {proof && (
        <Modal
          title={proof.kind === 'actions' ? 'Print das três ações' : 'Print da publicação no Blue'}
          onClose={() => setProof(null)}
        >
          <div className="checkin-proof-viewer">
            <p>
              <strong>{proof.record.name}</strong> · {dayLabel(proof.record.day)}
            </p>
            <ErrorNotice message={proofError} />
            <Image
              src={proof.record.proofs[proof.kind]}
              alt={`Comprovante ${proof.kind === 'actions' ? 'das ações' : 'do Blue'} enviado por ${proof.record.name}`}
              width={1600}
              height={2000}
              unoptimized
              onError={() =>
                setProofError(
                  'Não foi possível carregar o comprovante. Tente novamente em instantes.',
                )
              }
            />
            <a
              className="button secondary"
              href={proof.record.proofs[proof.kind]}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir imagem em outra aba
            </a>
          </div>
        </Modal>
      )}
    </section>
  );
}
