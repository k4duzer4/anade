'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Users,
  Vote,
} from 'lucide-react';
import { m } from 'motion/react';
import { usePortal } from './portal-provider';
import { Modal, ErrorNotice, SubmitButton } from './ui';
import { DeleteAction } from './delete-action';
import { formatDate, type Poll } from '@/lib/types';
export function PollCard({
  poll: p,
  onChanged,
  compact = true,
  autoOpen = false,
}: {
  poll: Poll;
  onChanged?: () => void;
  compact?: boolean;
  autoOpen?: boolean;
}) {
  const { data, mutate, notify } = usePortal();
  const [selection, setSelection] = useState<number | null>(null),
    [view, setView] = useState<'details' | 'vote' | 'close' | null>(autoOpen ? 'details' : null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const reviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view === 'vote' || view === 'close') reviewRef.current?.focus();
  }, [view]);
  if (!data) return null;
  const canVote = !p.closed && !p.hasVoted && p.canVote !== false;
  const scheduled =
    !!p.governance && Date.parse(p.governance.opensAt) > Date.parse(data.serverTime);
  const scope = p.governance?.groupName || 'Todos os filiados';
  const status = p.closed
    ? 'Encerrada'
    : p.hasVoted
      ? 'Você já votou'
      : scheduled
        ? 'Agendada'
        : canVote
          ? 'Aberta para votar'
          : 'Acompanhamento';
  function open() {
    setError('');
    setView('details');
  }
  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await mutate(
        `/api/polls/${p.id}/${view === 'vote' ? 'vote' : 'close'}`,
        'POST',
        view === 'vote' ? { option: selection } : {},
      );
      notify(
        view === 'vote' ? 'Seu voto foi registrado.' : 'Votação encerrada. Resultado disponível.',
      );
      setView(null);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <m.article
      layout
      className={`panel refresh-poll decision-card ballot-tile ${compact ? 'is-compact' : ''}`}
      id={`votacao-${p.id}`}
      transition={{ duration: 0.2 }}
    >
      <header>
        <span className="ballot-tile-scope">
          <Vote size={16} />
          {scope}
        </span>
        <span className={`ballot-tile-status ${canVote ? 'can-vote' : ''}`}>
          {p.hasVoted ? <CheckCircle2 size={13} /> : null}
          {status}
        </span>
      </header>
      <h2>
        <button onClick={open}>{p.title}</button>
      </h2>
      <p className="ballot-tile-description">
        {p.description
          ? p.description.split('\n').filter(Boolean)[0]
          : 'Uma decisão para construir nosso projeto coletivo.'}
      </p>
      <div className="ballot-tile-meta">
        <span>
          <Clock3 size={14} />
          {formatDate(p.deadline)}
        </span>
        <span>
          {p.secret ? <LockKeyhole size={14} /> : <Users size={14} />}{' '}
          {p.secret ? 'Secreta' : 'Nominal'}
        </span>
      </div>
      <footer>
        <span>
          {p.total} {p.total === 1 ? 'participação' : 'participações'}
        </span>
        <button className={`button ${canVote ? 'primary' : 'secondary'}`} onClick={open}>
          {canVote
            ? 'Votar agora'
            : p.closed
              ? 'Ver resultado'
              : p.hasVoted
                ? 'Ver meu voto'
                : 'Ver detalhes'}
          <ArrowRight size={15} />
        </button>
      </footer>
      {view && (
        <Modal
          className={`voting-dialog ${view === 'details' ? 'is-details' : 'is-review'}`}
          title={
            view === 'vote'
              ? 'CONFIRMAR SEU VOTO'
              : view === 'close'
                ? 'ENCERRAR VOTAÇÃO'
                : 'Votação interna'
          }
          onClose={() => {
            if (!busy) setView(null);
          }}
        >
          {view === 'details' ? (
            <div className="ballot-workspace">
              <header className="ballot-workspace-heading">
                <span className="eyebrow">{scope}</span>
                <h2>{p.title}</h2>
                <span className={`ballot-tile-status ${canVote ? 'can-vote' : ''}`}>{status}</span>
              </header>
              <div className="ballot-workspace-body">
                <div className="ballot-workspace-main">
                  {p.description && (
                    <details className="ballot-proposal">
                      <summary>
                        Sobre esta proposta
                        <ChevronDown size={15} />
                      </summary>
                      <p>{p.description}</p>
                    </details>
                  )}
                  {canVote ? (
                    <>
                      <span className="ballot-step-label">01 · ESCOLHA</span>
                      <h3>Como você quer votar?</h3>
                      <p className="ballot-help">
                        Selecione uma alternativa. Na próxima etapa, você revisa e confirma.
                      </p>
                      <fieldset className="ballot-options">
                        <legend>Escolha uma alternativa</legend>
                        {p.options.map((option, index) => (
                          <label
                            key={index}
                            className={`${selection === index ? 'is-selected' : ''} ${index === p.abstentionIndex ? 'is-abstention' : ''}`}
                          >
                            <input
                              type="radio"
                              name={`poll-${p.id}`}
                              checked={selection === index}
                              onChange={() => setSelection(index)}
                            />
                            <span className="ballot-option-index">
                              {index === p.abstentionIndex ? '—' : String.fromCharCode(65 + index)}
                            </span>
                            <span>{option}</span>
                            <span className="ballot-option-check">
                              {selection === index ? <Check size={15} /> : null}
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    </>
                  ) : p.hasVoted ? (
                    <div className="ballot-complete">
                      <span>
                        <CheckCircle2 size={28} />
                      </span>
                      <h3>Você já participou desta decisão.</h3>
                      <p>Seu voto está contabilizado. A escolha é definitiva.</p>
                      <div>
                        <small>SUA ESCOLHA</small>
                        <strong>
                          {p.myVote !== null && p.myVote !== undefined
                            ? p.options[p.myVote]
                            : 'Voto registrado'}
                        </strong>
                      </div>
                    </div>
                  ) : !p.closed ? (
                    <div className="ballot-observer">
                      <ShieldCheck size={28} />
                      <h3>
                        {scheduled
                          ? 'A votação ainda não abriu.'
                          : 'Você está acompanhando esta votação.'}
                      </h3>
                      <p>
                        {scheduled
                          ? `Abertura prevista para ${formatDate(p.governance!.opensAt)}.`
                          : 'O voto é permitido somente aos eleitores definidos, com as permissões e a presença exigidas.'}
                      </p>
                      {p.governance?.plenaryMeetingId && (
                        <a
                          className="button secondary"
                          href={`/plenario/${p.governance.plenaryMeetingId}`}
                        >
                          Ver plenário
                          <ArrowRight size={15} />
                        </a>
                      )}
                    </div>
                  ) : null}
                  {p.outcome && (
                    <div className="ballot-outcome" role="status">
                      <small>RESULTADO</small>
                      <h3>
                        {p.outcome.winner === null ? p.outcome.reason : p.options[p.outcome.winner]}
                      </h3>
                      {p.outcome.winner !== null && <p>{p.outcome.reason}</p>}
                    </div>
                  )}
                  {p.counts && (
                    <div className="poll-results ballot-results">
                      {p.options.map((option, index) => (
                        <div key={index}>
                          <div>
                            <span>{option}</span>
                            <b>
                              {p.total ? Math.round((p.counts![index] / p.total) * 100) : 0}%{' '}
                              <small>({p.counts![index]})</small>
                            </b>
                          </div>
                          <div
                            className="result-track"
                            role="progressbar"
                            aria-valuenow={p.counts![index]}
                            aria-valuemin={0}
                            aria-valuemax={Math.max(p.total, 1)}
                            aria-label={`Votos em ${option}`}
                          >
                            <m.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${p.total ? (p.counts![index] / p.total) * 100 : 0}%`,
                              }}
                              transition={{ duration: 0.35 }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="ballot-help">
                        {p.validVotes} votos válidos · {p.abstentions} abstenções. Percentuais sobre
                        toda a participação.
                      </p>
                    </div>
                  )}
                  {p.secret && !p.closed && (
                    <p className="ballot-secrecy">
                      <LockKeyhole size={14} />O resultado será divulgado após o encerramento.
                    </p>
                  )}
                  {p.ballots && p.ballots.length > 0 && (
                    <details className="ballots">
                      <summary>Consultar votos nominais</summary>
                      {p.ballots.map((ballot) => (
                        <p key={ballot.id}>
                          <strong>
                            {data.members.find((member) => member.id === ballot.id)?.name ||
                              'Filiado sem ficha'}
                          </strong>
                          <span>{p.options[ballot.option]}</span>
                        </p>
                      ))}
                    </details>
                  )}
                </div>
                <aside className="ballot-workspace-summary">
                  <h3>Resumo da votação</h3>
                  <dl>
                    <div>
                      <dt>Encerramento</dt>
                      <dd>{formatDate(p.deadline)}</dd>
                    </div>
                    <div>
                      <dt>Modalidade</dt>
                      <dd>{p.secret ? 'Voto secreto' : 'Voto nominal'}</dd>
                    </div>
                    <div>
                      <dt>Participação</dt>
                      <dd>
                        {p.total} {p.total === 1 ? 'voto registrado' : 'votos registrados'}
                      </dd>
                    </div>
                    {p.governance && (
                      <>
                        <div>
                          <dt>Eleitorado</dt>
                          <dd>{p.governance.electorIds.length} eleitores</dd>
                        </div>
                        <div>
                          <dt>Quórum mínimo</dt>
                          <dd>{p.governance.quorumPercent}%</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  {p.governance && (
                    <details className="ballot-rules">
                      <summary>
                        Regras e eleitores
                        <ChevronDown size={14} />
                      </summary>
                      <p>
                        {scope} · {p.governance.electorIds.length}{' '}
                        {p.governance.electorIds.length === 1 ? 'eleitor' : 'eleitores'} · quórum{' '}
                        {p.governance.quorumPercent}%.
                      </p>
                      <p>
                        {
                          (
                            {
                              plurality: 'Mais votos válidos, sem empate.',
                              absolute: 'Mais da metade de todo o eleitorado.',
                              two_thirds: 'Dois terços de todo o eleitorado.',
                            } as Record<string, string>
                          )[p.governance.rule]
                        }{' '}
                        Abstenções contam como participação, sem apoiar alternativas.
                      </p>
                      {p.governance.requiredOffice && (
                        <p>Cargo oficial obrigatório: {p.governance.requiredOffice}.</p>
                      )}
                      <p>
                        {p.governance.electorIds
                          .map(
                            (id) =>
                              data.members.find((member) => member.id === id)?.name ||
                              'Filiado sem ficha',
                          )
                          .join(', ')}
                        .
                      </p>
                    </details>
                  )}
                  {canVote && selection !== null && (
                    <div className="ballot-selection">
                      <small>SUA ESCOLHA</small>
                      <strong>{p.options[selection]}</strong>
                      <span>Ainda não enviada.</span>
                    </div>
                  )}
                  {data.user.admin && (
                    <details className="ballot-management">
                      <summary>
                        Gerenciar votação
                        <ChevronDown size={14} />
                      </summary>
                      {!p.closed && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setError('');
                            setView('close');
                          }}
                        >
                          Encerrar votação
                        </button>
                      )}
                      <DeleteAction
                        url={`/api/polls/${p.id}`}
                        title={p.title}
                        label="Excluir votação"
                        description={`A votação, alternativas, resultados e ${p.total} voto(s) serão apagados. Se veio de uma proposta, a proposta permanece e poderá ser encaminhada novamente.`}
                        requireName
                        onDeleted={() => {
                          setView(null);
                          onChanged?.();
                        }}
                      />
                    </details>
                  )}
                </aside>
              </div>
              <footer className="ballot-workspace-footer">
                <span>
                  {canVote
                    ? 'Um voto por pessoa. Você revisa antes de confirmar.'
                    : 'Consulte a proposta, as regras e a situação da decisão.'}
                </span>
                {canVote ? (
                  <button
                    className="button primary"
                    disabled={selection === null}
                    onClick={() => setView('vote')}
                  >
                    Revisar voto
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="button secondary" onClick={() => setView(null)}>
                    Voltar à lista
                  </button>
                )}
              </footer>
            </div>
          ) : (
            <div className="ballot-review" ref={reviewRef} tabIndex={-1}>
              <form onSubmit={confirm}>
                <span className="ballot-step-label">
                  {view === 'vote' ? '02 · CONFIRMAÇÃO' : 'ADMINISTRAÇÃO'}
                </span>
                <h3>{p.title}</h3>
                {view === 'vote' ? (
                  <>
                    <p>Confira sua escolha antes de enviar.</p>
                    <div className="ballot-review-choice">
                      <CheckCircle2 size={24} />
                      <strong>{p.options[selection!]}</strong>
                    </div>
                    {selection === p.abstentionIndex && (
                      <p>Sua abstenção conta como participação, sem apoiar uma alternativa.</p>
                    )}
                    <p className="ballot-help">
                      O voto é definitivo e não poderá ser alterado.{' '}
                      {p.secret
                        ? 'Os filiados não verão sua escolha.'
                        : 'Seu nome e sua escolha ficarão visíveis aos filiados.'}
                    </p>
                  </>
                ) : (
                  <p>
                    O encerramento é definitivo. Novos votos serão bloqueados e o resultado será
                    divulgado aos filiados.
                  </p>
                )}
                <ErrorNotice message={error} />
                <div className="ballot-review-actions">
                  <button
                    type="button"
                    className="button outline"
                    disabled={busy}
                    onClick={() => setView('details')}
                  >
                    <ArrowLeft size={15} />
                    Voltar
                  </button>
                  <SubmitButton busy={busy}>
                    {view === 'vote' ? 'Confirmar voto' : 'Encerrar e divulgar'}
                  </SubmitButton>
                </div>
              </form>
            </div>
          )}
        </Modal>
      )}
    </m.article>
  );
}
