'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  ClipboardCheck,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRoundPlus,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { ThemeSwitcher } from './theme-switcher';
import { Form } from './form';
import { Select } from './select';
import { ErrorNotice, SubmitButton } from './ui';
import { portalRequest } from '@/lib/portal-request';
import { affiliationStatuses, type ApplicantSession } from '@/lib/affiliations';

export default function AffiliationContent() {
  const { config } = usePortal();
  const [session, setSession] = useState<ApplicantSession | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [showForm, setShowForm] = useState(false);
  const [degree1, setDegree1] = useState(''),
    [degree2, setDegree2] = useState('');
  const load = useCallback((signal?: AbortSignal) => {
    return portalRequest<ApplicantSession>('/api/affiliation/session', { signal })
      .then((value) => {
        if (!signal?.aborted) {
          setSession(value);
          setError('');
        }
      })
      .catch((e) => {
        if (!signal?.aborted && (e as { status?: number }).status !== 401)
          setError((e as Error).message);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await portalRequest('/api/affiliation/requests', {
        method: 'POST',
        csrf: session.csrf,
        body: {
          ...Object.fromEntries(form),
          age: Number(form.get('age')),
          degrees: [degree1, degree2].filter(Boolean),
          accepted: form.get('accepted') === 'on',
          legalVersion: session.legalVersion,
        },
      });
      setShowForm(false);
      await load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(path: string) {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await portalRequest(path, { method: 'POST', csrf: session.csrf });
      if (path === '/api/logout') {
        window.location.assign(new URL('/', window.location.origin));
        return;
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const request = session?.request;
  const canApply =
    session && !session.user.member && (!request || (request.status !== 'pending' && showForm));
  return (
    <main className="affiliation-page">
      <header className="public-portal-header">
        <Link href="/" className="public-wordmark">
          ANADE<span>10</span>
        </Link>
        <nav>
          <Link href="/partido">A ANADE</Link>
          <ThemeSwitcher />
          {session && (
            <button
              className="button outline"
              disabled={busy}
              onClick={() => action('/api/logout')}
            >
              <LogOut size={15} />
              Sair
            </button>
          )}
        </nav>
      </header>
      <div className="affiliation-layout">
        <aside className="affiliation-intro">
          <span className="eyebrow">UM PROJETO DE TODOS</span>
          <h1>Sua participação começa aqui.</h1>
          <p>Solicite sua filiação à Aliança Nacional Democrática no RPG Legado.</p>
          <ol>
            <li>
              <span>01</span>
              <div>
                <strong>Identifique-se pelo Discord</strong>
                <p>Sua conta fica vinculada à solicitação.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Apresente seu personagem</strong>
                <p>Conte seus planos e como pretende contribuir.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Acompanhe a análise</strong>
                <p>
                  A administração decide. Se aprovado, seu acesso é liberado e o bot tenta avisar no
                  Discord.
                </p>
              </div>
            </li>
          </ol>
          <div className="affiliation-privacy-note">
            <ShieldCheck size={20} />
            <p>
              Use apenas dados do personagem. Não informe CPF, telefone ou e-mail pessoal. A
              candidatura é restrita a você e aos administradores.
            </p>
          </div>
          <Link href="/" className="text-link">
            <ArrowLeft size={15} />
            Voltar ao início
          </Link>
        </aside>
        <section className="affiliation-main" aria-busy={loading || busy}>
          <ErrorNotice message={error} />
          {loading ? (
            <p role="status">Consultando sua solicitação…</p>
          ) : !session ? (
            <div className="affiliation-welcome">
              <UserRoundPlus size={40} />
              <span className="eyebrow">FILIAÇÃO DIGITAL</span>
              <h2>Vamos nos conhecer?</h2>
              <p>
                Entre com sua conta do Discord para preencher a ficha e acompanhar a resposta. O
                login não concede filiação automaticamente.
              </p>
              {config?.configured && (
                <a className="button" href="/auth/discord">
                  Continuar com Discord
                  <ArrowRight size={18} />
                </a>
              )}
              <p className="muted">Você não precisa ter o cargo de filiado para solicitar.</p>
            </div>
          ) : session.user.member ? (
            <div className="affiliation-welcome">
              <CheckCheck size={42} />
              <h2>Sua filiação está ativa.</h2>
              <p>Você já pode participar das atividades do portal.</p>
              <a href="/painel" className="button">
                Acessar o portal
                <ArrowRight size={17} />
              </a>
            </div>
          ) : (
            <>
              <div className="affiliation-account">
                <ShieldCheck size={18} />
                <div>
                  <small>CONTA DISCORD IDENTIFICADA</small>
                  <strong>@{session.user.discord}</strong>
                </div>
                <button
                  className="icon-button"
                  aria-label="Atualizar situação"
                  disabled={busy}
                  onClick={() => load()}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              {request && !canApply && (
                <div className="affiliation-result">
                  <ClipboardCheck size={38} />
                  <span className="eyebrow">SOLICITAÇÃO DE FILIAÇÃO</span>
                  <h2>{affiliationStatuses[request.status]}</h2>
                  <p>
                    {request.status === 'pending'
                      ? 'Recebemos sua ficha. A administração fará a análise e você pode conferir a resposta aqui.'
                      : request.status === 'rejected'
                        ? 'A administração concluiu a análise. Você pode apresentar uma nova solicitação.'
                        : 'Sua solicitação foi encerrada. Você pode preencher uma nova ficha.'}
                  </p>
                  <p>
                    <strong>{request.data.name}</strong> · {request.data.city}/{request.data.state}
                  </p>
                  {request.reviewNote && (
                    <blockquote>
                      <small>RESPOSTA DA ADMINISTRAÇÃO</small>
                      <p>{request.reviewNote}</p>
                    </blockquote>
                  )}
                  {request.status === 'pending' ? (
                    <Form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void action(`/api/affiliation/requests/${request.id}/withdraw`);
                      }}
                    >
                      <label className="affiliation-consent">
                        <input type="checkbox" required disabled={busy} />
                        Quero retirar minha solicitação da análise.
                      </label>
                      <SubmitButton busy={busy}>Retirar solicitação</SubmitButton>
                    </Form>
                  ) : (
                    <button className="button" onClick={() => setShowForm(true)}>
                      Nova solicitação
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              )}
              {canApply && (
                <Form className="affiliation-form" onSubmit={submit}>
                  <header>
                    <span className="eyebrow">FICHA DE FILIAÇÃO</span>
                    <h2>Apresente seu personagem</h2>
                    <p>Todos os campos são referentes ao RPG Legado.</p>
                  </header>
                  <div className="affiliation-fields">
                    <label className="full">
                      Nome do personagem
                      <input name="name" required maxLength={120} autoComplete="off" />
                    </label>
                    <label>
                      Cidade de atuação
                      <input name="city" required maxLength={120} autoComplete="off" />
                    </label>
                    <label>
                      Estado de atuação
                      <Select
                        name="state"
                        aria-label="Estado de atuação"
                        required
                        options={(config?.states || []).map((value) => ({ value, label: value }))}
                      />
                    </label>
                    <label>
                      Idade do personagem
                      <input type="number" name="age" min={18} max={120} required />
                    </label>
                    <label>
                      Formação
                      <Select
                        aria-label="Formação"
                        value={degree1}
                        onValueChange={setDegree1}
                        required
                        options={(config?.degrees || []).map((value) => ({
                          value,
                          label: value,
                          disabled: value === degree2,
                        }))}
                      />
                    </label>
                    <label className="full">
                      Segunda formação (opcional)
                      <Select
                        aria-label="Segunda formação"
                        value={degree2 || 'none'}
                        onValueChange={(v) => setDegree2(v === 'none' ? '' : v)}
                        options={[
                          { value: 'none', label: 'Sem segunda formação' },
                          ...(config?.degrees || []).map((value) => ({
                            value,
                            label: value,
                            disabled: value === degree1,
                          })),
                        ]}
                      />
                    </label>
                    <label>
                      Número LegApp
                      <input name="legapp" required placeholder="(11) 423-653" maxLength={30} />
                    </label>
                    <label>
                      @ do Blue
                      <input name="blue" required placeholder="@personagem" maxLength={41} />
                    </label>
                    <label className="full">
                      E-mail no sistema do Legado
                      <input
                        type="email"
                        name="email"
                        required
                        maxLength={160}
                        autoComplete="off"
                      />
                      <small>
                        Informe o e-mail fictício do personagem, não seu e-mail pessoal.
                      </small>
                    </label>
                    <label className="full">
                      Corrente com que tenho afinidade
                      <Select
                        name="current"
                        aria-label="Corrente com que tenho afinidade"
                        required
                        options={session.currents.map((value) => ({ value, label: value }))}
                      />
                    </label>
                    <label className="full">
                      O que pretende fazer no Legado?
                      <textarea name="plans" rows={4} required maxLength={1500} />
                    </label>
                    <label className="full">
                      Qual sua forma de contribuir com a ANADE?
                      <textarea name="contribution" rows={4} required maxLength={1500} />
                    </label>
                  </div>
                  <label className="affiliation-consent">
                    <input type="checkbox" name="accepted" required />
                    <span>
                      Li e concordo com os{' '}
                      <Link href="/termos" target="_blank">
                        Termos e Condições de Uso
                      </Link>{' '}
                      e a{' '}
                      <Link href="/privacidade" target="_blank">
                        Política de Privacidade
                      </Link>
                      . Autorizo o uso dos dados desta ficha para analisar a filiação, criar meu
                      perfil se aprovado e comunicar a decisão pelo Discord.
                    </span>
                  </label>
                  <SubmitButton busy={busy}>
                    Enviar solicitação
                    <ArrowRight size={17} />
                  </SubmitButton>
                  <p className="muted">
                    A aprovação não atribui cargo eletivo nem função dentro do partido.
                  </p>
                </Form>
              )}
            </>
          )}
          <footer className="affiliation-legal-links">
            <Link href="/termos">Termos de Uso</Link>
            <Link href="/privacidade">Privacidade</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
