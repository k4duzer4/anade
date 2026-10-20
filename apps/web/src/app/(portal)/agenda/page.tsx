'use client';
import { useState } from 'react';
import { Plus, CalendarDays } from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Modal, Empty } from '@/components/ui';
import { MeetingCard } from '@/components/meeting-card';
import { MeetingForm } from '@/components/meeting-form';
export default function Agenda() {
  const { data } = usePortal();
  const [filter, setFilter] = useState('upcoming'),
    [open, setOpen] = useState(false);
  if (!data) return null;
  const list = data.meetings
    .filter((m) => Date.parse(m.date) > Date.parse(data.serverTime) === (filter === 'upcoming'))
    .sort((a, b) =>
      filter === 'upcoming'
        ? Date.parse(a.date) - Date.parse(b.date)
        : Date.parse(b.date) - Date.parse(a.date),
    );
  return (
    <>
      <PageHeading
        title="AGENDA DO PARTIDO"
        description="Encontros para debater ideias, alinhar caminhos e construir juntos."
        action={
          data.user.admin && (
            <button
              className="button primary"
              onClick={() => {
                setOpen(true);
              }}
            >
              <Plus size={17} /> Nova reunião
            </button>
          )
        }
      />
      <div className="section-toolbar">
        <div className="tabs" aria-label="Filtrar reuniões">
          {[
            ['upcoming', 'Próximos encontros'],
            ['past', 'Reuniões realizadas'],
          ].map(([id, title]) => (
            <button
              key={id}
              className={filter === id ? 'active' : ''}
              onClick={() => setFilter(id)}
            >
              {title}
            </button>
          ))}
        </div>
        <span className="toolbar-hint">
          <CalendarDays size={14} /> Horários de Brasília
        </span>
      </div>
      <div className="meetings-grid">
        {list.length ? (
          list.map((m) => (
            <section className="panel" key={m.id}>
              <MeetingCard meeting={m} />
            </section>
          ))
        ) : (
          <section className="panel">
            <Empty>
              {filter === 'upcoming'
                ? 'Nenhum encontro agendado.'
                : 'As reuniões realizadas aparecerão aqui.'}
            </Empty>
          </section>
        )}
      </div>
      {open && (
        <Modal title="AGENDAR REUNIÃO" onClose={() => setOpen(false)}>
          <MeetingForm onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
