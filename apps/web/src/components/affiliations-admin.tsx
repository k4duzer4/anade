'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, ClipboardList, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { usePortal } from './portal-provider';
import { ErrorNotice, Modal, PageHeading, SubmitButton } from './ui';
import { Form } from './form';
import { Select } from './select';
import {
  affiliationStatuses,
  deliveryErrors,
  type Affiliation,
  type Delivery,
} from '@/lib/affiliations';
import { portalRequest } from '@/lib/portal-request';

type Queue = { requests: Affiliation[]; total: number; botConfigured: boolean };
const format = (date: string) =>
  new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
export default function AffiliationsAdmin() {
  const { data, notify } = usePortal();
  const [queue, setQueue] = useState<Queue | null>(null),
    [status, setStatus] = useState('pending'),
    [page, setPage] = useState(0);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Affiliation | null>(null),
    [decision, setDecision] = useState<'approved' | 'rejected' | null>(null),
    [note, setNote] = useState('');
  const [retry, setRetry] = useState<{ record: Affiliation; kind: 'role' | 'dm' } | null>(null);
  const load = useCallback(
    (signal?: AbortSignal) => {
      return portalRequest<Queue>(`/api/admin/affiliations?status=${status}&page=${page}`, {
        signal,
      })
        .then((result) => {
          if (!signal?.aborted) {
            setQueue(result);
            setError('');
          }
        })
        .catch((e) => {
          if (!signal?.aborted) setError((e as Error).message);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [status, page],
  );
  useEffect(() => {
    if (!data?.user.admin) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [data?.user.admin, load]);
  async function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !decision || !data) return;
    setBusy(true);
    setError('');
    try {
      await portalRequest(`/api/admin/affiliations/${selected.id}/review`, {
        method: 'POST',
        csrf: data.csrf,
        body: { decision, note },
      });
      setDecision(null);
      setSelected(null);
      setNote('');
      notify(
        decision === 'approved'
          ? 'Filiação aprovada. Consulte a situação Aprovada para verificar o cargo e o aviso.'
          : 'Solicitação recusada.',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retryDelivery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!retry || !data) return;
    setBusy(true);
    setError('');
    try {
      const result = await portalRequest<{ request: Affiliation }>(
        `/api/admin/affiliations/${retry.record.id}/delivery`,
        { method: 'POST', csrf: data.csrf, body: { kind: retry.kind, confirmDuplicateRisk: true } },
      );
      if (selected?.id === result.request.id) setSelected(result.request);
      setRetry(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function deliveryStatus(record: Affiliation, kind: 'role' | 'dm') {
    const delivery: Delivery | undefined = record.deliveries?.[kind];
    if (!delivery) return null;
    const label = {
      pending: 'Pendente',
      sending: 'Em processamento',
      sent: 'Concluído',
      failed: 'Não concluído',
      unknown: 'Envio não confirmado',
    }[delivery.state];
    return (
      <div className="affiliation-delivery">
        <div>
          <strong>{kind === 'role' ? 'Cargo Filiado' : 'Mensagem no Discord'}</strong>
          <span data-delivery-state={delivery.state}>{label}</span>
          <p>
            {delivery.error
              ? deliveryErrors[delivery.error] || 'Não foi possível concluir.'
              : delivery.sentAt
                ? format(delivery.sentAt)
                : 'Aguardando confirmação do Discord.'}
          </p>
          {delivery.retryAt && <small>Nova tentativa após {format(delivery.retryAt)}</small>}
        </div>
        {delivery.state !== 'sent' && (
          <button
            className="button outline"
            disabled={busy || !queue?.botConfigured}
            onClick={() => setRetry({ record, kind })}
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        )}
      </div>
    );
  }
  if (!data?.user.admin) return null;
  return (
    <div className="affiliations-admin">
      <PageHeading
        eyebrow="ADMINISTRAÇÃO · FILIAÇÕES"
        title="Novas pessoas. O mesmo projeto."
        description="Analise as solicitações e acompanhe a integração com o Discord."
        action={
          <button
            className="button secondary"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        }
      />
      <Link href="/administracao" className="text-link">
        <ArrowLeft size={15} />
        Centro de gestão
      </Link>
      {queue && !queue.botConfigured && (
        <div className="affiliation-bot-notice">
          <ShieldCheck size={22} />
          <div>
            <strong>Integração do bot pendente de configuração</strong>
            <p>
              As decisões e o acesso ao site funcionam. Para entregar o cargo e a mensagem,
              configure DISCORD_BOT_TOKEN no backend e coloque o bot acima de Filiado no servidor.
              Depois use “Tentar novamente” nas aprovações pendentes.
            </p>
          </div>
        </div>
      )}
      <div className="affiliation-queue-bar">
        <Select
          aria-label="Situação das solicitações"
          value={status}
          disabled={busy || loading}
          onValueChange={(value) => {
            setLoading(true);
            setStatus(value);
            setPage(0);
            setQueue(null);
          }}
          options={Object.entries(affiliationStatuses).map(([value, label]) => ({ value, label }))}
        />
        <span aria-live="polite">
          {loading ? 'Carregando…' : `${queue?.total ?? 0} solicitações`}
        </span>
      </div>
      <ErrorNotice message={error} />
      <div className="affiliation-queue" aria-busy={loading}>
        {queue?.requests.map((record) => (
          <article className="affiliation-queue-card" key={record.id}>
            <header>
              <span className="affiliation-monogram">{record.data.name.slice(0, 1)}</span>
              <div>
                <h2>{record.data.name}</h2>
                <p>
                  {record.data.city}/{record.data.state} · @{record.discord}
                </p>
              </div>
              <span className="badge gray">{affiliationStatuses[record.status]}</span>
            </header>
            <p className="affiliation-contribution">{record.data.contribution}</p>
            <footer>
              <small>Enviada em {format(record.submittedAt)}</small>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setSelected(record);
                  setNote('');
                }}
              >
                Ver solicitação
                <ClipboardList size={15} />
              </button>
            </footer>
            {record.status === 'approved' && (
              <div>
                {deliveryStatus(record, 'role')}
                {deliveryStatus(record, 'dm')}
              </div>
            )}
          </article>
        ))}
      </div>
      {!loading && queue?.total === 0 && (
        <section className="panel affiliation-empty">
          <ClipboardList size={32} />
          <h2>Nenhuma solicitação nesta situação.</h2>
          <p>Novos pedidos aparecerão aqui após o envio da ficha.</p>
        </section>
      )}
      {queue && queue.total > 20 && (
        <div className="affiliation-pagination">
          <button
            className="button outline"
            disabled={loading || busy || page === 0}
            onClick={() => setPage((v) => v - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page + 1} de {Math.ceil(queue.total / 20)}
          </span>
          <button
            className="button outline"
            disabled={loading || busy || (page + 1) * 20 >= queue.total}
            onClick={() => setPage((v) => v + 1)}
          >
            Próxima
          </button>
        </div>
      )}
      {selected && !retry && (
        <Modal
          title="Solicitação de filiação"
          onClose={() => {
            if (!busy) {
              setSelected(null);
              setDecision(null);
            }
          }}
        >
          <div className="affiliation-review">
            <h3>{selected.data.name}</h3>
            <p>
              @{selected.discord} · ID {selected.accountId}
            </p>
            <dl>
              {[
                ['Cidade/estado', `${selected.data.city}/${selected.data.state}`],
                ['Idade do personagem', `${selected.data.age} anos`],
                ['Formação', selected.data.degrees.join(' e ')],
                ['LegApp', selected.data.legapp],
                ['E-mail no Legado', selected.data.email],
                ['Blue', selected.data.blue],
                ['Corrente de afinidade', selected.data.current],
                ['O que pretende fazer no Legado', selected.data.plans],
                ['Como pretende contribuir', selected.data.contribution],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              Aceite da versão {selected.data.legalVersion} em {format(selected.data.acceptedAt)}.
            </p>
            {selected.reviewNote && <blockquote>{selected.reviewNote}</blockquote>}
            {selected.status === 'pending' && (
              <>
                {!decision ? (
                  <div className="affiliation-review-actions">
                    <button className="button" onClick={() => setDecision('approved')}>
                      <Check size={16} />
                      Aprovar filiação
                    </button>
                    <button className="button outline" onClick={() => setDecision('rejected')}>
                      <X size={16} />
                      Recusar
                    </button>
                  </div>
                ) : (
                  <Form onSubmit={review}>
                    <h3>{decision === 'approved' ? 'Confirmar aprovação' : 'Confirmar recusa'}</h3>
                    <p>
                      {decision === 'approved'
                        ? 'A pessoa terá acesso ao portal. O bot tentará atribuir o cargo Filiado e enviar a mensagem no Discord.'
                        : 'O pedido será encerrado e o acesso continuará bloqueado. A pessoa poderá enviar uma nova solicitação.'}
                    </p>
                    <label>
                      Resposta ao solicitante (opcional)
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        rows={3}
                      />
                    </label>
                    <ErrorNotice message={error} />
                    <div className="affiliation-review-actions">
                      <SubmitButton busy={busy}>
                        {decision === 'approved' ? 'Confirmar aprovação' : 'Confirmar recusa'}
                      </SubmitButton>
                      <button
                        type="button"
                        className="button outline"
                        disabled={busy}
                        onClick={() => setDecision(null)}
                      >
                        Voltar
                      </button>
                    </div>
                  </Form>
                )}
              </>
            )}
            {selected.status === 'approved' && (
              <>
                {deliveryStatus(selected, 'role')}
                {deliveryStatus(selected, 'dm')}
              </>
            )}
          </div>
        </Modal>
      )}
      {retry && (
        <Modal
          title="Tentar integração novamente"
          onClose={() => {
            if (!busy) setRetry(null);
          }}
        >
          <Form onSubmit={retryDelivery}>
            <p>
              O sistema tentará{' '}
              {retry.kind === 'role'
                ? 'atribuir o cargo Filiado'
                : 'enviar a mensagem de aprovação'}{' '}
              para <strong>{retry.record.data.name}</strong>.
            </p>
            {retry.record.deliveries?.[retry.kind]?.state === 'unknown' && (
              <label className="affiliation-consent">
                <input type="checkbox" required />
                Entendo que a mensagem anterior pode ter sido entregue e uma nova tentativa pode
                duplicá-la.
              </label>
            )}
            <ErrorNotice message={error} />
            <SubmitButton busy={busy}>Confirmar tentativa</SubmitButton>
          </Form>
        </Modal>
      )}
    </div>
  );
}
