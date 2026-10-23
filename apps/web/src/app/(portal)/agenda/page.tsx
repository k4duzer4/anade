'use client';
import { useState } from 'react';
import { Plus, CalendarDays } from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Modal, Empty } from '@/components/ui';
import { MeetingCard } from '@/components/meeting-card';
import { MeetingForm } from '@/components/meeting-form';
import { SearchBox, ViewFilters } from '@/components/portal-tools';
import { searchText } from '@/lib/types';
export default function Agenda() {
  const { data } = usePortal();
  const [filter, setFilter] = useState('upcoming'),
    [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  if (!data) return null;
  const upcoming = data.meetings.filter((m) => Date.parse(m.date) > Date.parse(data.serverTime));
  const confirmed = upcoming.filter((m) => m.attendance.includes(data.user.id));
  const list = data.meetings
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
      <div className="refresh-toolbar">
        <ViewFilters
          value={filter}
          onChange={setFilter}
          label="Filtrar reuniões"
          options={[
            { value: 'upcoming', label: 'Próximas', count: upcoming.length },
            { value: 'confirmed', label: 'Minha presença', count: confirmed.length },
            { value: 'past', label: 'Realizadas', count: data.meetings.length - upcoming.length },
          ]}
        />
        <SearchBox value={search} onChange={setSearch} label="Buscar reunião ou pauta" />
      </div>
      <div className="refresh-list-caption">
        <span>
          {list.length} encontro{list.length === 1 ? '' : 's'}
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
                {search
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
              {(search || filter === 'confirmed') && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setSearch('');
                    setFilter('upcoming');
                  }}
                >
                  Ver próximos encontros
                </button>
              )}
            </Empty>
          </section>
        )}
      </div>
      {open && (
        <Modal title="AGENDAR REUNIÃO" onClose={() => setOpen(false)}>
          <MeetingForm onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
