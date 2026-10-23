'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import type { Meeting } from '@/lib/types';

export function meetingDay(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function AgendaCalendar({
  meetings,
  now,
  selected,
  onSelect,
}: {
  meetings: Meeting[];
  now: string;
  selected: string;
  onSelect: (day: string) => void;
}) {
  const today = meetingDay(now);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const first = new Date(`${month}-01T12:00:00Z`);
  const year = first.getUTCFullYear(),
    monthIndex = first.getUTCMonth();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(first);
  const counts = new Map<string, number>();
  meetings.forEach((meeting) => {
    const day = meetingDay(meeting.date);
    counts.set(day, (counts.get(day) || 0) + 1);
  });
  function move(offset: number) {
    setMonth(new Date(Date.UTC(year, monthIndex + offset, 1, 12)).toISOString().slice(0, 7));
    onSelect('');
  }
  return (
    <aside className="agenda-calendar" aria-label="Calendário de reuniões">
      <div className="calendar-caption">
        <CalendarDays size={18} />
        <span>Sua agenda, em um olhar</span>
      </div>
      <header>
        <h2 aria-live="polite">{label}</h2>
        <div>
          <button type="button" onClick={() => move(-1)} aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Próximo mês">
            <ChevronRight size={18} />
          </button>
        </div>
      </header>
      <div className="agenda-calendar-grid">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
          <span className="calendar-weekday" key={`weekday-${i}`} aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, '0')}`;
          const count = counts.get(day) || 0;
          const full = new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'full',
            timeZone: 'UTC',
          }).format(new Date(`${day}T12:00:00Z`));
          return (
            <button
              type="button"
              key={day}
              aria-label={`${full} · ${count} ${count === 1 ? 'encontro' : 'encontros'}`}
              aria-pressed={selected === day}
              aria-current={day === today ? 'date' : undefined}
              data-events={count > 0}
              onClick={() => onSelect(selected === day ? '' : day)}
            >
              {i + 1}
              <i aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <footer>
        <span>
          <i /> Dia com reunião
        </span>
        <button
          type="button"
          onClick={() => {
            setMonth(today.slice(0, 7));
            onSelect('');
          }}
        >
          Este mês
        </button>
      </footer>
      {selected && (
        <button className="calendar-clear" type="button" onClick={() => onSelect('')}>
          <X size={14} /> Ver todos os dias
        </button>
      )}
      <p>Horários de Brasília. O calendário acompanha os filtros da agenda.</p>
    </aside>
  );
}
