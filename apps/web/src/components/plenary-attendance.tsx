'use client';
import { useState, type CSSProperties } from 'react';
import {
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Hand,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { MemberAvatar } from './member-avatar';
import { searchText, type Member } from '@/lib/types';
import type { PlenaryState } from '@/lib/plenary';

export function PlenaryAttendance({
  value,
  members,
  userId,
  busy,
  onUpdate,
}: {
  value: PlenaryState;
  members: Member[];
  userId: string;
  busy: boolean;
  onUpdate: (id: string, patch: { verified?: boolean; excluded?: boolean }) => Promise<boolean>;
}) {
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [visible, setVisible] = useState(24);
  const closed = value.session?.status === 'closed',
    live = value.session?.status === 'open';
  const memberMap = new Map(members.map((m) => [m.id, m])),
    attendeeMap = new Map(value.attendees.map((a) => [a.id, a]));
  const ids = [...new Set([...value.availableIds, ...value.attendees.map((a) => a.id)])];
  const pending = value.attendees.filter((a) => a.active && !a.verified).length;
  const raised = value.attendees.filter((a) => a.active && a.handRaised).length;
  const confirmed = (id: string) =>
    closed
      ? !!attendeeMap.get(id)?.confirmedAt
      : !!attendeeMap.get(id)?.active && !!attendeeMap.get(id)?.verified;
  const filtered = ids
    .filter((id) => {
      const member = memberMap.get(id),
        a = attendeeMap.get(id);
      return (
        searchText(`${member?.name || 'Filiado ANADE'} ${member?.state || ''}`).includes(
          searchText(query),
        ) &&
        (filter === 'all' ||
          (filter === 'pending' && !!a?.active && !a?.verified) ||
          (filter === 'confirmed' && confirmed(id)) ||
          (filter === 'hand' && !!a?.active && !!a?.handRaised))
      );
    })
    .sort(
      (a, b) =>
        Number(!!attendeeMap.get(b)?.active && !!attendeeMap.get(b)?.handRaised) -
          Number(!!attendeeMap.get(a)?.active && !!attendeeMap.get(a)?.handRaised) ||
        Number(!!attendeeMap.get(b)?.active) - Number(!!attendeeMap.get(a)?.active) ||
        (memberMap.get(a)?.name || a).localeCompare(memberMap.get(b)?.name || b, 'pt-BR'),
    );
  const registered = value.attendees.filter(
    (a) => a.confirmedAt && value.session?.electorIds.includes(a.id),
  ).length;
  const shown = closed ? registered : value.present;
  const target = closed ? value.session?.electorIds.length || 0 : value.quorum;
  const percent = target ? Math.min(100, Math.round((shown / target) * 100)) : 0;
  return (
    <section className="panel plenary-presence" id="presenca" aria-label="Lista de presença">
      <header>
        <div>
          <span className="eyebrow">CONTROLE DA SESSÃO</span>
          <h2>Presença e quórum</h2>
        </div>
        <span className="plenary-section-icon">
          <Users size={21} />
        </span>
      </header>
      <div className={`plenary-quorum ${value.quorumReached ? 'is-ready' : ''}`}>
        <div
          className="plenary-quorum-ring"
          style={{ '--quorum-progress': `${percent}%` } as CSSProperties}
          role="progressbar"
          aria-label={closed ? 'Participação registrada' : 'Progresso para o quórum'}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span>
            {percent}
            <small>%</small>
          </span>
        </div>
        <div className="plenary-quorum-copy">
          <b>
            {closed
              ? 'Presenças registradas'
              : value.quorumReached
                ? 'Quórum atingido'
                : 'Aguardando quórum'}
          </b>
          <strong>
            {shown}
            <small> / {value.session?.electorIds.length || 0} eleitores</small>
          </strong>
          <p>
            {closed
              ? 'Histórico de participação na sessão'
              : value.session
                ? `Mínimo de ${value.quorum} presenças confirmadas · ${value.session.quorumPercent}%`
                : 'Defina o eleitorado para calcular o quórum.'}
          </p>
        </div>
        {value.quorumReached && <CheckCheck size={22} />}
      </div>
      <div className="plenary-presence-totals">
        <span>
          <Users size={14} />
          <b>{members.length}</b> filiados no portal
        </span>
        <span>
          <ShieldCheck size={14} />
          <b>{value.session?.electorIds.length || 0}</b> eleitores nesta sessão
        </span>
      </div>
      <p className="plenary-presence-help">
        A presença conta para o quórum após a confirmação da mesa. O eleitorado definido na abertura
        é preservado.
      </p>
      <div className="plenary-roster-tools">
        <label className="plenary-search">
          <Search size={15} />
          <input
            type="search"
            aria-label="Buscar participante"
            placeholder="Buscar filiado por nome ou estado"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(24);
            }}
          />
        </label>
        <div className="plenary-roster-filters" role="group" aria-label="Filtrar participantes">
          {[
            ['all', 'Todos', ids.length],
            ['pending', 'A confirmar', pending],
            ['confirmed', 'Confirmados', ids.filter(confirmed).length],
            ['hand', 'Palavra', raised],
          ].map(([key, label, count]) => (
            <button
              key={key}
              aria-pressed={filter === key}
              onClick={() => {
                setFilter(String(key));
                setVisible(24);
              }}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="plenary-roster" aria-live="polite">
        {filtered.slice(0, visible).map((id) => {
          const member = memberMap.get(id),
            a = attendeeMap.get(id),
            valid = confirmed(id);
          const label = closed
            ? valid
              ? 'Presença registrada'
              : 'Sem presença confirmada'
            : a?.excluded
              ? 'Entrada suspensa'
              : a?.active
                ? a.verified
                  ? 'Presença confirmada'
                  : 'Aguardando confirmação'
                : a?.connected
                  ? 'Conexão expirada'
                  : 'Não conectado';
          return (
            <article
              key={id}
              className={`${valid ? 'is-confirmed' : ''} ${a?.active && a.handRaised ? 'is-requesting' : ''}`}
            >
              <span className="plenary-roster-avatar">
                <MemberAvatar name={member?.name || 'Filiado ANADE'} src={member?.avatarUrl} />
                <i className={a?.active ? 'is-online' : ''} />
              </span>
              <div className="plenary-roster-person">
                <strong>
                  {member?.name || 'Filiado ANADE'}
                  {id === userId && <em>Você</em>}
                </strong>
                <small>
                  {member?.state && `${member.state} · `}
                  {label}
                </small>
              </div>
              <div className="plenary-roster-actions">
                {a?.active && a.handRaised && (
                  <span className="plenary-hand-request">
                    <Hand size={13} />
                    Palavra
                  </span>
                )}
                {valid && <CheckCircle2 size={16} aria-label="Presença confirmada" />}
                {value.canModerate && live && a?.active && (
                  <button
                    className={`button small-button ${a.verified ? 'outline' : 'secondary'}`}
                    disabled={busy}
                    onClick={() => void onUpdate(id, { verified: !a.verified })}
                  >
                    {a.verified ? 'Retirar presença' : 'Confirmar presença'}
                  </button>
                )}
                {value.canManage && live && a && id !== userId && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void onUpdate(id, { excluded: !a.excluded })}
                  >
                    {a.excluded ? 'Permitir entrada' : 'Suspender entrada'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="plenary-roster-empty">
            <Users size={24} />
            <strong>Nenhum participante encontrado</strong>
            <p>
              {ids.length
                ? 'Ajuste os filtros para consultar a lista.'
                : 'A lista de filiados aparecerá após carregar a composição.'}
            </p>
          </div>
        )}
      </div>
      <footer className="plenary-roster-footer">
        <span>
          {Math.min(visible, filtered.length)} de {filtered.length} participantes
        </span>
        {visible < filtered.length && (
          <button className="text-button" onClick={() => setVisible((v) => v + 24)}>
            Mostrar mais
            <ChevronDown size={14} />
          </button>
        )}
      </footer>
    </section>
  );
}
