'use client';
import { useId, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Ellipsis,
  LockKeyhole,
  MinusCircle,
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
  compact = false,
}: {
  poll: Poll;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const { data, mutate, notify } = usePortal();
  const detailId = useId();
  const [selection, setSelection] = useState<number | null>(null),
    [expanded, setExpanded] = useState(!compact),
    [dialog, setDialog] = useState<'vote' | 'close' | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!data) return null;
  const scheduled =
    !!p.governance && Date.parse(p.governance.opensAt) > Date.parse(data.serverTime);
  const canVote = !p.closed && !p.hasVoted && p.canVote !== false;
  const status = p.closed
    ? 'Encerrada'
    : p.hasVoted
      ? 'Voto registrado'
      : scheduled
        ? 'Abertura programada'
        : p.canVote === false
          ? 'Eleitorado restrito'
          : 'Aguardando seu voto';
  const scope = p.governance?.groupName || 'Todos os filiados';
  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await mutate(
        `/api/polls/${p.id}/${dialog === 'vote' ? 'vote' : 'close'}`,
        'POST',
        dialog === 'vote' ? { option: selection } : {},
      );
      notify(
        dialog === 'vote' ? 'Seu voto foi registrado.' : 'Votação encerrada. Resultado disponível.',
      );
      setDialog(null);
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
      className={`panel poll-card refresh-poll decision-card ${p.closed ? 'is-closed' : p.hasVoted ? 'is-voted' : ''}`}
      id={`votacao-${p.id}`}
      transition={{ duration: 0.25 }}
    >
      <header className="decision-card-heading">
        <span className="decision-card-symbol">
          <Vote size={20} />
        </span>
        <span className="decision-card-scope">{scope}</span>
        <span className="decision-card-status">
          {p.hasVoted ? (
            <CheckCircle2 size={14} />
          ) : p.closed ? (
            <ShieldCheck size={14} />
          ) : (
            <Clock3 size={14} />
          )}
          {status}
        </span>
      </header>
      <h2>{p.title}</h2>
      <div className="decision-card-facts">
        <span>
          <Clock3 size={15} />
          <span>
            <small>{p.closed ? 'Encerramento' : 'Prazo para votar'}</small>
            <strong>{formatDate(p.deadline)}</strong>
          </span>
        </span>
        <span>
          {p.secret ? <LockKeyhole size={15} /> : <Users size={15} />}
          <span>
            <small>Modalidade</small>
            <strong>{p.secret ? 'Voto secreto' : 'Voto nominal'}</strong>
          </span>
        </span>
      </div>
      {compact && !expanded ? (
        <div className="decision-card-preview">
          <p>
            {p.description
              ? p.description.slice(0, 150) + (p.description.length > 150 ? '…' : '')
              : 'Consulte as alternativas e participe desta decisão.'}
          </p>
          {p.hasVoted && (
            <span className="decision-card-recorded">
              <CheckCircle2 size={15} />
              Sua participação já foi registrada.
            </span>
          )}
          <footer>
            <span>
              <Users size={14} />
              {p.total} {p.total === 1 ? 'participação' : 'participações'}
            </span>
            <button
              className="button primary"
              aria-expanded={false}
              aria-controls={detailId}
              onClick={() => setExpanded(true)}
            >
              {p.closed
                ? 'Ver resultado'
                : p.hasVoted
                  ? 'Ver meu voto'
                  : p.canVote === false
                    ? 'Acompanhar votação'
                    : 'Votar agora'}
              <ArrowRight size={15} />
            </button>
          </footer>
        </div>
      ) : null}
      <div className="poll-detail-body" id={detailId} hidden={compact && !expanded}>
        {p.description &&
          (p.hasVoted || p.closed || p.description.length > 220 ? (
            <details className="decision-card-context">
              <summary>
                {p.hasVoted || p.closed ? 'Ver contexto da votação' : 'Ler proposta completa'}
                <ChevronDown size={14} />
              </summary>
              <p>{p.description}</p>
            </details>
          ) : (
            <div className="decision-card-context">
              <p>{p.description}</p>
            </div>
          ))}
        {p.hasVoted && (
          <div className="decision-vote-receipt">
            <span>
              <CheckCircle2 size={23} />
            </span>
            <div>
              <small>PARTICIPAÇÃO CONFIRMADA</small>
              <strong>
                {p.myVote !== null && p.myVote !== undefined
                  ? p.options[p.myVote]
                  : 'Seu voto foi registrado'}
              </strong>
              <p>Seu voto é definitivo e está contabilizado.</p>
            </div>
            <Check size={17} />
          </div>
        )}
        {p.outcome && (
          <div className="decision-card-outcome" role="status">
            <ShieldCheck size={21} />
            <div>
              <small>RESULTADO DA DELIBERAÇÃO</small>
              <strong>
                {p.outcome.winner === null ? p.outcome.reason : p.options[p.outcome.winner]}
              </strong>
              {p.outcome.winner !== null && <p>{p.outcome.reason}</p>}
              <p>
                Participação: {p.total} de {p.outcome.quorum} necessárias para o quórum.
              </p>
            </div>
          </div>
        )}
        {canVote && (
          <fieldset className="poll-options">
            <legend>Escolha uma alternativa. Você poderá revisar antes de confirmar.</legend>
            {p.options.map((option, index) => (
              <label
                key={index}
                className={`${selection === index ? 'selected' : ''} ${option === 'Abstenção' ? 'abstention-option' : ''}`}
              >
                <input
                  type="radio"
                  name={`poll-${p.id}`}
                  checked={selection === index}
                  onChange={() => setSelection(index)}
                />
                <span className="option-label">
                  <small aria-hidden="true">
                    {option === 'Abstenção' ? '—' : String.fromCharCode(65 + index)}
                  </small>
                  {option}
                </span>
                {option === 'Abstenção' && <MinusCircle size={16} />}
                <span
                  className={`choice-indicator ${selection === index ? 'is-selected' : ''}`}
                  aria-hidden="true"
                >
                  {selection === index && <Check size={14} />}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {p.counts && (
          <>
            <div className="poll-results">
              {p.options.map((option, index) => (
                <div key={index} className={option === 'Abstenção' ? 'abstention-result' : ''}>
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
                      animate={{ width: `${p.total ? (p.counts![index] / p.total) * 100 : 0}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="participation-summary">
              <span>
                <b>{p.validVotes}</b> {p.validVotes === 1 ? 'voto válido' : 'votos válidos'}
              </span>
              <span>
                <b>{p.abstentions}</b> {p.abstentions === 1 ? 'abstenção' : 'abstenções'}
              </span>
              <small>Percentuais sobre toda a participação.</small>
            </div>
          </>
        )}
        {p.secret && !p.closed && (
          <p className="decision-secrecy-note">
            <LockKeyhole size={14} />
            Resultado disponível após o encerramento.
          </p>
        )}
        {p.governance && (
          <details className="decision-card-rules">
            <summary>
              <span>
                <ShieldCheck size={15} />
                Regras e eleitores
              </span>
              <span>
                {p.governance.electorIds.length}{' '}
                {p.governance.electorIds.length === 1 ? 'eleitor' : 'eleitores'}
                <ChevronDown size={14} />
              </span>
            </summary>
            <div>
              <p>
                {scope} · {p.governance.electorIds.length}{' '}
                {p.governance.electorIds.length === 1 ? 'eleitor' : 'eleitores'} · quórum{' '}
                {p.governance.quorumPercent}%
              </p>
              <p>
                Regra:{' '}
                {
                  (
                    {
                      plurality: 'mais votos válidos, sem empate',
                      absolute: 'mais da metade de todo o eleitorado',
                      two_thirds: 'dois terços de todo o eleitorado',
                    } as Record<string, string>
                  )[p.governance.rule]
                }
                . Abstenções contam para participação e não apoiam alternativas.
              </p>
              <p>
                Abertura: {formatDate(p.governance.opensAt)}. Eleitores definidos na publicação:
              </p>
              {p.governance.requiredOffice && (
                <p>
                  Cargo obrigatório ao votar: {p.governance.requiredOffice}, confirmado pela
                  administração. A perda do cargo retira a autorização para novos votos.
                </p>
              )}
              <p>
                {p.governance.electorIds
                  .map(
                    (id) =>
                      data.members.find((member) => member.id === id)?.name || 'Filiado sem ficha',
                  )
                  .join(', ')}
                .
              </p>
            </div>
          </details>
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
        {p.governance?.plenaryMeetingId && p.canVote === false && !p.closed && !p.hasVoted && (
          <a
            className="text-button decision-room-link"
            href={`/plenario/${p.governance.plenaryMeetingId}`}
          >
            Ver plenário
            <ArrowRight size={14} />
          </a>
        )}
        {canVote && (
          <div className="decision-vote-action">
            <span>
              {selection === null
                ? 'Selecione uma alternativa para continuar.'
                : 'A escolha só será enviada após sua confirmação.'}
            </span>
            <button
              className="button primary"
              disabled={selection === null}
              onClick={() => {
                setError('');
                setDialog('vote');
              }}
            >
              Revisar voto
              <ArrowRight size={15} />
            </button>
          </div>
        )}
        <footer className="decision-card-footer">
          <span className="decision-participation">
            <Users size={14} />
            {p.total} {p.total === 1 ? 'participação' : 'participações'}
          </span>
          <div>
            {compact && expanded && (
              <button
                className="text-button poll-collapse"
                disabled={busy || !!dialog}
                aria-expanded={true}
                aria-controls={detailId}
                onClick={() => setExpanded(false)}
              >
                Recolher detalhes
              </button>
            )}
            {data.user.admin && (
              <details className="decision-admin-menu">
                <summary aria-label={`Administrar votação ${p.title}`}>
                  <Ellipsis size={19} />
                  <span>Administrar</span>
                </summary>
                <div>
                  {!p.closed && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setError('');
                        setDialog('close');
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
                  />
                </div>
              </details>
            )}
          </div>
        </footer>
      </div>
      {dialog && (
        <Modal
          title={dialog === 'vote' ? 'CONFIRMAR SEU VOTO' : 'ENCERRAR VOTAÇÃO'}
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <form onSubmit={confirm}>
            <p className="form-description">{p.title}</p>
            {dialog === 'vote' ? (
              <>
                <div className="vote-confirmation">{p.options[selection!]}</div>
                {p.options[selection!] === 'Abstenção' && (
                  <p className="form-description">
                    Sua abstenção conta como participação, sem apoiar uma das alternativas.
                  </p>
                )}
                <p className="form-description">
                  O voto é definitivo e não poderá ser alterado.{' '}
                  {p.secret
                    ? 'Os filiados não verão sua escolha.'
                    : 'Seu nome e sua escolha ficarão visíveis aos filiados.'}
                </p>
              </>
            ) : (
              <p className="form-description">
                O encerramento é definitivo. Novos votos serão bloqueados e o resultado será
                divulgado aos filiados.
              </p>
            )}
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Voltar
              </button>
              <SubmitButton busy={busy}>
                {dialog === 'vote' ? 'Confirmar voto' : 'Encerrar e divulgar'}
              </SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </m.article>
  );
}
