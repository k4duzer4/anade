'use client';
import { useState } from 'react';
import { Video, FileText, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { usePortal } from './portal-provider';
import { ErrorNotice, SubmitButton } from './ui';
import type { Meeting } from '@/lib/types';
function localDateTime(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function MeetingForm({
  meeting,
  onSaved,
  onCancel,
}: {
  meeting?: Meeting;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, mutate, notify } = usePortal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!data?.user.admin) return null;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await mutate(
        meeting ? `/api/meetings/${meeting.id}` : '/api/meetings',
        meeting ? 'PUT' : 'POST',
        {
          ...values,
          date: new Date(String(values.date)).toISOString(),
          agenda: String(values.agenda)
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      );
      onSaved();
      notify(meeting ? 'Reunião atualizada.' : 'Reunião agendada.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <p className="form-description">
        Organize a reunião, vincule a chamada e deixe a ata no mesmo lugar.
      </p>
      <div className="form-grid">
        <label className="field full">
          Título
          <input
            name="title"
            maxLength={200}
            defaultValue={meeting?.title}
            required
            placeholder="Ex.: Reunião do Diretório Nacional"
          />
        </label>
        <label className="field full">
          Data e horário
          <input
            name="date"
            type="datetime-local"
            defaultValue={meeting ? localDateTime(meeting.date) : ''}
            required
          />
          <small>Horário local do seu dispositivo.</small>
        </label>
        <section className="meeting-service full">
          <header>
            <span>
              <Video size={18} />
              Google Meet
            </span>
            <a href="https://meet.google.com/" target="_blank" rel="noopener noreferrer">
              Criar chamada no Google
              <ArrowUpRight size={13} />
            </a>
          </header>
          <label className="field">
            Link da chamada
            <input
              name="meetUrl"
              type="url"
              maxLength={2048}
              defaultValue={meeting?.meetUrl || ''}
              required
              placeholder="https://meet.google.com/abc-defg-hij"
            />
            <small>
              Crie uma reunião para mais tarde no Meet e cole o link aqui. Os filiados poderão
              entrar pelo portal.
            </small>
          </label>
        </section>
        <section className="meeting-service docs-service full">
          <header>
            <span>
              <FileText size={18} />
              Ata no Google Docs
            </span>
            <a href="https://docs.google.com/create" target="_blank" rel="noopener noreferrer">
              Criar documento
              <ArrowUpRight size={13} />
            </a>
          </header>
          <label className="field">
            Link do Google Docs da ata
            <input
              name="docsUrl"
              type="url"
              maxLength={2048}
              defaultValue={meeting?.docsUrl || ''}
              placeholder="https://docs.google.com/document/d/ID/edit"
            />
            <small>
              Opcional agora; você pode vincular a ata depois da reunião. Compartilhe o documento
              com os filiados como leitores no Google Docs.
            </small>
          </label>
        </section>
        <label className="field full">
          Pautas
          <textarea
            name="agenda"
            rows={4}
            required
            defaultValue={meeting?.agenda.join('\n')}
            placeholder={'Organização dos diretórios\nPrioridades da bancada\nPróximos passos'}
          />
          <small>Uma pauta por linha, até 30 itens.</small>
        </label>
        <details className="meeting-notes-editor full">
          <summary>Notas e encaminhamentos no portal (opcional)</summary>
          <label className="field">
            Registro interno
            <textarea
              name="minutes"
              maxLength={10000}
              rows={5}
              defaultValue={meeting?.minutes || ''}
              placeholder="Registre decisões e próximos passos…"
            />
          </label>
        </details>
      </div>
      <p className="meeting-admin-note">
        <ShieldCheck size={15} />
        Somente a administração edita a reunião e seus links. As permissões de acesso e edição da
        chamada e do documento são definidas no Google.
      </p>
      <ErrorNotice message={error} />
      <div className="form-actions">
        <button type="button" className="button outline" onClick={onCancel}>
          Cancelar
        </button>
        <SubmitButton busy={busy}>{meeting ? 'Salvar reunião' : 'Agendar encontro'}</SubmitButton>
      </div>
    </form>
  );
}
