'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCheck, Clock3, LockKeyhole, Send, ShieldCheck } from 'lucide-react';
import { usePortal } from './portal-provider';
import { Badge, ErrorNotice, PageHeading, SubmitButton } from './ui';
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
      await mutate('/api/checkins', 'POST', payload);
      setActions(null);
      setBlue(null);
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
  return (
    <>
      <PageHeading
        title="PRESENÇA QUE CONSTRÓI."
        eyebrow="BATER PONTO"
        description="Fez as três ações e publicou no Blue? Registre sua participação com os dois prints."
        action={
          data.user.admin && (
            <Link className="button secondary" href="/administracao/pontos">
              <ShieldCheck size={16} /> Consultar pontos <ArrowUpRight size={15} />
            </Link>
          )
        }
      />
      <div className="checkin-intro">
        <span className="checkin-intro-symbol">
          <Clock3 size={30} />
        </span>
        <div>
          <h2>Seu compromisso, registrado.</h2>
          <p>
            Disponível para todos os filiados. Participar é opcional: você pode registrar um ponto
            por dia, no horário de Brasília.
          </p>
        </div>
        <Badge tone={completed ? 'green' : 'gold'}>
          {completed ? (
            <>
              <CheckCheck size={14} /> Ponto de hoje registrado
            </>
          ) : (
            'Um registro por dia'
          )}
        </Badge>
      </div>
      {status && !status.storageReady && (
        <p className="connection-error" role="status">
          A administração ainda precisa configurar o Supabase Storage para receber os prints.
        </p>
      )}
      {completed ? (
        <section className="panel checkin-completed">
          <CheckCheck size={34} />
          <div>
            <h2>Tudo certo por hoje!</h2>
            <p>
              Seus comprovantes foram recebidos. Você pode consultá-los no histórico abaixo e voltar
              amanhã para um novo ponto.
            </p>
          </div>
        </section>
      ) : (
        <Form onSubmit={submit} className="checkin-form">
          <fieldset disabled={disabled}>
            <div className="checkin-upload-grid">
              <ProofUpload
                name="actions"
                label="Print das três ações"
                description="Mostre que você concluiu as três ações do dia no Legado."
                disabled={disabled}
                file={actions}
                onChange={setActions}
              />
              <ProofUpload
                name="blue"
                label="Print do post no Blue"
                description="Inclua a publicação feita no Blue para acompanhar seu ponto."
                disabled={disabled}
                file={blue}
                onChange={setBlue}
              />
            </div>
            <label className="field checkin-office">
              Cargo pretendido <small>Opcional, se você estiver concorrendo a uma eleição.</small>
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
            <label className="checkin-confirm">
              <input name="confirmed" type="checkbox" required />
              <span>
                Confirmo que concluí as três ações e publiquei no Blue. Os prints correspondem ao
                ponto que estou registrando hoje.
              </span>
            </label>
          </fieldset>
          <div className="checkin-submit">
            <p>
              <LockKeyhole size={16} /> Somente você e a administração podem abrir seus
              comprovantes.
            </p>
            <SubmitButton busy={busy} disabled={disabled}>
              <Send size={16} /> {busy ? 'Preparando e enviando…' : 'Bater ponto'}
            </SubmitButton>
          </div>
        </Form>
      )}
      <ErrorNotice message={error || loadError} />
      <CheckinHistory revision={revision} />
    </>
  );
}
