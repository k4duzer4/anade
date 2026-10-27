'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileImage,
  MessageSquare,
  Filter,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { ErrorNotice, Modal } from './ui';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import { loadCheckins } from '@/lib/checkin-upload';
import { type Checkin, type CheckinList } from '@/lib/types';
import { DeleteAction } from './delete-action';

function dayLabel(day: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

export function CheckinHistory({
  admin = false,
  revision = 0,
  initialMemberId = '',
}: {
  admin?: boolean;
  revision?: number;
  initialMemberId?: string;
}) {
  const { config, data } = usePortal();
  const [result, setResult] = useState<CheckinList | null>(null);
  const [filters, setFilters] = useState({
    day: '',
    memberId: admin ? initialMemberId : '',
    office: '',
  });
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [proof, setProof] = useState<{ record: Checkin; kind: 'actions' | 'blue' } | null>(null);
  const [proofError, setProofError] = useState('');
  const [showFilters, setShowFilters] = useState(admin);
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
              ? 'Todos os registros, com os dois prints para conferir.'
              : 'Um registro por dia. Seus comprovantes, sempre à mão.'}
          </p>
          <p>O dia do ponto começa às 8h e termina às 7h59 do dia seguinte, em Brasília.</p>
        </div>
        <div className="checkin-history-actions">
          {!admin && (
            <button
              type="button"
              className={`checkin-filter-toggle ${showFilters ? 'active' : ''}`}
              aria-expanded={showFilters}
              aria-label="Filtrar histórico"
              onClick={() => setShowFilters((value) => !value)}
            >
              <Filter size={15} /> Filtrar
              {(filters.day || filters.memberId || filters.office) && (
                <span className="checkin-live-dot" />
              )}
            </button>
          )}
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
        </div>
      </header>
      {showFilters && (
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
      )}
      <ErrorNotice message={error} />
      {loading ? (
        <div className="checkin-loading" role="status">
          <LoaderCircle className="spin" size={22} /> Carregando registros…
        </div>
      ) : error ? null : !result?.records.length ? (
        <section className="checkin-empty">
          <span>
            <FileImage size={24} />
            <CheckCheck size={16} />
          </span>
          <div>
            <h3>
              {filters.day || filters.memberId || filters.office
                ? 'Nenhum registro por aqui.'
                : 'Seu histórico começa no primeiro ponto.'}
            </h3>
            <p>
              {filters.day || filters.memberId || filters.office
                ? 'Escolha outro filtro para consultar os registros.'
                : 'Quando você enviar os dois prints, eles aparecerão aqui.'}
            </p>
          </div>
        </section>
      ) : (
        <div className="checkin-records">
          {result.records.map((record) => (
            <article className="checkin-record" key={record.id}>
              <time
                className="checkin-record-date"
                dateTime={record.day}
                aria-label={dayLabel(record.day)}
              >
                <strong>{record.day.slice(8)}</strong>
                <span>
                  {new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
                    .format(new Date(`${record.day}T12:00:00Z`))
                    .replace('.', '')}
                </span>
              </time>
              <div className="checkin-record-heading">
                <div>
                  <h3>
                    {admin
                      ? record.name
                      : record.day === result.today
                        ? 'Seu ponto de hoje'
                        : 'Ponto registrado'}
                    <CheckCheck size={15} aria-label="Recebido" />
                  </h3>
                  {admin && (
                    <p>
                      @{record.discord}
                      {record.blue ? ` · ${record.blue}` : ''}
                    </p>
                  )}
                  <div className="checkin-record-meta">
                    <span>
                      {new Intl.DateTimeFormat('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Sao_Paulo',
                      }).format(new Date(record.createdAt))}{' '}
                      · Brasília
                    </span>
                    {record.office && <span>{record.office}</span>}
                  </div>
                </div>
              </div>
              <div className="checkin-proofs">
                {admin && data?.user.admin && (
                  <DeleteAction
                    url={`/api/checkins/${record.id}`}
                    title={`Ponto de ${record.name} · ${record.day}`}
                    label="Excluir ponto"
                    description="O ponto e os dois comprovantes serão apagados. Ele deixará de contar no ranking; o filiado poderá registrar novamente esse dia se ainda for hoje."
                    onDeleted={() => {
                      setPage(0);
                      setVersion((v) => v + 1);
                    }}
                  />
                )}
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
                    {kind === 'actions' ? <FileImage size={16} /> : <MessageSquare size={16} />}
                    <span>{kind === 'actions' ? '3 ações' : 'Blue'}</span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {!error && !!result?.records.length && (
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
            <div className="checkin-proof-tabs" role="group" aria-label="Escolher comprovante">
              {(['actions', 'blue'] as const).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={proof.kind === kind}
                  onClick={() => {
                    setProofError('');
                    setProof({ ...proof, kind });
                  }}
                >
                  {kind === 'actions' ? <FileImage size={15} /> : <MessageSquare size={15} />}
                  {kind === 'actions' ? 'Três ações' : 'Post no Blue'}
                </button>
              ))}
            </div>
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
