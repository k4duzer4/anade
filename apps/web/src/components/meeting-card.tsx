'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  ListOrdered,
  LoaderCircle,
  MapPin,
  Settings2,
  Users,
  Video,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { ErrorNotice, Modal } from './ui';
import { MeetingForm } from './meeting-form';
import { MemberAvatar } from './member-avatar';
import { AgendaConversation } from './agenda-conversation';
import { DeleteAction } from './delete-action';
import type { Meeting } from '@/lib/types';

export function MeetingCard({ meeting, compact = false }: { meeting: Meeting; compact?: boolean }) {
  const { data, mutate, notify } = usePortal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  if (!data) return null;
  const future = Date.parse(meeting.date) > Date.parse(data.serverTime);
  const confirmed = meeting.attendance.includes(data.user.id);
  const date = new Date(meeting.date);
  const moment = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'America/Sao_Paulo' }).format(date);
  async function attend() {
    setBusy(true);
    setError('');
    try {
      await mutate(`/api/meetings/${meeting.id}/attendance`, 'POST', { confirm: !confirmed });
      notify(confirmed ? 'Presença cancelada.' : 'Presença confirmada. Nos vemos lá!');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`event-card ${compact ? 'is-compact' : ''}`} id={`encontro-${meeting.id}`}>
      <header className="event-heading">
        <time
          className="event-date"
          dateTime={meeting.date}
          aria-label={moment({ dateStyle: 'full', timeStyle: 'short' })}
        >
          <span>{moment({ month: 'short' }).replace('.', '')}</span>
          <strong>{moment({ day: '2-digit' })}</strong>
          <small>{moment({ weekday: 'short' }).replace('.', '')}</small>
        </time>
        <div className="event-title">
          <div className="event-kicker">
            <span className={future ? 'is-upcoming' : ''}>
              {future ? 'Próximo encontro' : 'Realizada'}
            </span>
            <span>{moment({ hour: '2-digit', minute: '2-digit' })} · Brasília</span>
          </div>
          <h3>{meeting.title}</h3>
          <p>
            <MapPin size={13} />
            {meeting.location}
          </p>
        </div>
        {data.user.admin && (
          <button
            type="button"
            className="event-manage"
            aria-label={`Gerenciar reunião: ${meeting.title}`}
            title="Gerenciar reunião"
            onClick={() => {
              setError('');
              setEditing(true);
            }}
          >
            <Settings2 size={16} />
          </button>
        )}
      </header>
      <div className="event-resources">
        {meeting.location === 'Plenário virtual' ? (
          <a className="button primary" href={`/plenario/${meeting.id}`}>
            <Users size={16} />
            Abrir plenário
            <ArrowUpRight size={13} />
          </a>
        ) : meeting.meetUrl ? (
          <a
            className={`button ${future ? 'primary' : 'secondary'}`}
            href={meeting.meetUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Video size={16} />
            {future ? 'Entrar no Meet' : 'Abrir Meet'}
            <ArrowUpRight size={13} />
          </a>
        ) : (
          <span className="event-pending">
            <Video size={15} /> Meet ainda não vinculado
          </span>
        )}
        {meeting.docsUrl ? (
          <a
            className="event-docs"
            href={meeting.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText size={15} />
            Ver ata
            <ArrowUpRight size={13} />
          </a>
        ) : (
          <span className="event-pending">
            <FileText size={15} /> Ata pendente
          </span>
        )}
      </div>
      <details className="event-details">
        <summary>
          <ListOrdered size={15} />
          <strong>Pautas do encontro</strong>
          <span>
            {meeting.agenda.length} assunto{meeting.agenda.length === 1 ? '' : 's'}
          </span>
          <ChevronDown size={15} />
        </summary>
        <ol>
          {meeting.agenda.map((item, index) => (
            <li key={index}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div className="event-topic">
                <p>{item}</p>
                <div className="content-actions">
                  <AgendaConversation kind="meeting" id={meeting.id} title={item} topic={item} />
                  {data.user.admin && (
                    <DeleteAction
                      url={`/api/meetings/${meeting.id}/agenda/${index}?topic=${encodeURIComponent(item)}`}
                      title={item}
                      label="Excluir pauta"
                      description="Este assunto e os comentários dele serão removidos da reunião. O encontro precisa manter ao menos uma pauta."
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </details>
      {meeting.minutes && (
        <details className="event-details event-notes">
          <summary>
            <FileText size={15} />
            <strong>Notas e encaminhamentos</strong>
            <ChevronDown size={15} />
          </summary>
          <p>{meeting.minutes}</p>
        </details>
      )}
      <footer className="event-footer">
        {future ? (
          <button
            type="button"
            className={`event-attend ${confirmed ? 'is-confirmed' : ''}`}
            disabled={busy}
            aria-pressed={confirmed}
            onClick={() => void attend()}
          >
            {busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : confirmed ? (
              <Check size={15} />
            ) : (
              <CalendarDays size={15} />
            )}{' '}
            {confirmed ? 'Presença confirmada' : 'Confirmar presença'}
          </button>
        ) : (
          <span className="event-finished">
            <Check size={14} />
            Encontro realizado
          </span>
        )}
        <div className="event-attendance">
          {meeting.attendance.length ? (
            <span className="event-avatars">
              {meeting.attendance.slice(0, 3).map((id) => {
                const person = data.members.find((member) => member.id === id);
                return (
                  <MemberAvatar
                    key={id}
                    className="event-avatar"
                    name={person?.name || 'Filiado'}
                    src={person?.avatarUrl}
                  />
                );
              })}
            </span>
          ) : (
            <Users size={14} />
          )}
          <span>
            {meeting.attendance.length} confirmaç{meeting.attendance.length === 1 ? 'ão' : 'ões'}
          </span>
        </div>
      </footer>
      {confirmed && future && (
        <p className="event-cancel-hint">Clique na confirmação para cancelar sua presença.</p>
      )}
      <ErrorNotice message={error} />
      {editing && (
        <Modal title="Gerenciar reunião" onClose={() => setEditing(false)}>
          <MeetingForm
            meeting={meeting}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
          <div className="content-danger-zone">
            <DeleteAction
              url={`/api/meetings/${meeting.id}`}
              title={meeting.title}
              label="Excluir reunião"
              description="A reunião, suas pautas, comentários, notas da ata e confirmações de presença serão excluídos do portal. Os documentos no Google Docs e o Meet continuam nos serviços de origem."
              requireName
            />
          </div>
        </Modal>
      )}
    </article>
  );
}
