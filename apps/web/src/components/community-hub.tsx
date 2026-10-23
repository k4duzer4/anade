'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Heart,
  Lightbulb,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Pencil,
  Pin,
  Plus,
  Rocket,
  Vote,
  LoaderCircle,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, Empty, ErrorNotice, SubmitButton } from './ui';
import { Form } from './form';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import { MemberAvatar } from './member-avatar';
import { SearchBox } from './portal-tools';
import { loadCommunity, shortDay, type CommunityItem, type CommunityList } from '@/lib/community';
import { searchText } from '@/lib/types';

type Kind = 'proposal' | 'announcement' | 'campaign';
const areas = {
  proposal: {
    path: 'proposals',
    title: 'Ideias que viram ação.',
    eyebrow: 'CENTRAL DE PROPOSTAS',
    description: 'Apresente uma ideia, participe da conversa e construa as próximas decisões.',
    action: 'Apresentar proposta',
    Icon: Lightbulb,
  },
  announcement: {
    path: 'announcements',
    title: 'O partido em dia.',
    eyebrow: 'MURAL DE COMUNICADOS',
    description: 'Avisos da direção, orientações e o que você precisa acompanhar.',
    action: 'Publicar comunicado',
    Icon: Megaphone,
  },
  campaign: {
    path: 'campaigns',
    title: 'Um projeto para representar.',
    eyebrow: 'CENTRAL DE CAMPANHA',
    description: 'Pré-candidaturas, propostas, materiais e compromissos em um só lugar.',
    action: 'Cadastrar pré-candidatura',
    Icon: Rocket,
  },
};

export function CommunityHub({ kind }: { kind: Kind }) {
  const { data, mutate, notify } = usePortal();
  const params = useSearchParams(),
    router = useRouter();
  const [result, setResult] = useState<CommunityList | null>(null),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState('');
  const [dialog, setDialog] = useState<{
    type: 'edit' | 'comments' | 'forward' | 'status';
    item?: CommunityItem;
  } | null>(null);
  const area = areas[kind],
    target = params.get('registro') || '';
  useEffect(() => {
    const abort = new AbortController();
    loadCommunity<CommunityList>(
      `/api/${area.path}?page=${target ? 0 : page}${target ? `&id=${encodeURIComponent(target)}` : ''}`,
      abort.signal,
    )
      .then((value) => {
        if (abort.signal.aborted) return;
        setResult(value);
        setError('');
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [area.path, page, version, target, kind]);
  if (!data) return null;
  const reload = () => {
    setLoading(true);
    setVersion((v) => v + 1);
  };
  const own = result?.mine || result?.records.find((item) => item.ownerId === data.user.id);
  const canCreate =
    kind === 'announcement' ? data.user.admin : kind === 'campaign' ? result?.open && !own : true;
  const records =
    result?.records.filter((item) =>
      searchText(
        `${item.title} ${item.body} ${item.office || ''} ${item.state || ''} ${data.members.find((m) => m.id === item.ownerId)?.name || ''}`,
      ).includes(searchText(search)),
    ) || [];
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(data.serverTime),
  );
  async function action(path: string, body: unknown, message: string, id: string) {
    setBusy(id);
    setError('');
    try {
      await mutate(path, 'PUT', body);
      notify(message);
      reload();
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="refresh-page community-page">
      <PageHeading
        eyebrow={area.eyebrow}
        title={area.title}
        description={area.description}
        action={
          canCreate && (
            <button
              className="button primary"
              type="button"
              onClick={() => setDialog({ type: 'edit' })}
            >
              <Plus size={17} />
              {area.action}
            </button>
          )
        }
      />
      {kind === 'campaign' && (
        <div className={`campaign-gate ${result?.open ? 'is-open' : ''}`}>
          <area.Icon size={26} />
          <div>
            <strong>{result?.open ? 'Inscrições abertas' : 'Central de campanha fechada'}</strong>
            <p>
              {result?.open
                ? 'Filiados podem cadastrar e atualizar sua pré-candidatura.'
                : 'Novas pré-candidaturas estarão disponíveis quando a administração abrir a central.'}
            </p>
          </div>
          {data.user.admin && (
            <button
              className="button secondary"
              disabled={!result}
              onClick={() => setDialog({ type: 'status' })}
            >
              {result?.open ? 'Fechar central' : 'Abrir central'}
            </button>
          )}
        </div>
      )}
      {kind === 'campaign' && data.user.admin && result && !result.open && (
        <p className="page-note">
          <LockKeyhole size={13} /> Você pode consultar os registros como administrador. Eles
          permanecem ocultos aos demais filiados enquanto a central está fechada.
        </p>
      )}
      {kind === 'campaign' && own && result?.open && (
        <button
          className="button secondary community-own"
          onClick={() => setDialog({ type: 'edit', item: own })}
        >
          <Pencil size={15} />
          Editar minha pré-candidatura
        </button>
      )}
      <div className="community-toolbar">
        <SearchBox
          value={search}
          onChange={setSearch}
          label={
            kind === 'proposal'
              ? 'Buscar proposta nesta página'
              : kind === 'announcement'
                ? 'Buscar comunicado nesta página'
                : 'Buscar pré-candidatura nesta página'
          }
        />
        <button className="text-button" type="button" onClick={reload} disabled={loading}>
          Atualizar
        </button>
      </div>
      {target && (
        <button
          className="text-button community-own"
          onClick={() => {
            router.replace(
              kind === 'proposal'
                ? '/propostas'
                : kind === 'announcement'
                  ? '/comunicados'
                  : '/campanha',
            );
            setPage(0);
          }}
        >
          <ArrowLeft size={14} />
          Ver todos os registros
        </button>
      )}
      <ErrorNotice message={error} />
      {loading ? (
        <div role="status" className="admin-loading">
          <LoaderCircle className="spin" size={20} />
          Carregando…
        </div>
      ) : (
        <div className="community-grid">
          {records.length ? (
            records.map((item) => {
              const author = data.members.find((m) => m.id === item.ownerId),
                isOwn = item.ownerId === data.user.id,
                expired = !!item.dueDate && item.dueDate < today;
              return (
                <article
                  className={`panel community-card ${item.pinned ? 'is-pinned' : ''}`}
                  id={`registro-${item.id}`}
                  key={item.id}
                >
                  <header>
                    <Link
                      href={`/filiados/${encodeURIComponent(item.ownerId)}`}
                      className="community-author"
                    >
                      <MemberAvatar name={author?.name || 'Filiado'} src={author?.avatarUrl} />
                      <span>
                        <strong>{author?.name || 'Filiado ANADE'}</strong>
                        <small>
                          {new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'medium',
                            timeZone: 'America/Sao_Paulo',
                          }).format(new Date(item.createdAt))}
                        </small>
                      </span>
                    </Link>
                    {item.pinned && (
                      <span className="community-status">
                        <Pin size={13} />
                        Fixado
                      </span>
                    )}
                    {kind === 'proposal' && item.pollId && (
                      <span className="community-status">
                        <Vote size={13} />
                        {data.polls.find((poll) => poll.id === item.pollId)?.closed
                          ? 'Votação encerrada'
                          : 'Encaminhada à votação'}
                      </span>
                    )}
                  </header>
                  <h2>{item.title}</h2>
                  {item.office && (
                    <p className="community-status">
                      {item.office} · {item.state}
                    </p>
                  )}
                  {item.body.length > 450 ? (
                    <details className="community-content">
                      <summary>
                        Ler {kind === 'campaign' ? 'propostas' : 'conteúdo completo'}
                      </summary>
                      <p>{item.body}</p>
                    </details>
                  ) : (
                    <p className="community-body">{item.body}</p>
                  )}
                  {kind === 'announcement' && item.dueDate && (
                    <p className={`community-deadline ${expired ? 'is-expired' : ''}`}>
                      {expired ? 'Prazo encerrado em' : 'Prazo'} {shortDay(item.dueDate)}
                    </p>
                  )}
                  {kind === 'campaign' && (
                    <>
                      <details className="community-content">
                        <summary>Materiais e compromissos</summary>
                        {item.commitments && <p>{item.commitments}</p>}
                        {item.materials?.map((url, i) => (
                          <a
                            className="community-material"
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Material {i + 1}
                            <ArrowUpRight size={14} />
                          </a>
                        ))}
                        {!item.commitments && !item.materials?.length && (
                          <p>Ainda não foram adicionados materiais ou compromissos.</p>
                        )}
                      </details>
                    </>
                  )}
                  <footer>
                    {kind === 'proposal' ? (
                      <>
                        <button
                          type="button"
                          className={`community-support ${item.supported ? 'is-supported' : ''}`}
                          aria-pressed={item.supported}
                          disabled={busy === item.id}
                          onClick={() =>
                            void action(
                              `/api/proposals/${item.id}/support`,
                              { enabled: !item.supported },
                              item.supported ? 'Apoio retirado.' : 'Apoio registrado.',
                              item.id,
                            )
                          }
                        >
                          <Heart size={16} />
                          {item.supports} {item.supports === 1 ? 'apoio' : 'apoios'}
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setDialog({ type: 'comments', item })}
                        >
                          <MessageCircle size={16} />
                          {item.comments} {item.comments === 1 ? 'comentário' : 'comentários'}
                        </button>
                      </>
                    ) : kind === 'announcement' ? (
                      <>
                        <button
                          className="button secondary small-button"
                          disabled={item.read || busy === item.id}
                          onClick={() =>
                            void action(
                              `/api/announcements/${item.id}/read`,
                              {},
                              'Leitura confirmada.',
                              item.id,
                            )
                          }
                        >
                          <Check size={15} />
                          {item.read ? 'Leitura confirmada' : 'Confirmar leitura'}
                        </button>
                        {data.user.admin && <small>{item.reads} leituras confirmadas</small>}
                      </>
                    ) : (
                      <Link
                        className="text-button"
                        href={`/filiados/${encodeURIComponent(item.ownerId)}`}
                      >
                        Conhecer o perfil
                        <ArrowUpRight size={14} />
                      </Link>
                    )}
                  </footer>
                  <div className="community-management">
                    {((kind === 'proposal' && isOwn && !item.pollId) ||
                      (kind === 'announcement' && data.user.admin) ||
                      (kind === 'campaign' && isOwn && result?.open)) && (
                      <button
                        className="text-button"
                        onClick={() => setDialog({ type: 'edit', item })}
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
                    )}
                    {kind === 'proposal' &&
                      (item.pollId ? (
                        <Link
                          className="text-button"
                          href={`/votacoes?votacao=${item.pollId}#votacao-${item.pollId}`}
                        >
                          Acompanhar votação
                          <ArrowRight size={14} />
                        </Link>
                      ) : (
                        data.user.admin && (
                          <button
                            className="text-button"
                            onClick={() => setDialog({ type: 'forward', item })}
                          >
                            <Vote size={14} />
                            Encaminhar para votação
                          </button>
                        )
                      ))}
                  </div>
                </article>
              );
            })
          ) : (
            <section className="panel community-empty">
              <Empty>
                <area.Icon size={28} />
                <h3>
                  {search
                    ? 'Nenhum resultado com essa busca.'
                    : kind === 'proposal'
                      ? 'A próxima ideia pode ser sua.'
                      : kind === 'announcement'
                        ? 'Os próximos avisos chegam por aqui.'
                        : 'Pré-candidaturas aparecerão aqui.'}
                </h3>
                <p>
                  {kind === 'campaign' && !result?.open
                    ? 'Aguarde a abertura da central.'
                    : kind === 'proposal'
                      ? 'Compartilhe uma proposta para começar a conversa.'
                      : 'Acompanhe as atualizações do partido.'}
                </p>
              </Empty>
            </section>
          )}
        </div>
      )}
      {result && !target && (
        <div className="checkin-pagination">
          <span>Página {page + 1}</span>
          <div>
            <button
              className="button secondary small-button"
              disabled={!page || loading}
              onClick={() => {
                setPage(page - 1);
                setLoading(true);
              }}
            >
              Anterior
            </button>
            <button
              className="button secondary small-button"
              disabled={!result.hasMore || loading}
              onClick={() => {
                setPage(page + 1);
                setLoading(true);
              }}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      {dialog?.type === 'edit' && (
        <Modal
          title={dialog.item ? 'Editar registro' : area.action}
          onClose={() => setDialog(null)}
        >
          <EntryForm
            kind={kind}
            item={dialog.item}
            onDone={() => {
              if (!dialog.item) {
                setPage(0);
                if (target)
                  router.replace(
                    kind === 'proposal'
                      ? '/propostas'
                      : kind === 'announcement'
                        ? '/comunicados'
                        : '/campanha',
                  );
              }
              setDialog(null);
              reload();
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'comments' && dialog.item && (
        <Modal title="Conversa da proposta" onClose={() => setDialog(null)}>
          <ProposalConversation item={dialog.item} onChanged={reload} />
        </Modal>
      )}
      {dialog?.type === 'forward' && dialog.item && (
        <Modal title="Encaminhar proposta para votação" onClose={() => setDialog(null)}>
          <ForwardProposal
            item={dialog.item}
            onDone={() => {
              setDialog(null);
              reload();
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'status' && (
        <Modal
          title={result?.open ? 'Fechar Central de campanha' : 'Abrir Central de campanha'}
          onClose={() => setDialog(null)}
        >
          <p className="form-description">
            {result?.open
              ? 'Os filiados deixarão de ver e editar pré-candidaturas. A administração continuará podendo consultá-las.'
              : 'Os filiados poderão consultar, cadastrar e editar suas pré-candidaturas.'}
          </p>
          <ErrorNotice message={error} />
          <div className="form-actions">
            <button className="button secondary" onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy === 'status'}
              onClick={async () => {
                const saved = await action(
                  '/api/admin/campaigns/status',
                  { open: !result?.open },
                  'Central de campanha atualizada.',
                  'status',
                );
                if (saved) setDialog(null);
              }}
            >
              {result?.open ? 'Fechar central' : 'Abrir central'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EntryForm({
  kind,
  item,
  onDone,
}: {
  kind: Kind;
  item?: CommunityItem;
  onDone: () => void;
}) {
  const { data, config, mutate, notify } = usePortal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const me = data?.members.find((m) => m.id === data.user.id);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await mutate(`/api/${areas[kind].path}${item ? `/${item.id}` : ''}`, item ? 'PUT' : 'POST', {
        ...values,
        pinned: values.pinned === 'on',
        materials: String(values.materials || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      notify('Registro salvo.');
      onDone();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Form onSubmit={submit}>
      <div className="form-grid">
        <label className="field full">
          {kind === 'campaign' ? 'Título da pré-candidatura' : 'Título'}
          <input
            name="title"
            defaultValue={item?.title}
            maxLength={200}
            required
            placeholder={
              kind === 'proposal' ? 'Que ideia você quer apresentar?' : 'Um título claro e direto'
            }
          />
        </label>
        {kind === 'campaign' && (
          <>
            <label className="field">
              Cargo pretendido
              <Select
                name="office"
                aria-label="Cargo pretendido"
                defaultValue={item?.office || config?.electoralOffices[0]}
                required
                options={(config?.electoralOffices || []).map((value) => ({ value, label: value }))}
              />
            </label>
            <label className="field">
              Estado
              <Select
                name="state"
                aria-label="Estado da pré-candidatura"
                defaultValue={item?.state || me?.state || config?.states[0]}
                required
                options={(config?.states || []).map((value) => ({ value, label: value }))}
              />
            </label>
          </>
        )}
        <label className="field full">
          {kind === 'campaign' ? 'Apresentação e propostas' : 'Conteúdo'}
          <textarea
            name="body"
            rows={6}
            maxLength={6000}
            defaultValue={item?.body}
            required
            placeholder="Explique com clareza o que deseja compartilhar…"
          />
        </label>
        {kind === 'announcement' && (
          <>
            <label className="field">
              Prazo opcional
              <DateTimePicker
                name="dueDate"
                label="Prazo do comunicado"
                dateOnly
                defaultValue={item?.dueDate}
              />
            </label>
            <label className="community-checkbox">
              <input type="checkbox" name="pinned" defaultChecked={item?.pinned} />
              Fixar no topo do mural
            </label>
          </>
        )}
        {kind === 'campaign' && (
          <>
            <label className="field full">
              Compromissos
              <textarea
                name="commitments"
                rows={4}
                maxLength={4000}
                defaultValue={item?.commitments}
                placeholder="Atividades, compromissos e objetivos da pré-campanha"
              />
            </label>
            <label className="field full">
              Links dos materiais
              <textarea
                name="materials"
                rows={3}
                maxLength={20500}
                defaultValue={item?.materials?.join('\n')}
                placeholder="https://…"
              />
              <small>
                Até dez links HTTPS, um por linha. Podem ser documentos, publicações ou materiais de
                divulgação.
              </small>
            </label>
          </>
        )}
      </div>
      <ErrorNotice message={error} />
      <div className="form-actions">
        <SubmitButton busy={busy}>
          Salvar{' '}
          {kind === 'campaign'
            ? 'pré-candidatura'
            : kind === 'proposal'
              ? 'proposta'
              : 'comunicado'}
        </SubmitButton>
      </div>
    </Form>
  );
}

function ProposalConversation({ item, onChanged }: { item: CommunityItem; onChanged: () => void }) {
  const { data, mutate } = usePortal();
  const [result, setResult] = useState<CommunityList | null>(null),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    loadCommunity<CommunityList>(`/api/proposals/${item.id}/comments?page=${page}`, abort.signal)
      .then(setResult)
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure.message);
      });
    return () => abort.abort();
  }, [item.id, page, version]);
  return (
    <div className="proposal-conversation">
      <p className="form-description">{item.title}</p>
      <Form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await mutate(`/api/proposals/${item.id}/comments`, 'POST', { body });
            setBody('');
            setPage(0);
            setVersion((v) => v + 1);
            onChanged();
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
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            required
          />
        </label>
        <div className="form-actions">
          <SubmitButton busy={busy}>Comentar</SubmitButton>
        </div>
      </Form>
      <ErrorNotice message={error} />
      <div className="community-comments">
        {result?.records.map((comment) => {
          const author = data?.members.find((m) => m.id === comment.ownerId);
          return (
            <article key={comment.id}>
              <MemberAvatar name={author?.name || 'Filiado'} src={author?.avatarUrl} />
              <div>
                <strong>{author?.name || 'Filiado ANADE'}</strong>
                <p>{comment.body}</p>
                <small>
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'medium',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(comment.createdAt))}
                </small>
              </div>
            </article>
          );
        })}
        {result && !result.records.length && (
          <p className="form-description">Comece a conversa com o primeiro comentário.</p>
        )}
      </div>
      <div className="checkin-pagination">
        <span>Página {page + 1}</span>
        <div>
          <button
            className="button secondary small-button"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <button
            className="button secondary small-button"
            disabled={!result?.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

function ForwardProposal({ item, onDone }: { item: CommunityItem; onDone: () => void }) {
  const { mutate, notify } = usePortal();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Form
      onSubmit={async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));
        setBusy(true);
        setError('');
        try {
          await mutate(`/api/proposals/${item.id}/poll`, 'POST', {
            deadline: new Date(String(values.deadline)).toISOString(),
            secret: values.secret === 'true',
            options: String(values.options)
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
          });
          notify('Proposta encaminhada. A votação está aberta aos filiados.');
          onDone();
        } catch (failure) {
          setError((failure as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-description">
        {item.title}. O título e o contexto serão levados à votação. A abstenção é incluída
        automaticamente.
      </p>
      <div className="form-grid">
        <label className="field full">
          Alternativas
          <textarea name="options" rows={4} defaultValue={'Aprovar\nRejeitar'} required />
          <small>De 2 a 10 alternativas, uma por linha.</small>
        </label>
        <label className="field">
          Encerramento
          <DateTimePicker name="deadline" label="Encerramento da votação" required />
        </label>
        <label className="field">
          Modalidade
          <Select
            name="secret"
            aria-label="Modalidade da votação"
            defaultValue="true"
            options={[
              { value: 'true', label: 'Voto secreto' },
              { value: 'false', label: 'Voto nominal' },
            ]}
          />
        </label>
      </div>
      <ErrorNotice message={error} />
      <div className="form-actions">
        <SubmitButton busy={busy}>
          <Vote size={16} />
          Abrir votação
        </SubmitButton>
      </div>
    </Form>
  );
}
