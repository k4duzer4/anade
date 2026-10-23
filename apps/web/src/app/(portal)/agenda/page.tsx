'use client';
import { useState } from 'react';
import { Plus, CalendarDays, CheckCheck, History } from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Modal, Empty } from '@/components/ui';
import { MeetingCard } from '@/components/meeting-card';
import { MeetingForm } from '@/components/meeting-form';
import { SearchBox, ViewFilters, PagePulse } from '@/components/portal-tools';
import { AgendaCalendar, meetingDay } from '@/components/agenda-calendar';
import { searchText } from '@/lib/types';
export default function Agenda() {
  const { data } = usePortal();
  const [filter, setFilter] = useState('upcoming'),
    [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [day, setDay] = useState('');
  if (!data) return null;
  const upcoming = data.meetings.filter((m) => Date.parse(m.date) > Date.parse(data.serverTime));
  const confirmed = upcoming.filter((m) => m.attendance.includes(data.user.id));
  const filtered = data.meetings
    .filter((m) =>
      filter === 'confirmed'
        ? confirmed.some((item) => item.id === m.id)
        : Date.parse(m.date) > Date.parse(data.serverTime) === (filter === 'upcoming'),
    )
    .filter((m) =>
      searchText([m.title, m.location, ...m.agenda].join(' ')).includes(searchText(search)),
    )
    .sort((a, b) =>
      filter !== 'past'
        ? Date.parse(a.date) - Date.parse(b.date)
        : Date.parse(b.date) - Date.parse(a.date),
    );
  const list = filtered.filter((m) => !day || meetingDay(m.date) === day);
  return (
    <div className="refresh-page agenda-refresh">
      <PageHeading
        eyebrow="ENCONTROS · ANADE"
        title="Vamos nos encontrar."
        description="Reuniões, pautas e decisões. Tudo pronto para participar."
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
      <PagePulse
        items={[
          { label: 'próximos encontros', value: upcoming.length, Icon: CalendarDays },
          { label: 'presenças confirmadas', value: confirmed.length, Icon: CheckCheck },
          {
            label: 'encontros realizados',
            value: data.meetings.length - upcoming.length,
            Icon: History,
          },
        ]}
      />
      <div className="refresh-toolbar">
        <ViewFilters
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setDay('');
          }}
          label="Filtrar reuniões"
          options={[
            { value: 'upcoming', label: 'Próximas', count: upcoming.length },
            { value: 'confirmed', label: 'Minha presença', count: confirmed.length },
            { value: 'past', label: 'Realizadas', count: data.meetings.length - upcoming.length },
          ]}
        />
        <SearchBox value={search} onChange={setSearch} label="Buscar reunião ou pauta" />
      </div>
      <div className="agenda-layout">
        <AgendaCalendar
          meetings={filtered}
          now={data.serverTime}
          selected={day}
          onSelect={setDay}
        />
        <div className="agenda-results">
          <div className="refresh-list-caption" aria-live="polite">
            <span>
              {list.length} encontro{list.length === 1 ? '' : 's'}
              {day ? ` em ${day.split('-').reverse().join('/')}` : ''}
            </span>
            <span>
              <CalendarDays size={13} /> Horários de Brasília
            </span>
          </div>
          <div className="event-grid">
            {list.length ? (
              list.map((m) => <MeetingCard key={m.id} meeting={m} />)
            ) : (
              <section className="panel">
                <Empty>
                  <CalendarDays size={27} />
                  <h3>
                    {day
                      ? 'Nenhum encontro neste dia.'
                      : search
                        ? 'Nenhum encontro encontrado.'
                        : filter === 'confirmed'
                          ? 'Sua agenda começa com uma confirmação.'
                          : filter === 'upcoming'
                            ? 'Novos encontros virão por aqui.'
                            : 'Ainda não há reuniões realizadas.'}
                  </h3>
                  <p>
                    {search
                      ? 'Experimente outra busca.'
                      : filter === 'confirmed'
                        ? 'Confirme sua presença em um próximo encontro.'
                        : 'Acompanhe as próximas atividades da ANADE.'}
                  </p>
                  {(search || day || filter === 'confirmed') && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSearch('');
                        setFilter('upcoming');
                        setDay('');
                      }}
                    >
                      Ver próximos encontros
                    </button>
                  )}
                </Empty>
              </section>
            )}
          </div>
        </div>
      </div>
      {open && (
        <Modal title="AGENDAR REUNIÃO" onClose={() => setOpen(false)}>
          <MeetingForm onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
