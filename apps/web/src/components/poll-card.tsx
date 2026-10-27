'use client';
import { useState } from 'react';
import {
  LockKeyhole,
  Vote,
  CheckCircle2,
  Clock3,
  ArrowRight,
  Users,
  MinusCircle,
  Check,
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
  const [selection, setSelection] = useState<number | null>(null),
    [expanded, setExpanded] = useState(!compact),
    [dialog, setDialog] = useState<'vote' | 'close' | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!data) return null;
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
      className="panel poll-card refresh-poll"
      id={`votacao-${p.id}`}
      transition={{ duration: 0.3 }}
    >
      <div className="poll-card-top">
        <span className={`poll-stage ${p.closed ? 'is-closed' : ''}`}>
          <span />
          {p.closed
            ? 'Encerrada'
            : p.hasVoted
              ? 'Voto registrado'
              : p.canVote === false
                ? p.governance && Date.parse(p.governance.opensAt) > Date.parse(data.serverTime)
                  ? 'Abertura programada'
                  : p.governance?.plenaryMeetingId
                    ? 'Plenário virtual'
                    : 'Eleitorado restrito'
                : 'Aguardando seu voto'}
        </span>
        <span className="poll-privacy">
          {p.secret ? <LockKeyhole size={14} /> : <Vote size={14} />}Voto{' '}
          {p.secret ? 'secreto' : 'nominal'}
        </span>
      </div>
      <h2>{p.title}</h2>
      <div className="poll-scope-summary">
        <span>
          <Users size={14} />
          {p.governance?.groupName || 'Todos os filiados'}
        </span>
        {p.governance && <span>Quórum de {p.governance.quorumPercent}%</span>}
      </div>
      {compact && !expanded && (
        <div className="poll-preview">
          <p>
            {p.description
              ? p.description.slice(0, 160) + (p.description.length > 160 ? '…' : '')
              : 'Consulte as alternativas e as regras desta decisão.'}
          </p>
          <div className="poll-preview-deadline">
            <Clock3 size={14} />
            <span>
              {p.closed ? 'Encerrada em' : 'Prazo para votar'}
              <strong>{formatDate(p.deadline)}</strong>
            </span>
          </div>
          <footer>
            <span>
              {p.total} {p.total === 1 ? 'participação' : 'participações'}
            </span>
            <button className="button primary" onClick={() => setExpanded(true)}>
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
      )}
      <div className="poll-detail-body" hidden={compact && !expanded}>
        {p.governance && (
          <details className="org-poll-rules">
            <summary>
              {p.governance.groupName} · {p.governance.electorIds.length}{' '}
              {p.governance.electorIds.length === 1 ? 'eleitor' : 'eleitores'} · quórum{' '}
              {p.governance.quorumPercent}%
            </summary>
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
            <p>Abertura: {formatDate(p.governance.opensAt)}. Eleitores definidos na publicação:</p>
            {p.governance.requiredOffice && (
              <p>
                Cargo obrigatório ao votar: {p.governance.requiredOffice}, confirmado pela
                administração. A perda do cargo retira a autorização para novos votos.
              </p>
            )}
            <p>
              {p.governance.electorIds
                .map((id) => data.members.find((m) => m.id === id)?.name || 'Filiado sem ficha')
                .join(', ')}
              .
            </p>
          </details>
        )}
        {p.outcome && (
          <p className="org-outcome" role="status">
            <CheckCircle2 size={17} />
            {p.outcome.winner === null
              ? p.outcome.reason
              : `${p.options[p.outcome.winner]} · ${p.outcome.reason}`}{' '}
            · Quórum: {p.total}/{p.outcome.quorum} participações necessárias.
          </p>
        )}
        {p.description.length > 220 ? (
          <details className="poll-context">
            <summary>Ler contexto da votação</summary>
            <p>{p.description}</p>
          </details>
        ) : (
          p.description && <p className="poll-description">{p.description}</p>
        )}
        <div className="poll-deadline">
          <Clock3 size={14} />
          {p.closed ? 'Encerramento' : 'Vote até'} {formatDate(p.deadline)}
        </div>
        {!p.closed && !p.hasVoted && p.canVote !== false && (
          <div className="vote-steps" aria-label="Etapas do voto">
            <span className="is-current">
              <b>1</b> Escolha
            </span>
            <i />
            <span className={selection !== null ? 'is-current' : ''}>
              <b>2</b> Revise e confirme
            </span>
          </div>
        )}
        {!p.closed && !p.hasVoted && p.canVote !== false && (
          <fieldset className="poll-options">
            <legend>Escolha uma alternativa</legend>
            {p.options.map((o, i) => (
              <label
                key={i}
                className={`${selection === i ? 'selected' : ''} ${o === 'Abstenção' ? 'abstention-option' : ''}`}
              >
                <input
                  type="radio"
                  name={`poll-${p.id}`}
                  checked={selection === i}
                  onChange={() => setSelection(i)}
                />
                <span className="option-label">
                  <small aria-hidden="true">
                    {o === 'Abstenção' ? '—' : String.fromCharCode(65 + i)}
                  </small>
                  {o}
                </span>
                {o === 'Abstenção' && <MinusCircle size={16} />}{' '}
                <span
                  className={`choice-indicator ${selection === i ? 'is-selected' : ''}`}
                  aria-hidden="true"
                >
                  {selection === i && <Check size={14} />}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {p.hasVoted && (
          <p className="voted-notice">
            <CheckCircle2 size={17} />
            Seu voto foi registrado{p.myVote !== null ? `: ${p.options[p.myVote]}` : '.'}
          </p>
        )}
        {p.counts && (
          <div className="poll-results">
            {p.options.map((option, i) => (
              <div key={i} className={option === 'Abstenção' ? 'abstention-result' : ''}>
                <div>
                  <span>{option}</span>
                  <b>
                    {p.total ? Math.round((p.counts![i] / p.total) * 100) : 0}%{' '}
                    <small>({p.counts![i]})</small>
                  </b>
                </div>
                <div
                  className="result-track"
                  role="progressbar"
                  aria-valuenow={p.counts![i]}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(p.total, 1)}
                  aria-label={`Votos em ${option}`}
                >
                  <m.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.total ? (p.counts![i] / p.total) * 100 : 0}%` }}
                    transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {p.counts && (
          <div className="participation-summary">
            <span>
              <b>{p.validVotes}</b> {p.validVotes === 1 ? 'voto válido' : 'votos válidos'}
            </span>
            <span>
              <b>{p.abstentions}</b> {p.abstentions === 1 ? 'abstenção' : 'abstenções'}
            </span>
            <small>Percentuais sobre toda a participação.</small>
          </div>
        )}
        {p.secret && !p.closed && (
          <p className="privacy-note">
            <LockKeyhole size={13} />O resultado será divulgado após o encerramento.
          </p>
        )}
        {p.ballots && p.ballots.length > 0 && (
          <details className="ballots">
            <summary>Consultar votos nominais</summary>
            {p.ballots.map((b) => (
              <p key={b.id}>
                <strong>
                  {data.members.find((m) => m.id === b.id)?.name || 'Filiado sem ficha'}
                </strong>
                <span>{p.options[b.option]}</span>
              </p>
            ))}
          </details>
        )}
        <div className="poll-card-bottom">
          {p.governance?.plenaryMeetingId && p.canVote === false && !p.closed && !p.hasVoted && (
            <a className="text-button" href={`/plenario/${p.governance.plenaryMeetingId}`}>
              Entrar no plenário para votar
              <ArrowRight size={14} />
            </a>
          )}
          <span>
            <Users size={14} />
            {p.total} voto{p.total === 1 ? '' : 's'} registrado{p.total === 1 ? '' : 's'}
          </span>
          {!p.closed && !p.hasVoted && p.canVote !== false && (
            <button
              className="button primary small-button"
              disabled={selection === null}
              onClick={() => {
                setError('');
                setDialog('vote');
              }}
            >
              Revisar voto
              <ArrowRight size={14} />
            </button>
          )}
        </div>
        {!p.closed && !p.hasVoted && selection !== null && (
          <p className="vote-selection-note" role="status">
            Escolha selecionada. Seu voto só será enviado após a confirmação.
          </p>
        )}
        {data.user.admin && !p.closed && (
          <button
            className="text-button danger close-poll"
            onClick={() => {
              setError('');
              setDialog('close');
            }}
          >
            Encerrar votação
          </button>
        )}
        {data.user.admin && (
          <div className="content-actions poll-management">
            <DeleteAction
              url={`/api/polls/${p.id}`}
              title={p.title}
              label="Excluir votação"
              description={`A votação, alternativas, resultados e ${p.total} voto(s) serão apagados. Se veio de uma proposta, a proposta permanece e poderá ser encaminhada novamente.`}
              requireName
            />
          </div>
        )}
        {compact && expanded && (
          <button
            className="text-button poll-collapse"
            disabled={busy || !!dialog}
            onClick={() => setExpanded(false)}
          >
            Recolher detalhes
          </button>
        )}
      </div>
      {dialog && (
        <Modal
          title={dialog === 'vote' ? 'CONFIRMAR SEU VOTO' : 'ENCERRAR VOTAÇÃO'}
          onClose={() => setDialog(null)}
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
              <button type="button" className="button outline" onClick={() => setDialog(null)}>
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
