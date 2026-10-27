'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, ShieldCheck, Vote, CheckCheck, Archive, ArrowRight } from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { PageHeading, Modal, SubmitButton, ErrorNotice, Empty } from '@/components/ui';
import { PollCard } from '@/components/poll-card';
import { Select } from '@/components/select';
import { DateTimePicker } from '@/components/date-time-picker';
import { Form } from '@/components/form';
import { SearchBox, ViewFilters, PagePulse } from '@/components/portal-tools';
import { searchText } from '@/lib/types';
import { PollElectorate } from '@/components/poll-electorate';
import { ElectorateNavigation } from '@/components/electorate-navigation';
export default function Polls() {
  const { data, mutate, notify } = usePortal();
  const params = useSearchParams(),
    router = useRouter(),
    target = params.get('votacao') || '',
    groupId = params.get('grupo') || '';
  const [filter, setFilter] = useState('open'),
    [open, setOpen] = useState(() => params.get('nova') === '1' && data?.user.admin === true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [search, setSearch] = useState('');
  if (!data) return null;
  const scoped = data.polls.filter(
    (p) => !groupId || (p.governance?.groupId || 'national') === groupId,
  );
  const active = scoped.filter((p) => !p.closed);
  const pending = active.filter((p) => !p.hasVoted && p.canVote !== false);
  const list = scoped
    .filter((p) =>
      target
        ? p.id === target
        : filter === 'pending'
          ? !p.closed && !p.hasVoted && p.canVote !== false
          : p.closed === (filter === 'closed'),
    )
    .filter((p) => searchText(`${p.title} ${p.description}`).includes(searchText(search)))
    .sort((a, b) =>
      filter === 'closed'
        ? Date.parse(b.deadline) - Date.parse(a.deadline)
        : Number(a.hasVoted) - Number(b.hasVoted) ||
          Date.parse(a.deadline) - Date.parse(b.deadline),
    );
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = new FormData(event.currentTarget),
      input = Object.fromEntries(raw);
    setBusy(true);
    setError('');
    try {
      await mutate('/api/polls', 'POST', {
        ...input,
        groupId: input.groupId === 'all' ? '' : input.groupId,
        electorIds: raw.getAll('electorIds'),
        quorumPercent: Number(input.quorumPercent),
        opensAt: input.opensAt ? new Date(String(input.opensAt)).toISOString() : undefined,
        secret: input.secret === 'true',
        deadline: new Date(String(input.deadline)).toISOString(),
        options: String(input.options)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setOpen(false);
      notify('Votação publicada com o eleitorado definido.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="refresh-page votes-refresh">
      <PageHeading
        eyebrow="DEMOCRACIA INTERNA · ANADE"
        title="Votações internas"
        description={
          pending.length
            ? `${pending.length} ${pending.length === 1 ? 'decisão aguarda' : 'decisões aguardam'} sua participação. Escolha, revise e confirme.`
            : 'Acompanhe as decisões e os resultados da nossa aliança.'
        }
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
      <section className="decision-intro">
        <span className="decision-intro-icon">
          <Vote size={27} />
        </span>
        <div>
          <span className="eyebrow">PARTICIPE DAS DECISÕES</span>
          <h2>
            {pending.length
              ? 'Seu próximo voto começa aqui.'
              : 'Decisões claras. Participação de todos.'}
          </h2>
          <p>
            Escolha um grupo, consulte o tema e confirme seu voto. A abstenção também é uma forma de
            participar.
          </p>
        </div>
        {pending.length > 0 && (
          <button
            className="button secondary"
            onClick={() => {
              setFilter('pending');
              if (target) {
                const next = new URLSearchParams(params.toString());
                next.delete('votacao');
                router.replace(`/votacoes?${next}`);
              }
            }}
          >
            Ver o que falta votar
            <ArrowRight size={16} />
          </button>
        )}
      </section>
      <ElectorateNavigation
        records={data.polls.map((p) => ({
          groupId: p.governance?.groupId,
          groupName: p.governance?.groupName,
        }))}
        value={groupId || 'all'}
        onChange={(value) => {
          const next = new URLSearchParams(params.toString());
          next.delete('votacao');
          next.delete('nova');
          if (value === 'all') next.delete('grupo');
          else next.set('grupo', value);
          router.replace(`/votacoes${next.size ? `?${next}` : ''}`);
        }}
      />
      <PagePulse
        items={[
          { label: 'aguardando seu voto', value: pending.length, Icon: Vote },
          {
            label: 'votos em decisões abertas',
            value: active.filter((p) => p.hasVoted).length,
            Icon: CheckCheck,
          },
          {
            label: 'resultados disponíveis',
            value: scoped.length - active.length,
            Icon: Archive,
          },
        ]}
      />
      <div className="refresh-toolbar">
        <ViewFilters
          label="Filtrar votações"
          value={
            target ? (data.polls.find((p) => p.id === target)?.closed ? 'closed' : 'open') : filter
          }
          onChange={(value) => {
            setFilter(value);
            if (target)
              router.replace(
                groupId ? `/votacoes?grupo=${encodeURIComponent(groupId)}` : '/votacoes',
              );
          }}
          options={[
            { value: 'open', label: 'Em andamento', count: active.length },
            { value: 'pending', label: 'Para votar', count: pending.length },
            { value: 'closed', label: 'Encerradas', count: scoped.length - active.length },
          ]}
        />
        <SearchBox value={search} onChange={setSearch} label="Buscar votação" />
      </div>
      {target && (
        <button className="text-button community-own" onClick={() => router.replace('/votacoes')}>
          Ver todas as votações
        </button>
      )}
      <div className="refresh-list-caption" aria-live="polite">
        <span>
          {list.length} votaç{list.length === 1 ? 'ão' : 'ões'}
        </span>
        <span>
          <ShieldCheck size={13} /> Voto único e definitivo
        </span>
      </div>
      <div className="refresh-polls-grid">
        {list.length ? (
          list.map((p) => (
            <PollCard key={`${p.id}:${target || 'list'}`} poll={p} autoOpen={Boolean(target)} />
          ))
        ) : (
          <section className="panel">
            <Empty>
              <ShieldCheck size={27} />
              <h3>
                {search
                  ? 'Nenhuma votação encontrada.'
                  : filter === 'pending'
                    ? 'Tudo em dia com suas decisões.'
                    : filter === 'open'
                      ? 'Sem decisões abertas por enquanto.'
                      : 'Os resultados aparecerão aqui.'}
              </h3>
              <p>
                {search
                  ? 'Experimente buscar por outro tema.'
                  : 'Acompanhe as próximas votações da ANADE.'}
              </p>
              {(search || filter === 'pending') && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setSearch('');
                    setFilter('open');
                  }}
                >
                  Ver votações em andamento
                </button>
              )}
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
                  maxLength={6000}
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
              <PollElectorate initialGroupId={groupId === 'national' ? '' : groupId} />
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
    </div>
  );
}
