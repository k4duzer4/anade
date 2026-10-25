'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AudioLines,
  Check,
  CheckCheck,
  ChevronRight,
  FileText,
  Hand,
  Landmark,
  ListOrdered,
  Mic,
  Plus,
  Settings2,
  ShieldCheck,
  Users,
  Vote,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, ErrorNotice, SubmitButton } from './ui';
import { MembersPicker, OrganizationLoading } from './organization-ui';
import { Select } from './select';
import { MemberAvatar } from './member-avatar';
import { AgendaConversation } from './agenda-conversation';
import { PollCard } from './poll-card';
import { KmeetAudio } from './kmeet-audio';
import { portalRequest } from '@/lib/portal-request';
import { formatDate } from '@/lib/types';
import type { Admission, PlenaryState } from '@/lib/plenary';

export function PlenaryRoom({ id }: { id: string }) {
  const { data, notify } = usePortal();
  const [value, setValue] = useState<PlenaryState | null>(null),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [admission, setAdmission] = useState<Admission | null>(null),
    [closingPoll, setClosingPoll] = useState<string | null>(null),
    [dialog, setDialog] = useState<'settings' | 'poll' | 'open' | 'close' | null>(null);
  const base = `/api/plenaries/${id}`;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const ended = useCallback((message?: string) => {
    setAdmission(null);
    if (message) setError(message);
    setVersion((v) => v + 1);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const result = await portalRequest<PlenaryState>(base, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setValue(result);
          setError('');
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError((failure as Error).message);
          if ([401, 403, 404].includes((failure as Error & { status?: number }).status || 0))
            setAdmission(null);
        }
      } finally {
        running = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (!document.hidden && navigator.onLine) void load();
    }, 10000);
    const focus = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [base, version]);
  if (!data) return null;
  const session = value?.session,
    live = session?.status === 'open',
    closed = session?.status === 'closed';
  async function action(path: string, method = 'POST', body: unknown = {}) {
    setBusy(true);
    setError('');
    try {
      const result = await portalRequest<{ warning?: string }>(`${base}${path}`, {
        method,
        body,
        csrf: data!.csrf,
      });
      if (result.warning) notify(result.warning);
      setDialog(null);
      reload();
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="refresh-page plenary-page">
      <Link href="/plenario" className="text-button">
        <ArrowLeft size={14} />
        Todos os plenários
      </Link>
      <PageHeading
        eyebrow="PLENÁRIO VIRTUAL · ANADE 10"
        title={value?.meeting.title || 'O partido tem voz.'}
        description={
          value
            ? `${formatDate(value.meeting.date)} · Horários de Brasília`
            : 'Uma mesa, muitas vozes. A mesma aliança.'
        }
        action={
          value?.canManage && (
            <button
              className="button secondary"
              disabled={!!session && session.status !== 'draft'}
              onClick={() => setDialog('settings')}
            >
              <Settings2 size={16} />
              {session ? 'Regras do plenário' : 'Preparar plenário'}
            </button>
          )
        }
      />
      <ErrorNotice message={error} />
      {!value && !error && <OrganizationLoading />}
      {value && (
        <>
          <div className="plenary-statusbar">
            <span className={`plenary-status ${live ? 'is-live' : ''}`}>
              <i />
              {live ? 'Sessão aberta' : closed ? 'Sessão encerrada' : 'Em preparação'}
            </span>
            <span>
              <ShieldCheck size={14} />
              Portal restrito a filiados
            </span>
            {session && (
              <span>
                <Users size={14} />
                {session.capacity} lugares
              </span>
            )}
            {value.canManage && session?.status === 'draft' && (
              <button
                className="button primary small-button"
                disabled={!value.provider.configured}
                onClick={() => setDialog('open')}
              >
                Abrir sessão
                <ChevronRight size={14} />
              </button>
            )}
            {value.canManage && live && (
              <button className="text-button danger" onClick={() => setDialog('close')}>
                Encerrar sessão
              </button>
            )}
          </div>
          <div className="plenary-stage-grid">
            <section className="panel plenary-stage">
              {admission ? (
                <KmeetAudio
                  admission={admission}
                  meetingId={id}
                  csrf={data.csrf}
                  closing={closed}
                  onEnded={ended}
                />
              ) : (
                <div className="plenary-waiting">
                  <span className="plenary-crest">
                    <Landmark size={44} />
                  </span>
                  <span className="eyebrow">A VOZ DA NOSSA ALIANÇA</span>
                  <h2>
                    {closed
                      ? 'O encontro fica na nossa história.'
                      : live
                        ? 'Seu lugar está aqui.'
                        : 'Preparar. Ouvir. Construir.'}
                  </h2>
                  <p>
                    {closed
                      ? 'Consulte a presença, as pautas e as decisões desta reunião.'
                      : live
                        ? 'Entre com o microfone silenciado. Peça a palavra para participar da discussão.'
                        : 'A mesa define os participantes e as regras antes de abrir a sessão.'}
                  </p>
                  <div className="plenary-soundwave" aria-hidden="true">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <i key={n} />
                    ))}
                  </div>
                  <button
                    className="button primary"
                    disabled={busy || !live || !value.provider.configured}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        setAdmission(
                          await portalRequest<Admission>(`${base}/join`, {
                            method: 'POST',
                            csrf: data.csrf,
                            body: {},
                          }),
                        );
                      } catch (failure) {
                        setError((failure as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Mic size={17} />
                    {closed ? 'Sessão encerrada' : live ? 'Entrar no áudio' : 'Aguardando abertura'}
                  </button>
                  <small>
                    Ao entrar, seu nome de personagem e áudio serão compartilhados com o serviço de
                    conferência kMeet e com os participantes. A câmera ficará desativada pelo
                    portal. A moderação do áudio gratuito é compartilhada, independente dos cargos
                    na ANADE.
                  </small>
                </div>
              )}
              {!value.provider.configured && (
                <div className="plenary-service-note">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Áudio aguardando configuração</strong>
                    <p>
                      {value.canManage
                        ? 'O serviço de áudio foi desativado temporariamente pela administração.'
                        : 'A administração está preparando o serviço de áudio para as próximas reuniões.'}
                    </p>
                  </div>
                </div>
              )}
            </section>
            <aside className="panel plenary-agenda">
              <header>
                <ListOrdered size={20} />
                <div>
                  <span className="eyebrow">ORDEM DO DIA</span>
                  <h2>Pautas da reunião</h2>
                </div>
              </header>
              <ol>
                {value.meeting.agenda.map((topic, index) => (
                  <li
                    key={`${index}:${topic}`}
                    className={session?.activeTopic === index ? 'is-current' : ''}
                  >
                    <span className="plenary-topic-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <strong>{topic}</strong>
                      {session?.activeTopic === index && (
                        <small>{live ? 'Em discussão' : 'Pauta selecionada'}</small>
                      )}
                      <div className="content-actions">
                        <AgendaConversation kind="meeting" id={id} title={topic} topic={topic} />
                        {live && value.canModerate && session?.activeTopic !== index && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => void action('/topic', 'PUT', { index })}
                          >
                            Discutir agora
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {value.meeting.docsUrl && (
                <a
                  className="button secondary"
                  href={value.meeting.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText size={16} />
                  Abrir ata
                </a>
              )}
            </aside>
          </div>
          <div className="plenary-work-grid">
            <section className="panel plenary-presence">
              <header>
                <div>
                  <span className="eyebrow">PRESENÇA E PARTICIPAÇÃO</span>
                  <h2>Uma aliança presente.</h2>
                </div>
                <Users size={24} />
              </header>
              <div className={`plenary-quorum ${value.quorumReached ? 'is-ready' : ''}`}>
                <strong>
                  {value.present}
                  <small>/{session?.electorIds.length || 0}</small>
                </strong>
                <div>
                  <b>
                    {value.quorumReached
                      ? 'Quórum atingido'
                      : closed
                        ? 'Presença finalizada'
                        : 'Aguardando quórum'}
                  </b>
                  <span>
                    {session
                      ? `${value.quorum} presença(s) necessária(s) · ${session.quorumPercent}%`
                      : 'A composição será definida pela mesa.'}
                  </span>
                </div>
                {value.quorumReached && <CheckCheck size={24} />}
              </div>
              <p className="plenary-presence-help">
                Quórum considera a conexão ativa, a composição definida e a presença confirmada pela
                mesa. A conexão ao kMeet é informada pelo navegador; a mesa deve conferir a
                identidade antes de confirmar.
              </p>
              <div className="plenary-roster">
                {value.attendees.map((a) => {
                  const member = data.members.find((m) => m.id === a.id);
                  return (
                    <article key={a.id}>
                      <MemberAvatar name={member?.name || 'Filiado'} src={member?.avatarUrl} />
                      <div>
                        <strong>{member?.name || 'Filiado ANADE'}</strong>
                        <small>
                          {closed
                            ? a.confirmedAt
                              ? 'Presença registrada na sessão'
                              : 'Entrada não confirmada'
                            : a.excluded
                              ? 'Entrada suspensa'
                              : a.active
                                ? a.verified
                                  ? 'Presença confirmada'
                                  : 'Aguardando confirmação da mesa'
                                : a.connected
                                  ? 'Conexão expirada'
                                  : 'Fora do áudio'}
                        </small>
                      </div>
                      {value.canModerate && live && a.active && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void action(`/attendees/${a.id}`, 'PUT', { verified: !a.verified })
                          }
                        >
                          {a.verified ? 'Retirar presença' : 'Confirmar presença'}
                        </button>
                      )}
                      {a.handRaised && a.active && <Hand size={17} aria-label="Pediu a palavra" />}
                      <span
                        className={`plenary-presence-dot ${a.active && a.verified ? 'is-present' : ''}`}
                      />
                      {value.canManage && live && a.id !== data.user.id && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            void action(`/attendees/${a.id}`, 'PUT', { excluded: !a.excluded })
                          }
                        >
                          {a.excluded ? 'Permitir entrada' : 'Suspender entrada'}
                        </button>
                      )}
                    </article>
                  );
                })}
                {!value.attendees.length && <p>Ninguém entrou no áudio ainda.</p>}
              </div>
            </section>
            <section className="panel plenary-decisions">
              <header>
                <div>
                  <span className="eyebrow">DECISÕES EM TEMPO REAL</span>
                  <h2>A palavra vira decisão.</h2>
                </div>
                <Vote size={24} />
              </header>
              <p>Votos nominais ou secretos, com abstenção e regras definidas antes da abertura.</p>
              {value.canModerate && live && (
                <button
                  className="button primary"
                  disabled={!value.quorumReached}
                  onClick={() => setDialog('poll')}
                >
                  <Plus size={16} />
                  Abrir votação ao vivo
                </button>
              )}
              {!value.quorumReached && live && (
                <small>A abertura de votação depende do quórum do plenário.</small>
              )}
              <div className="plenary-decision-facts">
                <span>
                  <ShieldCheck size={17} />
                  Eleitorado verificado no servidor
                </span>
                <span>
                  <Check size={17} />
                  Um voto definitivo por pessoa
                </span>
                <span>
                  <AudioLines size={17} />
                  Presença confirmada exigida para votar
                </span>
              </div>
              {!value.polls.length && (
                <div className="plenary-vote-empty">
                  <Vote size={30} />
                  <strong>As decisões aparecerão aqui.</strong>
                  <p>Acompanhe abaixo as votações abertas pela mesa.</p>
                </div>
              )}
            </section>
          </div>
          {!!value.polls.length && (
            <div className="refresh-polls-grid">
              {value.polls.map((p) => (
                <div key={p.id}>
                  <PollCard poll={p} onChanged={reload} />
                  {value.canModerate && !data.user.admin && !p.closed && (
                    <button
                      className="text-button danger"
                      disabled={busy}
                      onClick={() => setClosingPoll(p.id)}
                    >
                      Encerrar esta votação
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {closingPoll && (
        <Modal title="Encerrar votação" onClose={() => setClosingPoll(null)}>
          <p className="form-description">
            Os votos já registrados serão preservados e não serão aceitos novos votos nesta votação.
          </p>
          <ErrorNotice message={error} />
          <div className="form-actions">
            <button className="button outline" onClick={() => setClosingPoll(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (await action(`/polls/${closingPoll}/close`)) setClosingPoll(null);
              }}
            >
              Confirmar encerramento
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'settings' && value && (
        <Modal title="Preparar plenário" onClose={() => setDialog(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const raw = new FormData(e.currentTarget);
              await action('', 'PUT', {
                capacity: Number(raw.get('capacity')),
                quorumPercent: Number(raw.get('quorumPercent')),
                electorIds: raw.getAll('electorIds'),
                moderatorIds: raw.getAll('moderatorIds'),
                sharedModerationAccepted: raw.get('sharedModerationAccepted') === 'on',
              });
            }}
          >
            <p className="form-description">
              Participantes, quórum e mesa ficam definidos antes da abertura. A presidência vem da
              administração ou da liderança oficial do grupo.
            </p>
            <div className="form-grid">
              <label className="field">
                Capacidade
                <input
                  type="number"
                  name="capacity"
                  min={10}
                  max={value.provider.maxCapacity}
                  defaultValue={session?.capacity || value.provider.maxCapacity}
                  required
                />
                <small>Entre 10 e {value.provider.maxCapacity} entradas pelo portal.</small>
              </label>
              <label className="field">
                Quórum (%)
                <input
                  type="number"
                  name="quorumPercent"
                  min={1}
                  max={100}
                  defaultValue={session?.quorumPercent || 50}
                  required
                />
              </label>
            </div>
            <MembersPicker
              name="electorIds"
              label="Composição do quórum e eleitorado"
              members={data.members.filter((m) => value.availableIds.includes(m.id))}
              selected={session?.electorIds || value.availableIds}
            />
            <MembersPicker
              name="moderatorIds"
              label="Mesa e moderação adicional"
              members={data.members.filter((m) => value.availableIds.includes(m.id))}
              selected={session?.moderatorIds || []}
            />
            <div className="plenary-service-note">
              <ShieldCheck size={18} />
              <p>
                O kMeet gratuito tem moderação de áudio compartilhada. Cargos e suspensões da ANADE
                protegem o portal, mas não impedem acesso pelo link externo. Para reuniões sigilosas
                ou com moderação exclusiva, use um provedor com autenticação própria.
              </p>
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                name="sharedModerationAccepted"
                required
                defaultChecked={session?.sharedModerationAccepted || false}
              />
              Estou ciente da moderação compartilhada do áudio e vou conferir a identidade antes de
              confirmar presenças.
            </label>
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button type="button" className="button outline" onClick={() => setDialog(null)}>
                Cancelar
              </button>
              <SubmitButton busy={busy}>Salvar regras</SubmitButton>
            </div>
          </form>
        </Modal>
      )}
      {(dialog === 'open' || dialog === 'close') && (
        <Modal
          title={dialog === 'open' ? 'Abrir sessão' : 'Encerrar sessão'}
          onClose={() => setDialog(null)}
        >
          <p className="form-description">
            {dialog === 'open'
              ? 'A composição e as regras ficarão fixadas. Os participantes autorizados poderão entrar no áudio.'
              : 'A sessão e suas votações serão encerradas no portal. A mesa também deve encerrar a sala no kMeet; o portal não consegue bloquear quem entrou pelo link externo. O histórico continuará disponível.'}
          </p>
          <ErrorNotice message={error} />
          <div className="form-actions">
            <button className="button outline" onClick={() => setDialog(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void action(dialog === 'open' ? '/open' : '/close')}
            >
              {dialog === 'open' ? 'Abrir plenário' : 'Confirmar encerramento'}
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'poll' && value && (
        <Modal title="Abrir votação ao vivo" onClose={() => setDialog(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const raw = new FormData(e.currentTarget);
              const ok = await action('/polls', 'POST', {
                title: raw.get('title'),
                description: raw.get('description'),
                options: String(raw.get('options'))
                  .split('\n')
                  .map((x) => x.trim())
                  .filter(Boolean),
                secret: raw.get('secret') === 'true',
                deadline: new Date(Date.now() + Number(raw.get('minutes')) * 60000).toISOString(),
                quorumPercent: Number(raw.get('quorumPercent')),
                approvalRule: raw.get('approvalRule'),
              });
              if (ok) notify('Votação aberta no plenário.');
            }}
          >
            <p className="form-description">
              Eleitorado fixado: {session?.electorIds.length} integrante(s). É preciso ter a
              presença confirmada pela mesa para votar. A abstenção será incluída automaticamente.
            </p>
            <label className="field">
              Título
              <input
                name="title"
                maxLength={200}
                required
                defaultValue={value.meeting.agenda[session?.activeTopic || 0]}
              />
            </label>
            <label className="field">
              Contexto
              <textarea name="description" rows={2} maxLength={6000} />
            </label>
            <label className="field">
              Alternativas (uma por linha)
              <textarea name="options" rows={3} required defaultValue={'Aprovar\nRejeitar'} />
            </label>
            <div className="form-grid">
              <label className="field">
                Duração (minutos)
                <input name="minutes" type="number" min={1} max={1440} defaultValue={5} required />
              </label>
              <label className="field">
                Quórum da votação (%)
                <input
                  name="quorumPercent"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={session?.quorumPercent || 50}
                  required
                />
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
              <label className="field">
                Aprovação
                <Select
                  name="approvalRule"
                  aria-label="Regra de aprovação"
                  defaultValue="plurality"
                  options={[
                    { value: 'plurality', label: 'Mais votos válidos' },
                    { value: 'absolute', label: 'Maioria absoluta' },
                    { value: 'two_thirds', label: 'Dois terços do eleitorado' },
                  ]}
                />
              </label>
            </div>
            <ErrorNotice message={error} />
            <div className="form-actions">
              <SubmitButton busy={busy}>Abrir votação</SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
