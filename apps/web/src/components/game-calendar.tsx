'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Clock3, Download, Pencil, Plus } from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, Empty, ErrorNotice, Badge } from './ui';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import { OrganizationForm, OrganizationLoading, useOrganization } from './organization-ui';
import { eventNames, options, type GameCalendar, type GameEvent } from '@/lib/organization';
import { formatDate } from '@/lib/types';
import { SeasonCountdown } from './season-countdown';
import { DeleteAction } from './delete-action';
export function GameCalendarPanel({ compact = false }: { compact?: boolean }) {
  const { data, mutate } = usePortal();
  const [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [importing, setImporting] = useState(false),
    [showPast, setShowPast] = useState(false);
  const [dialog, setDialog] = useState<{ type: 'config' | 'event'; item?: GameEvent } | null>(null);
  const { value, error: loadError } = useOrganization<GameCalendar>(
    '/api/legado/calendar',
    `${version}:${data?.serverTime}`,
  );
  if (!data) return null;
  const close = () => setDialog(null),
    saved = () => {
      close();
      setVersion((v) => v + 1);
    };
  const upcoming = value
    ? [...value.milestones, ...value.events]
        .filter(
          (e) =>
            showPast ||
            (Date.parse(e.date) >= Date.parse(value.serverTime) && e.status !== 'concluido'),
        )
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  if (compact && value?.config.startDate) return <SeasonCountdown calendar={value} compact />;
  if (compact)
    return (
      <section className="panel org-calendar-mini">
        <div>
          <span className="org-symbol">
            <CalendarDays size={21} />
          </span>
          <span>
            <small className="eyebrow">CALENDÁRIO DO LEGADO</small>
            <strong>
              {value?.day ? `Dia ${value.day} · ${value.gameDate}` : 'Acompanhe o tempo do jogo'}
            </strong>
          </span>
        </div>
        {value && (
          <p>
            {value.day === null
              ? 'A administração ainda precisa confirmar o início da temporada.'
              : `Próximo tick: ${formatDate(value.nextTick)} · Brasília`}
          </p>
        )}
        <Link href="/calendario" className="text-button">
          Ver calendário
          <ArrowUpRight size={14} />
        </Link>
        <ErrorNotice message={loadError} />
      </section>
    );
  return (
    <div className="refresh-page org-page">
      <PageHeading
        eyebrow="TEMPO DO JOGO · BRASÍLIA"
        title="O próximo passo tem hora."
        description="Datas reais, ritmo da temporada e compromissos do Legado, no mesmo calendário."
        action={
          data.user.admin && (
            <div className="org-actions">
              <button className="button secondary" onClick={() => setDialog({ type: 'config' })}>
                Configurar temporada
              </button>
              <button className="button primary" onClick={() => setDialog({ type: 'event' })}>
                <Plus size={16} />
                Adicionar evento
              </button>
            </div>
          )
        }
      />
      <ErrorNotice message={loadError || error} />
      {!value && <OrganizationLoading />}
      {value && (
        <>
          {value.config.startDate ? (
            <SeasonCountdown calendar={value} />
          ) : (
            <>
              <div className="org-calendar-stats">
                <article className="panel">
                  <span className="eyebrow">HOJE NO MUNDO REAL</span>
                  <strong>
                    {new Intl.DateTimeFormat('pt-BR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'America/Sao_Paulo',
                    }).format(new Date(value.serverTime))}
                  </strong>
                  <small>Horário de Brasília</small>
                </article>
                <article className="panel">
                  <span className="eyebrow">DIA DO JOGO</span>
                  <strong>
                    {value.day === null
                      ? 'A configurar'
                      : value.day < 1
                        ? 'Em breve'
                        : value.day > (value.config.duration || 90)
                          ? 'Encerrada'
                          : `Dia ${value.day}`}
                  </strong>
                  <small>{value.gameDate}</small>
                </article>
                <article className="panel">
                  <span className="eyebrow">PRÓXIMO TICK PREVISTO</span>
                  <strong>{formatDate(value.nextTick)}</strong>
                  <small>Tick diário às 8h · referência da wiki</small>
                </article>
              </div>
            </>
          )}
          <section className="org-calendar-source">
            <Clock3 size={20} />
            <div>
              <strong>Calendário de referência</strong>
              <p>
                Marcos calculados pela wiki a partir do início confirmado pela administração. Pausas
                e mudanças oficiais precisam ser atualizadas aqui. A data do jogo após o dia 12
                avança dois meses por tick.
              </p>
              <a href={value.source} target="_blank" rel="noopener noreferrer">
                Conferir temporada no Legado
                <ArrowUpRight size={13} />
              </a>{' '}
              ·{' '}
              <a href={value.wiki} target="_blank" rel="noopener noreferrer">
                Regras de tempo
              </a>
            </div>
            {data.user.admin && (
              <button
                disabled={importing}
                className="button secondary"
                onClick={async () => {
                  setImporting(true);
                  setError('');
                  try {
                    await mutate('/api/legado/calendar/import', 'POST', {});
                    setVersion((v) => v + 1);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                <Download size={15} />
                {importing ? 'Consultando…' : 'Consultar data pública'}
              </button>
            )}
          </section>
          <div className="org-toolbar">
            <h2>Marcos e compromissos</h2>
            <button className="button secondary" onClick={() => setShowPast(!showPast)}>
              {showPast ? 'Ver próximos' : 'Incluir anteriores e concluídos'}
            </button>
          </div>
          <div className="org-calendar-events">
            {upcoming.map((e) => (
              <article className="panel" key={e.id}>
                <div className="org-event-date">
                  <strong>
                    {new Intl.DateTimeFormat('pt-BR', {
                      day: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    }).format(new Date(e.date))}
                  </strong>
                  <span>
                    {new Intl.DateTimeFormat('pt-BR', {
                      month: 'short',
                      timeZone: 'America/Sao_Paulo',
                    }).format(new Date(e.date))}
                  </span>
                </div>
                <div>
                  <span className="eyebrow">
                    {eventNames[e.type] || 'Temporada'} ·{' '}
                    {e.estimated
                      ? 'Previsão da wiki'
                      : e.status === 'concluido'
                        ? 'Concluído'
                        : 'Registrado pela administração'}
                  </span>
                  <h3>{e.title}</h3>
                  <p>
                    {formatDate(e.date, true)}
                    {e.body ? ` · ${e.body}` : ''}
                  </p>
                </div>
                {data.user.admin && !e.estimated && (
                  <button
                    className="icon-button"
                    aria-label={`Editar ${e.title}`}
                    onClick={() => setDialog({ type: 'event', item: e })}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                {e.estimated && <Badge tone="gray">Previsto</Badge>}
              </article>
            ))}
          </div>
          {upcoming.length === 0 && (
            <section className="panel">
              <Empty>
                <CalendarDays size={26} />
                <h3>
                  {value.day === null
                    ? 'Confirme o início da temporada.'
                    : 'Nenhum marco neste período.'}
                </h3>
                <p>A administração pode registrar eventos confirmados e efeitos pendentes.</p>
              </Empty>
            </section>
          )}
        </>
      )}
      {dialog?.type === 'config' && (
        <Modal title="Configurar temporada" onClose={close}>
          <OrganizationForm
            url="/api/legado/calendar"
            method="PUT"
            onSaved={saved}
            onCancel={close}
            transform={(v) => ({ ...v, duration: Number(v.duration) })}
          >
            <p className="form-description">
              Confirme a data na página oficial da temporada. O dia 1 começa às 8h dessa data. Se a
              página exigir login, preencha manualmente.
            </p>
            <label className="field">
              Data real de início
              <DateTimePicker
                name="startDate"
                label="Início da temporada"
                dateOnly
                defaultValue={value?.config.startDate}
                required
              />
            </label>
            <label className="field">
              Duração em dias reais
              <input
                name="duration"
                type="number"
                min={1}
                max={365}
                defaultValue={value?.config.duration || 90}
                required
              />
            </label>
          </OrganizationForm>
        </Modal>
      )}
      {dialog?.type === 'event' && (
        <Modal title={dialog.item ? 'Editar evento' : 'Novo evento do calendário'} onClose={close}>
          <OrganizationForm
            url={`/api/legado/events${dialog.item ? `/${dialog.item.id}` : ''}`}
            method={dialog.item ? 'PUT' : 'POST'}
            onSaved={saved}
            onCancel={close}
            transform={(v) => ({ ...v, date: new Date(String(v.date)).toISOString() })}
          >
            <div className="form-grid">
              <label className="field full">
                Título
                <input name="title" maxLength={200} required defaultValue={dialog.item?.title} />
              </label>
              <label className="field">
                Tipo
                <Select
                  name="type"
                  aria-label="Tipo de evento"
                  options={options(eventNames)}
                  defaultValue={dialog.item?.type || 'efeito'}
                />
              </label>
              <label className="field">
                Situação
                <Select
                  name="status"
                  aria-label="Situação do evento"
                  options={[
                    { value: 'pendente', label: 'Pendente' },
                    { value: 'concluido', label: 'Concluído' },
                  ]}
                  defaultValue={dialog.item?.status || 'pendente'}
                />
              </label>
              <label className="field full">
                Data e horário
                <DateTimePicker
                  name="date"
                  label="Data do evento"
                  defaultValue={
                    dialog.item?.date
                      ? new Date(
                          Date.parse(dialog.item.date) -
                            new Date(dialog.item.date).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : undefined
                  }
                  required
                />
                <small>Horário local do dispositivo; exibição em Brasília.</small>
              </label>
              <label className="field full">
                Detalhes
                <textarea name="body" rows={3} maxLength={2000} defaultValue={dialog.item?.body} />
              </label>
            </div>
          </OrganizationForm>
          {dialog.item && (
            <div className="content-danger-zone">
              <DeleteAction
                url={`/api/legado/events/${dialog.item.id}`}
                title={dialog.item.title}
                label="Excluir evento"
                description="O evento registrado pela administração será removido do calendário do portal."
                onDeleted={saved}
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
