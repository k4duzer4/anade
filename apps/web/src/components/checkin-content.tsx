'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  Clock3,
  FileImage,
  Landmark,
  LockKeyhole,
  Send,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { ErrorNotice, SubmitButton } from './ui';
import { Form } from './form';
import { Select } from './select';
import { ProofUpload } from './proof-upload';
import { CheckinHistory } from './checkin-history';
import { loadCheckins, prepareCheckinProof } from '@/lib/checkin-upload';
import type { CheckinList } from '@/lib/types';

export default function CheckinContent() {
  const { data, config, mutate, notify } = usePortal();
  const [status, setStatus] = useState<CheckinList | null>(null);
  const [actions, setActions] = useState<File | null>(null);
  const [blue, setBlue] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [stage, setStage] = useState<'preparing' | 'sending'>('preparing');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadCheckins<CheckinList>('/api/checkins', controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setStatus(value);
          setLoadError('');
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadError(failure.message);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const timer = setInterval(() => setRevision((value) => value + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actions || !blue) {
      setError('Escolha os dois prints para bater ponto.');
      return;
    }
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setStage('preparing');
    setError('');
    try {
      const [actionsBlob, blueBlob] = await Promise.all([
        prepareCheckinProof(actions),
        prepareCheckinProof(blue),
      ]);
      const payload = new FormData();
      const office = String(fields.get('office') || 'none');
      payload.set('office', office === 'none' ? '' : office);
      payload.set('confirmed', 'true');
      payload.set('actions', actionsBlob, 'acoes.webp');
      payload.set('blue', blueBlob, 'blue.webp');
      setStage('sending');
      await mutate('/api/checkins', 'POST', payload);
      setActions(null);
      setBlue(null);
      setConfirmed(false);
      form.reset();
      setRevision((value) => value + 1);
      notify('Ponto registrado com os dois comprovantes.');
    } catch (failure) {
      setError((failure as Error).message);
      // A duplicate or a midnight rollover should also refresh today's status.
      setRevision((value) => value + 1);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return null;
  const completed = !!status?.todayRecord;
  const disabled = busy || !status || !status.storageReady || completed;
  const prints = Number(!!actions) + Number(!!blue);
  const steps = completed ? 3 : prints + Number(confirmed);
  const ready = prints === 2 && confirmed;
  const date = status
    ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
        new Date(`${status.today}T12:00:00Z`),
      )
    : 'Carregando o dia…';
  const sentAt = status?.todayRecord
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(status.todayRecord.createdAt))
    : '';
  return (
    <div className="checkin-page">
      <header className="checkin-page-heading">
        <div>
          <span className="eyebrow">
            <span /> PARTICIPAÇÃO ANADE
          </span>
          <h1>
            Bater ponto<span>.</span>
          </h1>
          <p>Dois prints. Sua participação do dia registrada.</p>
        </div>
        {data.user.admin && (
          <div className="checkin-admin-actions">
            <Link className="checkin-admin-link" href="/administracao/pontos">
              <ShieldCheck size={16} /> Consultar pontos <ArrowRight size={15} />
            </Link>
            <Link className="checkin-admin-link" href="/administracao/pontos/ranking">
              <Trophy size={16} /> Ranking
            </Link>
          </div>
        )}
      </header>
      {status && !status.storageReady && (
        <p className="connection-error" role="status">
          A administração ainda precisa configurar o Supabase Storage para receber os prints.
        </p>
      )}
      {completed ? (
        <section className="checkin-completed" aria-label="Ponto de hoje registrado">
          <div className="checkin-completed-mark">
            <CheckCheck size={36} />
          </div>
          <span className="eyebrow">PARTICIPAÇÃO REGISTRADA</span>
          <h2>Tudo certo por hoje!</h2>
          <p>Seus dois comprovantes estão guardados. Nos vemos no próximo ponto.</p>
          <div className="checkin-receipt">
            <span>
              <CalendarDays size={15} /> {date}
            </span>
            <span>
              <Clock3 size={15} /> Enviado às {sentAt} · Brasília
            </span>
          </div>
          <a href="#historico-pontos" className="button secondary">
            Ver meus comprovantes <ArrowDown size={15} />
          </a>
        </section>
      ) : (
        <Form onSubmit={submit} className="checkin-form">
          <fieldset disabled={disabled}>
            <div className="checkin-form-heading">
              <div>
                <span className="checkin-live-dot" />
                <strong>Seu ponto de hoje</strong>
                <span className="checkin-current-date">{date}</span>
              </div>
              <span>
                <Clock3 size={13} /> Horário de Brasília
              </span>
            </div>
            <div className="checkin-workspace">
              <div className="checkin-evidence">
                <div className="checkin-upload-grid">
                  <ProofUpload
                    name="actions"
                    label="Print das três ações"
                    description="As três ações concluídas no Legado."
                    disabled={disabled}
                    file={actions}
                    onChange={setActions}
                  />
                  <ProofUpload
                    name="blue"
                    label="Print do post no Blue"
                    description="A publicação feita por você no Blue."
                    disabled={disabled}
                    file={blue}
                    onChange={setBlue}
                  />
                </div>
                <details className="checkin-election">
                  <summary>
                    <Landmark size={16} />
                    <span>Está concorrendo a uma eleição?</span>
                    <small>Opcional</small>
                    <ArrowDown size={14} />
                  </summary>
                  <label className="field checkin-office">
                    Cargo pretendido
                    <Select
                      name="office"
                      aria-label="Cargo pretendido"
                      defaultValue="none"
                      options={[
                        { value: 'none', label: 'Não informar / não sou candidato' },
                        ...(config?.electoralOffices || []).map((office) => ({
                          value: office,
                          label: office,
                        })),
                      ]}
                    />
                  </label>
                </details>
              </div>
              <aside
                className={`checkin-summary ${ready ? 'is-ready' : ''}`}
                aria-label="Resumo do envio"
              >
                <div className="checkin-summary-heading">
                  <span className="eyebrow">PRONTO PARA HOJE?</span>
                  <FileImage size={19} />
                </div>
                <div className="checkin-progress-count" aria-live="polite">
                  <strong>
                    {prints}
                    <span>/2</span>
                  </strong>
                  <span>prints adicionados</span>
                </div>
                <div
                  className="checkin-progress-track"
                  role="progressbar"
                  aria-label="Preparação do ponto"
                  aria-valuemin={0}
                  aria-valuemax={3}
                  aria-valuenow={steps}
                  aria-valuetext={`${prints} de 2 prints${confirmed ? ', atividades confirmadas' : ''}`}
                >
                  <span style={{ width: `${(steps / 3) * 100}%` }} />
                </div>
                <ol className="checkin-steps">
                  <li data-complete={!!actions}>
                    <span>{actions ? <Check size={12} /> : '1'}</span>Print das ações
                  </li>
                  <li data-complete={!!blue}>
                    <span>{blue ? <Check size={12} /> : '2'}</span>Print do Blue
                  </li>
                  <li data-complete={confirmed}>
                    <span>{confirmed ? <Check size={12} /> : '3'}</span>Confirmar e registrar
                  </li>
                </ol>
                <label className="checkin-confirm">
                  <input
                    name="confirmed"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    required
                  />
                  <span>Concluí as três ações e publiquei no Blue. Estes prints são de hoje.</span>
                </label>
                <SubmitButton busy={busy} disabled={disabled}>
                  <Send size={16} />{' '}
                  {busy
                    ? stage === 'preparing'
                      ? 'Preparando imagens…'
                      : 'Enviando comprovantes…'
                    : 'Bater ponto'}
                </SubmitButton>
                <p className="checkin-ready-hint" role="status">
                  {busy
                    ? 'Mantenha esta página aberta.'
                    : ready
                      ? 'Tudo pronto. É só registrar!'
                      : 'Adicione os prints e confirme acima.'}
                </p>
              </aside>
            </div>
          </fieldset>
          <div className="checkin-form-footnote">
            <p>
              <LockKeyhole size={14} /> Só você e a administração veem os prints.
            </p>
            <p>Participar é opcional · 1 ponto por dia</p>
          </div>
        </Form>
      )}
      <ErrorNotice message={error || loadError} />
      <div id="historico-pontos">
        <CheckinHistory revision={revision} />
      </div>
    </div>
  );
}
