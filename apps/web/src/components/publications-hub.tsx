'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3, Link2, Newspaper, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, Empty, ErrorNotice } from './ui';
import {
  OrganizationForm,
  OrganizationLoading,
  OrganizationPager,
  useOrganization,
} from './organization-ui';
import { Select } from './select';
import { MemberAvatar } from './member-avatar';
import { formatDate } from '@/lib/types';
import { countdown } from '@/lib/season-clock';

export type Publication = {
  id: string;
  ownerId: string;
  title: string;
  type: 'post' | 'materia';
  url: string;
  createdAt: string;
};
type Feed = {
  records: Publication[];
  page: number;
  hasMore: boolean;
  serverTime: string;
  resetsAt: string;
  periodStart: string;
};
export function PublicationsHub() {
  const { data, mutate, notify } = usePortal();
  const [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [dialog, setDialog] = useState<'new' | Publication | null>(null),
    [error, setError] = useState(''),
    [removing, setRemoving] = useState(false);
  const { value, error: loadError } = useOrganization<Feed>(
    `/api/publications?page=${page}`,
    `${version}:${data?.serverTime}`,
  );
  const [elapsed, setElapsed] = useState({ source: '', ms: 0 });
  const expiredCycle = useRef('');
  useEffect(() => {
    if (!value) return;
    const start = Date.now(),
      source = value.serverTime;
    const timer = setInterval(() => setElapsed({ source, ms: Date.now() - start }), 1000);
    return () => clearInterval(timer);
  }, [value]);
  const now = value
    ? Date.parse(value.serverTime) + (elapsed.source === value.serverTime ? elapsed.ms : 0)
    : 0;
  const expired = !!value && now >= Date.parse(value.resetsAt);
  useEffect(() => {
    if (expired && value && expiredCycle.current !== value.resetsAt) {
      expiredCycle.current = value.resetsAt;
      setPage(0);
      setVersion((v) => v + 1);
      setDialog(null);
    }
  }, [expired, value]);
  if (!data) return null;
  const records = expired ? [] : value?.records || [];
  const refresh = () => {
    setPage(0);
    setVersion((v) => v + 1);
  };
  return (
    <div className="refresh-page publication-page">
      <PageHeading
        eyebrow="PARTICIPAÇÃO · VOZ DOS FILIADOS"
        title="Sua voz circula aqui."
        description="Compartilhe seus posts e matérias de jornal com a ANADE."
        action={
          <button className="button primary" onClick={() => setDialog('new')}>
            <Plus size={17} />
            Compartilhar link
          </button>
        }
      />
      <section className="publication-cycle panel">
        <span className="publication-cycle-icon">
          <RefreshCw size={24} />
        </span>
        <div>
          <span className="eyebrow">MURAL DO CICLO ATUAL</span>
          <h2>Novos links a cada dia.</h2>
          <p>
            O mural é esvaziado às 8h de Brasília. Isso remove apenas os links daqui; as publicações
            originais continuam nos seus sites.
          </p>
        </div>
        <div className="publication-reset">
          <span>
            <Clock3 size={14} />
            Renova em
          </span>
          <strong role="timer" aria-label="Tempo para renovar o mural">
            {value ? countdown(Date.parse(value.resetsAt), now) : '—'}
          </strong>
          <small>Todos os dias · 8h</small>
        </div>
      </section>
      <ErrorNotice message={error || loadError} />
      {!value && <OrganizationLoading />}
      <div className="publication-feed-heading">
        <h2>Compartilhado com o partido</h2>
        <button className="text-button" onClick={refresh}>
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>
      {value && !records.length ? (
        <section className="panel">
          <Empty>
            <Newspaper size={32} />
            <h3>{expired ? 'Um novo ciclo começou.' : 'O mural está aberto.'}</h3>
            <p>Seja a primeira pessoa a compartilhar um post ou uma matéria neste ciclo.</p>
            <button className="button secondary" onClick={() => setDialog('new')}>
              <Plus size={15} />
              Compartilhar link
            </button>
          </Empty>
        </section>
      ) : (
        <div className="publication-feed">
          {records.map((item) => {
            const member = data.members.find((m) => m.id === item.ownerId);
            return (
              <article className="panel publication-card" key={item.id}>
                <header>
                  <Link
                    href={`/filiados/${encodeURIComponent(item.ownerId)}`}
                    className="publication-author"
                  >
                    <MemberAvatar name={member?.name || 'Filiado'} src={member?.avatarUrl} />
                    <span>
                      <strong>{member?.name || 'Filiado ANADE'}</strong>
                      <small>{formatDate(item.createdAt)}</small>
                    </span>
                  </Link>
                  <span className="publication-type">
                    {item.type === 'materia' ? <Newspaper size={14} /> : <Link2 size={14} />}{' '}
                    {item.type === 'materia' ? 'Matéria de jornal' : 'Post'}
                  </span>
                </header>
                <a
                  className="publication-link"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <h3>{item.title}</h3>
                  <span>
                    {new URL(item.url).hostname}
                    <ArrowUpRight size={19} />
                  </span>
                </a>
                {(item.ownerId === data.user.id || data.user.admin) && (
                  <button
                    className="text-button publication-remove"
                    onClick={() => {
                      setError('');
                      setDialog(item);
                    }}
                  >
                    <Trash2 size={13} />
                    Retirar do mural
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {value && !expired && (page > 0 || value.hasMore) && (
        <OrganizationPager page={page} hasMore={value.hasMore} onChange={setPage} />
      )}
      {dialog === 'new' && (
        <Modal title="Compartilhar uma publicação" onClose={() => setDialog(null)}>
          <OrganizationForm
            url="/api/publications"
            submit="Compartilhar no mural"
            onSaved={() => {
              setDialog(null);
              refresh();
            }}
            onCancel={() => setDialog(null)}
            transform={(v) => v}
          >
            <p className="form-description">
              Cole o link do seu post ou da matéria publicada. Ele ficará no mural até as próximas
              8h de Brasília.
            </p>
            <label className="field">
              Tipo de publicação
              <Select
                name="type"
                aria-label="Tipo de publicação"
                defaultValue="post"
                options={[
                  { value: 'post', label: 'Post' },
                  { value: 'materia', label: 'Matéria de jornal' },
                ]}
              />
            </label>
            <label className="field">
              Título
              <input
                name="title"
                placeholder="Como você quer apresentar sua publicação?"
                maxLength={160}
                required
              />
            </label>
            <label className="field">
              Link da publicação
              <input name="url" type="url" placeholder="https://" maxLength={2048} required />
            </label>
          </OrganizationForm>
        </Modal>
      )}
      {dialog && dialog !== 'new' && (
        <Modal title="Retirar link do mural?" onClose={() => setDialog(null)}>
          <p>
            “{dialog.title}” deixará de aparecer aqui. A publicação original permanece no site de
            origem.
          </p>
          <ErrorNotice message={error} />
          <div className="form-actions">
            <button className="button outline" onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button
              disabled={removing}
              className="button primary"
              onClick={async () => {
                setRemoving(true);
                setError('');
                try {
                  await mutate(`/api/publications/${dialog.id}`, 'DELETE', {});
                  setDialog(null);
                  refresh();
                  notify('Link retirado do mural.');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {removing ? 'Retirando…' : 'Retirar link'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
