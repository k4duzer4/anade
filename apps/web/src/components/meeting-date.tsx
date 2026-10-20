import { Clock3, Video } from 'lucide-react';
export function MeetingDate({ date, future }: { date: string; future: boolean }) {
  const value = new Date(date);
  const day = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
  const month = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
  const year = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
  const weekday = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
  const hour = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
  return (
    <div className={`meeting-date ${future ? '' : 'past'}`}>
      <div className="date-watermark" aria-hidden="true">
        10
      </div>
      <time
        dateTime={date}
        className="date-main"
        aria-label={new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: 'America/Sao_Paulo',
        }).format(value)}
      >
        <span className="date-weekday">
          <i />
          {weekday}
        </span>
        <span className="date-figure">
          <strong>{day}</strong>
          <span>
            <b>{month}</b>
            <small>{year}</small>
          </span>
        </span>
      </time>
      <div className="date-perforation" aria-hidden="true" />
      <div className="date-hour">
        <span className="date-hour-label">
          <Clock3 size={13} />
          {future ? 'INÍCIO' : 'REALIZADO ÀS'}
        </span>
        <strong>
          {hour}
          <small>h</small>
        </strong>
        <span className="date-timezone">HORÁRIO DE BRASÍLIA</span>
        <span className="date-online">
          <Video size={12} />
          Reunião online
        </span>
      </div>
    </div>
  );
}
