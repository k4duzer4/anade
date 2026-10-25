'use client';
import { useEffect, useState } from 'react';
import { BriefcaseBusiness, CalendarDays, Flag, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePortal } from './portal-provider';
import { Modal, ErrorNotice, SubmitButton } from './ui';
import { Form } from './form';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import { loadCommunity, shortDay, type CommunityItem, type CommunityList } from '@/lib/community';
import { DeleteAction } from './delete-action';
const types = [
  { value: 'cargo', label: 'Cargo' },
  { value: 'candidatura', label: 'Candidatura' },
  { value: 'mandato', label: 'Mandato' },
  { value: 'contribuicao', label: 'Contribuição ao partido' },
];
export function MemberTimeline({ memberId, own }: { memberId: string; own: boolean }) {
  const { data, mutate, notify } = usePortal();
  const [result, setResult] = useState<CommunityList | null>(null),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ item?: CommunityItem; remove?: boolean } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    loadCommunity<CommunityList>(
      `/api/members/${encodeURIComponent(memberId)}/timeline?page=${page}`,
      abort.signal,
    )
      .then(setResult)
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure.message);
      });
    return () => abort.abort();
  }, [memberId, page, version]);
  return (
    <section className="panel member-profile-section member-timeline" id="perfil-historia">
      <header>
        <span className="section-icon">
          <History size={21} />
        </span>
        <div>
          <span className="eyebrow">MARCOS DO PERSONAGEM</span>
          <h2>Linha do tempo</h2>
        </div>
        {own && (
          <button
            className="text-button"
            onClick={() => {
              setError('');
              setDialog({});
            }}
          >
            <Plus size={15} />
            Adicionar
          </button>
        )}
      </header>
      <p className="timeline-caption">
        Cargos, candidaturas, mandatos e contribuições no RPG. Registros declarados pelo filiado.
      </p>
      <ErrorNotice message={error} />
      <div className="timeline-entries">
        {result?.records.map((item) => {
          const Icon =
            item.type === 'cargo'
              ? BriefcaseBusiness
              : item.type === 'candidatura'
                ? Flag
                : CalendarDays;
          return (
            <article key={item.id}>
              <span className="timeline-marker">
                <Icon size={16} />
              </span>
              <div>
                <span className="timeline-date">
                  {item.start && shortDay(item.start)}
                  {item.end && ` — ${shortDay(item.end)}`}
                </span>
                <h3>{item.title}</h3>
                <small>{types.find((t) => t.value === item.type)?.label}</small>
                {item.body && <p>{item.body}</p>}
                {own && (
                  <div className="timeline-actions">
                    <button className="text-button" onClick={() => setDialog({ item })}>
                      <Pencil size={13} />
                      Editar
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDialog({ item, remove: true })}
                    >
                      <Trash2 size={13} />
                      Excluir
                    </button>
                  </div>
                )}
                {!own && data?.user.admin && (
                  <DeleteAction
                    url={`/api/profile/timeline/${item.id}`}
                    title={item.title}
                    label="Excluir marco"
                    description="Este marco será removido da linha do tempo do filiado. Isso não altera os cargos e funções oficiais."
                    onDeleted={() => setVersion((v) => v + 1)}
                  />
                )}
              </div>
            </article>
          );
        })}
        {result && !result.records.length && (
          <p className="member-profile-muted">
            {own
              ? 'Adicione o primeiro marco da sua trajetória.'
              : 'Este filiado ainda não adicionou marcos à sua trajetória.'}
          </p>
        )}
        {!result && !error && <p className="member-profile-muted">Carregando trajetória…</p>}
      </div>
      {result && (page > 0 || result.hasMore) && (
        <div className="checkin-pagination">
          <span>Página {page + 1}</span>
          <div>
            <button className="text-button" disabled={!page} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <button
              className="text-button"
              disabled={!result.hasMore}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      {dialog && !dialog.remove && (
        <Modal
          title={dialog.item ? 'Editar marco' : 'Adicionar marco à trajetória'}
          onClose={() => setDialog(null)}
        >
          <Form
            onSubmit={async (event) => {
              event.preventDefault();
              const values = Object.fromEntries(new FormData(event.currentTarget));
              setBusy(true);
              setError('');
              try {
                await mutate(
                  `/api/profile/timeline${dialog.item ? `/${dialog.item.id}` : ''}`,
                  dialog.item ? 'PUT' : 'POST',
                  values,
                );
                notify('Trajetória atualizada.');
                setDialog(null);
                setVersion((v) => v + 1);
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label className="field full">
                Título
                <input
                  name="title"
                  defaultValue={dialog.item?.title}
                  maxLength={160}
                  required
                  placeholder="Ex.: Primeiro mandato de deputado"
                />
              </label>
              <label className="field full">
                Tipo de marco
                <Select
                  name="type"
                  aria-label="Tipo de marco"
                  defaultValue={dialog.item?.type || 'cargo'}
                  options={types}
                />
              </label>
              <label className="field">
                Início
                <DateTimePicker
                  dateOnly
                  name="start"
                  label="Início do marco"
                  placeholder="Escolher data"
                  defaultValue={dialog.item?.start}
                  required
                />
              </label>
              <label className="field">
                Término opcional
                <DateTimePicker
                  dateOnly
                  name="end"
                  label="Término do marco"
                  placeholder="Sem término"
                  defaultValue={dialog.item?.end}
                />
              </label>
              <label className="field full">
                Descrição
                <textarea name="body" rows={4} maxLength={2000} defaultValue={dialog.item?.body} />
              </label>
            </div>
            <ErrorNotice message={error} />
            <div className="form-actions">
              <SubmitButton busy={busy}>Salvar marco</SubmitButton>
            </div>
          </Form>
        </Modal>
      )}
      {dialog?.remove && dialog.item && (
        <Modal title="Excluir marco da trajetória" onClose={() => setDialog(null)}>
          <p className="form-description">
            Excluir “{dialog.item.title}”? Este registro será removido da sua linha do tempo.
          </p>
          <ErrorNotice message={error} />
          <div className="form-actions">
            <button className="button secondary" onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await mutate(`/api/profile/timeline/${dialog.item!.id}`, 'DELETE', {});
                  notify('Marco removido.');
                  setDialog(null);
                  setVersion((v) => v + 1);
                } catch (failure) {
                  setError((failure as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Excluir marco
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
