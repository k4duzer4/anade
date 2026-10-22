'use client';

import { useContext, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from 'lucide-react';
import { FloatingLayerContext } from './floating-ui';
import { Select } from './select';

const pad = (value: number) => String(value).padStart(2, '0');
function datePart(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function parseDay(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}
const months = Array.from({ length: 12 }, (_, month) => ({
  value: String(month),
  label: new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, month, 1)),
}));

export function DateTimePicker({
  name,
  defaultValue = '',
  required = false,
  disabled = false,
  label,
  dateOnly = false,
  value: controlledValue,
  onValueChange,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  label: string;
  dateOnly?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const container = useContext(FloatingLayerContext);
  const input = useRef<HTMLInputElement>(null);
  const [internalValue, setValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date | undefined>(() => parseDay(defaultValue));
  const [month, setMonth] = useState(() => parseDay(defaultValue) || new Date());
  const [time, setTime] = useState(defaultValue.slice(11, 16) || '19:00');

  function changeOpen(next: boolean) {
    if (next) {
      const selected = parseDay(value);
      setDay(selected);
      setMonth(selected || new Date());
      setTime(value.slice(11, 16) || '19:00');
    }
    setOpen(next);
  }
  function commit(next: string) {
    setValue(next);
    onValueChange?.(next);
    setOpen(false);
    // Notify form validation after React has committed the input value.
    requestAnimationFrame(() =>
      input.current?.dispatchEvent(new Event('input', { bubbles: true })),
    );
  }
  const selected = parseDay(value);
  const caption = selected
    ? `${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(selected)}${dateOnly ? '' : ` · ${value.slice(11, 16)}`}`
    : dateOnly
      ? 'Todos os dias'
      : 'Escolher data e horário';
  const year = month.getFullYear();
  const years = Array.from({ length: 31 }, (_, index) => {
    const option = year - 10 + index;
    return { value: String(option), label: String(option) };
  });
  const [hours, minutes] = time.split(':');

  return (
    <span className="anade-date-field" data-form-control="">
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger
          className="anade-control anade-date-trigger"
          disabled={disabled}
          aria-label={label}
          aria-required={required}
          data-empty={!value || undefined}
          data-control-trigger=""
        >
          <CalendarDays size={18} />
          <span>{caption}</span>
          <ChevronDown size={16} />
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content
            className="anade-date-popover"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            aria-label={`Selecionar ${label.toLocaleLowerCase('pt-BR')}`}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onInteractOutside={(event) => {
              const target = event.detail.originalEvent.target;
              if (target instanceof Element && target.closest('[data-anade-select-popup]'))
                event.preventDefault();
            }}
          >
            <div className="date-popover-heading">
              <span>
                <CalendarDays size={16} /> AGENDA ANADE
              </span>
              <Popover.Close className="date-icon-button" aria-label="Fechar calendário">
                <X size={16} />
              </Popover.Close>
            </div>
            <div className="date-month-navigation">
              <button
                type="button"
                className="date-icon-button"
                aria-label="Mês anterior"
                onClick={() => setMonth(new Date(year, month.getMonth() - 1, 1))}
              >
                <ChevronLeft size={18} />
              </button>
              <Select
                aria-label="Mês do calendário"
                value={String(month.getMonth())}
                onValueChange={(next) => setMonth(new Date(year, Number(next), 1))}
                options={months}
              />
              <Select
                aria-label="Ano do calendário"
                value={String(year)}
                onValueChange={(next) => setMonth(new Date(Number(next), month.getMonth(), 1))}
                options={years}
              />
              <button
                type="button"
                className="date-icon-button"
                aria-label="Próximo mês"
                onClick={() => setMonth(new Date(year, month.getMonth() + 1, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <DayPicker
              className="anade-calendar"
              mode="single"
              required
              locale={ptBR}
              month={month}
              onMonthChange={setMonth}
              selected={day}
              onSelect={setDay}
              hideNavigation
              showOutsideDays
              fixedWeeks
              autoFocus
            />
            {!dateOnly && (
              <div className="date-time-section">
                <span>
                  <Clock3 size={16} /> Horário <small>do seu dispositivo</small>
                </span>
                <div className="date-time-controls">
                  <Select
                    aria-label="Hora"
                    value={hours}
                    onValueChange={(next) => setTime(`${next}:${minutes}`)}
                    options={Array.from({ length: 24 }, (_, hour) => ({
                      value: pad(hour),
                      label: pad(hour),
                    }))}
                  />
                  <b aria-hidden="true">:</b>
                  <Select
                    aria-label="Minuto"
                    value={minutes}
                    onValueChange={(next) => setTime(`${hours}:${next}`)}
                    options={Array.from({ length: 60 }, (_, minute) => ({
                      value: pad(minute),
                      label: pad(minute),
                    }))}
                  />
                </div>
              </div>
            )}
            <div className="date-picker-summary" aria-live="polite">
              {day
                ? `${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(day)}${dateOnly ? '' : ` às ${time}`}`
                : 'Selecione um dia no calendário'}
            </div>
            <div className="date-picker-actions">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setDay(today);
                  setMonth(today);
                }}
              >
                Hoje
              </button>
              <button type="button" disabled={!value} onClick={() => commit('')}>
                Limpar
              </button>
              <button
                type="button"
                className="date-apply"
                disabled={!day}
                onClick={() => day && commit(`${datePart(day)}${dateOnly ? '' : `T${time}`}`)}
              >
                <Check size={15} /> Aplicar
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <input
        ref={input}
        className="control-validation-input"
        type="text"
        name={name}
        value={value}
        onChange={() => {}}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
    </span>
  );
}
