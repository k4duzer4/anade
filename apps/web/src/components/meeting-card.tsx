'use client';
import { useState } from 'react';
import {
  CalendarDays,
  MapPin,
  Check,
  ArrowRight,
  FileText,
  Users,
  CheckCircle2,
  Video,
  ArrowUpRight,
  Settings2,
  ListOrdered,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { StatusLabel, Modal, ErrorNotice } from './ui';
import { MeetingForm } from './meeting-form';
import { initials, type Meeting } from '@/lib/types';
import { MeetingDate } from './meeting-date';
export function MeetingCard({
  meeting: m,
  compact = false,
}: {
  meeting: Meeting;
  compact?: boolean;
}) {
  const { data, mutate, notify } = usePortal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [editing, setEditing] = useState(false);
  if (!data) return null;
  const future = Date.parse(m.date) > Date.parse(data.serverTime),
    confirmed = m.attendance.includes(data.user.id);
  async function attend() {
    setBusy(true);
    setError('');
    try {
      await mutate(`/api/meetings/${m.id}/attendance`, 'POST', { confirm: !confirmed });
      notify(confirmed ? 'Presença cancelada.' : 'Presença confirmada. Nos vemos lá!');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`meeting-card ${compact ? 'compact' : ''}`}>
      <MeetingDate date={m.date} future={future} />
      <div className="meeting-top">
        <div className="meeting-intro">
          <StatusLabel kind={future ? 'scheduled' : 'completed'} />
          <h3>{m.title}</h3>
          <div className="meeting-meta">
            <span>
              <MapPin size={13} />
              {m.location}
            </span>
          </div>
        </div>
      </div>
      <div className="meeting-agenda">
        <div className="meeting-section-label">
          <span>
            <ListOrdered size={15} />
            Pautas do encontro
          </span>
          <b>{String(m.agenda.length).padStart(2, '0')}</b>
        </div>
        <ol>
          {m.agenda.map((item, i) => (
            <li key={i}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {item}
            </li>
          ))}
        </ol>
      </div>
      <div className="meeting-resources">
        {m.meetUrl ? (
          <a
            className="meeting-resource meet-resource"
            href={m.meetUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="resource-icon">
              <Video size={19} />
            </span>
            <span>
              <strong>{future ? 'Entrar no Google Meet' : 'Abrir chamada no Meet'}</strong>
              <small>Chamada da reunião</small>
            </span>
            <ArrowUpRight size={16} />
          </a>
        ) : (
          <div className="meeting-resource pending-resource">
            <span className="resource-icon">
              <Video size={19} />
            </span>
            <span>
              <strong>Link do Meet pendente</strong>
              <small>A administração vai vincular a chamada.</small>
            </span>
          </div>
        )}
        {m.docsUrl ? (
          <a
            className="meeting-resource docs-resource"
            href={m.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="resource-icon">
              <FileText size={19} />
            </span>
            <span>
              <strong>Abrir ata no Google Docs</strong>
              <small>Documento da reunião</small>
            </span>
            <ArrowUpRight size={16} />
          </a>
        ) : (
          <div className="meeting-resource pending-resource">
            <span className="resource-icon">
              <FileText size={19} />
            </span>
            <span>
              <strong>Ata ainda não vinculada</strong>
              <small>O documento aparecerá aqui.</small>
            </span>
          </div>
        )}
      </div>
      <div className="meeting-actions">
        {future ? (
          <button
            className={`button ${confirmed ? 'outline' : 'primary'} small-button`}
            disabled={busy}
            onClick={attend}
          >
            {confirmed ? <Check size={15} /> : <CalendarDays size={15} />}{' '}
            {confirmed ? 'Presença confirmada' : 'Confirmar presença'}
            {!confirmed && <ArrowRight size={14} />}
          </button>
        ) : (
          <span className="muted">
            <CheckCircle2 size={15} /> Encontro realizado
          </span>
        )}
        <span className="attendance-count">
          {m.attendance.length > 0 ? (
            <span className="attendee-stack" aria-hidden="true">
              {m.attendance.slice(0, 3).map((id) => (
                <span key={id} title={data.members.find((member) => member.id === id)?.name}>
                  {initials(data.members.find((member) => member.id === id)?.name || 'Filiado')}
                </span>
              ))}
            </span>
          ) : (
            <Users size={14} />
          )}
          {m.attendance.length} {m.attendance.length === 1 ? 'confirmação' : 'confirmações'}
        </span>
      </div>
      {confirmed && future && !compact && (
        <p className="field-hint">Clique em “Presença confirmada” para cancelar sua confirmação.</p>
      )}
      {m.minutes && (
        <details className="minutes-details">
          <summary>
            <FileText size={15} /> Notas e encaminhamentos
          </summary>
          <p>{m.minutes}</p>
        </details>
      )}
      {data.user.admin && (
        <button
          className="text-button"
          data-card-action="manage"
          onClick={() => {
            setError('');
            setEditing(true);
          }}
        >
          <Settings2 size={14} />
          Gerenciar reunião
          <ArrowRight size={13} />
        </button>
      )}
      <ErrorNotice message={error} />
      {editing && (
        <Modal title="Gerenciar reunião" onClose={() => setEditing(false)}>
          <MeetingForm
            meeting={m}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}
    </article>
  );
}
