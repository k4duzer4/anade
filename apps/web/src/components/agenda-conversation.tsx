'use client';
import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { usePortal } from './portal-provider';
import { MemberAvatar } from './member-avatar';
import { DeleteAction } from './delete-action';
import { Modal, ErrorNotice, SubmitButton } from './ui';
import { OrganizationLoading, OrganizationPager, useOrganization } from './organization-ui';
import type { Page } from '@/lib/organization';
import { formatDate } from '@/lib/types';

type Comment = { id: string; authorId: string; body: string; createdAt: string };
export function AgendaConversation({
  kind,
  id,
  title,
  topic,
  leaderId,
}: {
  kind: 'note' | 'meeting';
  id: string;
  title: string;
  topic?: string;
  leaderId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-button agenda-discuss"
        aria-label={`Comentar: ${title}`}
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={15} />
        Comentar
      </button>
      {open && (
        <Modal title="Conversa da pauta" onClose={() => setOpen(false)}>
          <Conversation kind={kind} id={id} title={title} topic={topic} leaderId={leaderId} />
        </Modal>
      )}
    </>
  );
}
function Conversation({
  kind,
  id,
  title,
  topic,
  leaderId,
}: {
  kind: 'note' | 'meeting';
  id: string;
  title: string;
  topic?: string;
  leaderId?: string;
}) {
  const { data, mutate, notify } = usePortal();
  const [body, setBody] = useState(''),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const base = `/api/${kind === 'note' ? 'notes' : 'meetings'}/${id}/comments`;
  const query = topic ? `?topic=${encodeURIComponent(topic)}` : '';
  const { value, error: loadError } = useOrganization<Page<Comment>>(
    `${base}${query}${query ? '&' : '?'}page=${page}`,
    version,
  );
  if (!data) return null;
  const reload = () => setVersion((v) => v + 1);
  return (
    <section className="agenda-conversation">
      <div className="agenda-conversation-context">
        <MessageCircle size={20} />
        <div>
          <strong>{title}</strong>
          <p>
            {kind === 'note'
              ? 'Uma conversa entre os participantes deste grupo.'
              : 'Comentários sobre este assunto da reunião.'}
          </p>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim() || busy) return;
          setBusy(true);
          setError('');
          try {
            await mutate(`${base}${query}`, 'POST', { body });
            setBody('');
            setPage(0);
            reload();
            notify('Comentário publicado.');
          } catch (failure) {
            setError((failure as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Seu comentário
          <textarea
            rows={3}
            maxLength={2000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Acrescente uma ideia, atualização ou dúvida…"
            disabled={busy}
          />
        </label>
        <div className="agenda-comment-submit">
          <small>{body.length}/2000</small>
          <SubmitButton busy={busy} disabled={!body.trim()}>
            <Send size={14} />
            Publicar comentário
          </SubmitButton>
        </div>
      </form>
      <ErrorNotice message={error || loadError} />
      {!value && !loadError && <OrganizationLoading />}
      <div className="agenda-comments" aria-live="polite">
        {value?.records.map((c) => {
          const author = data.members.find((m) => m.id === c.authorId);
          return (
            <article key={c.id}>
              <MemberAvatar name={author?.name || 'Filiado'} src={author?.avatarUrl} />
              <div className="agenda-comment-content">
                <header>
                  <strong>{author?.name || 'Filiado ANADE'}</strong>
                  <time dateTime={c.createdAt}>{formatDate(c.createdAt, true)}</time>
                </header>
                <p>{c.body}</p>
                {(data.user.admin || c.authorId === data.user.id || leaderId === data.user.id) && (
                  <DeleteAction
                    url={`${base}/${c.id}${query}`}
                    title="Comentário da pauta"
                    label="Excluir comentário"
                    description="O comentário será removido desta conversa."
                    onDeleted={reload}
                  />
                )}
              </div>
            </article>
          );
        })}
        {value && !value.records.length && (
          <p className="agenda-conversation-empty">
            A conversa começa com você. Compartilhe o primeiro comentário.
          </p>
        )}
      </div>
      {value && (page > 0 || value.hasMore) && (
        <OrganizationPager page={page} hasMore={value.hasMore} onChange={setPage} />
      )}
    </section>
  );
}
