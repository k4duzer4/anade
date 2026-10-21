'use client';
import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Modal, SubmitButton, ErrorNotice, Empty } from '@/components/ui';
import { PollCard } from '@/components/poll-card';
import { Select } from '@/components/select';
import { DateTimePicker } from '@/components/date-time-picker';
import { Form } from '@/components/form';
export default function Polls() {
  const { data, mutate, notify } = usePortal();
  const [filter, setFilter] = useState('open'),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!data) return null;
  const list = data.polls.filter((p) => p.closed === (filter === 'closed')).toReversed();
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await mutate('/api/polls', 'POST', {
        ...input,
        secret: input.secret === 'true',
        deadline: new Date(String(input.deadline)).toISOString(),
        options: String(input.options)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setOpen(false);
      notify('Votação aberta aos filiados.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="A NOSSA VOZ DECIDE."
        description="Um filiado, um voto. Participe dos caminhos da ANADE."
        action={
          data.user.admin && (
            <button
              className="button primary"
              onClick={() => {
                setError('');
                setOpen(true);
              }}
            >
              <Plus size={17} /> Nova votação
            </button>
          )
        }
      />
      <div className="section-toolbar">
        <div className="tabs" aria-label="Filtrar votações">
          <button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>
            Em votação <span>{data.polls.filter((p) => !p.closed).length}</span>
          </button>
          <button
            className={filter === 'closed' ? 'active' : ''}
            onClick={() => setFilter('closed')}
          >
            Encerradas <span>{data.polls.filter((p) => p.closed).length}</span>
          </button>
        </div>
        <span className="toolbar-hint">
          <ShieldCheck size={14} /> Voto único e definitivo
        </span>
      </div>
      <div className="polls-grid">
        {list.length ? (
          list.map((p) => <PollCard key={p.id} poll={p} />)
        ) : (
          <section className="panel">
            <Empty>
              {filter === 'open'
                ? 'Não há votações abertas neste momento.'
                : 'As votações encerradas aparecerão aqui.'}
            </Empty>
          </section>
        )}
      </div>
      <p className="page-note">
        Nas votações secretas, o resultado é exibido somente após o encerramento. Nas abertas, o
        voto é nominal e pode ser consultado pelos filiados.
      </p>
      {open && (
        <Modal title="ABRIR VOTAÇÃO" onClose={() => setOpen(false)}>
          <Form onSubmit={create}>
            <p className="form-description">
              Apresente o tema, as alternativas e o prazo para decidir.
            </p>
            <div className="form-grid">
              <label className="field full">
                Tema
                <input
                  name="title"
                  maxLength={200}
                  required
                  placeholder="Qual decisão vamos tomar?"
                />
              </label>
              <label className="field full">
                Contexto
                <textarea
                  name="description"
                  maxLength={3000}
                  rows={3}
                  placeholder="Explique a proposta para os filiados…"
                />
              </label>
              <label className="field full">
                Alternativas
                <textarea
                  name="options"
                  required
                  rows={4}
                  placeholder={'Alternativa 1\nAlternativa 2'}
                />
                <small>
                  De 2 a 10 alternativas, uma por linha. A opção Abstenção é incluída
                  automaticamente.
                </small>
              </label>
              <label className="field">
                Prazo de encerramento
                <DateTimePicker name="deadline" label="Prazo de encerramento" required />
                <small>Horário local do dispositivo.</small>
              </label>
              <label className="field">
                Modalidade
                <Select
                  name="secret"
                  aria-label="Modalidade"
                  defaultValue="true"
                  options={[
                    { value: 'true', label: 'Voto secreto' },
                    { value: 'false', label: 'Voto nominal (aberto)' },
                  ]}
                />
              </label>
            </div>
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button type="button" className="button outline" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <SubmitButton busy={busy}>Publicar votação</SubmitButton>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
