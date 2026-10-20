'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  Vote,
  Users,
  ArrowUpRight,
  LoaderCircle,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { ErrorNotice } from '@/components/ui';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { m, useReducedMotion } from 'motion/react';
export default function LoginPage() {
  const reduced = useReducedMotion();
  const { config, data, loading, error, loginDemo } = usePortal();
  const router = useRouter();
  const [busy, setBusy] = useState(''),
    [localError, setLocalError] = useState('');
  useEffect(() => {
    if (data) router.replace('/painel');
  }, [data, router]);
  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get('authError');
    if (message) queueMicrotask(() => setLocalError(message));
  }, []);
  async function demo(role: string) {
    setBusy(role);
    setLocalError('');
    try {
      await loginDemo(role);
      router.push('/painel');
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <main className="login-page">
      <section className="login-art">
        <Image
          src="/brand/brasil.png"
          alt="Arte da ANADE: diversidade brasileira, trabalho e igualdade"
          fill
          priority
          sizes="(max-width: 800px) 100vw, 52vw"
        />
        <div className="art-label">
          <span>ALIANÇA NACIONAL DEMOCRÁTICA</span>
          <span>LEGADO · RPG POLÍTICO</span>
        </div>
      </section>
      <section className="login-side">
        <div className="login-top">
          <span>SEDE DIGITAL</span>
          <ThemeSwitcher />
          <a href="https://legado.planalto.fun/wiki/" target="_blank" rel="noopener noreferrer">
            Universo Legado <ArrowUpRight size={14} />
          </a>
        </div>
        <m.div
          className="login-content"
          initial={reduced ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="login-wordmark">
            ANADE<span>10</span>
            <small>ALIANÇA NACIONAL DEMOCRÁTICA</small>
          </div>
          <span className="eyebrow">
            <i /> NOSSO ESPAÇO. NOSSO PROJETO.
          </span>
          <h1>
            DIFERENTES CORRENTES.
            <br />
            <em>UM PROJETO COMUM.</em>
          </h1>
          <p className="login-intro">
            A casa digital de quem constrói a ANADE. Organize, participe e ajude a escrever os
            próximos capítulos do nosso partido.
          </p>
          <div className="login-features">
            <span>
              <CalendarDays size={18} /> Agenda
            </span>
            <span>
              <Vote size={18} /> Votações
            </span>
            <span>
              <Users size={18} /> Filiados
            </span>
          </div>
          <ErrorNotice message={localError || error} />
          {loading ? (
            <p className="loading">
              <LoaderCircle className="spin" size={20} /> Preparando o portal…
            </p>
          ) : config?.configured ? (
            <a href="/auth/discord" className="button discord">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M19.7 5.5a18 18 0 0 0-4.2-1.3l-.5 1a16 16 0 0 0-6 0l-.5-1a18 18 0 0 0-4.2 1.3C1.6 9.6.9 13.6 1.3 17.6a17 17 0 0 0 5.2 2.6l1.1-1.8-1.7-.8.4-.3a13 13 0 0 0 11.4 0l.4.3-1.7.8 1.1 1.8a17 17 0 0 0 5.2-2.6c.5-4.6-.8-8.5-3-12.1ZM8.5 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
              </svg>
              Entrar com Discord
              <ArrowRight size={18} />
            </a>
          ) : (
            <div className="setup-notice">
              <ShieldCheck size={20} />
              <p>
                O acesso pelo Discord estará disponível após a configuração do servidor e dos cargos
                da ANADE.
              </p>
            </div>
          )}
          <p className="access-hint">
            <ShieldCheck size={14} /> Acesso exclusivo para filiados verificados no Discord.
          </p>
          {config?.demo && (
            <div className="demo-access">
              <span className="eyebrow">CONHEÇA O PORTAL · DADOS FICTÍCIOS</span>
              <div>
                <button className="button outline" disabled={!!busy} onClick={() => demo('admin')}>
                  {busy === 'admin' ? <LoaderCircle className="spin" size={16} /> : null}Explorar
                  como direção
                  <ArrowRight size={15} />
                </button>
                <button className="demo-member" disabled={!!busy} onClick={() => demo('member')}>
                  Entrar como filiado
                </button>
              </div>
            </div>
          )}
          <p className="login-values">
            DEMOCRACIA <b>•</b> TRABALHO <b>•</b> JUSTIÇA SOCIAL
          </p>
        </m.div>
        <footer className="login-footer">
          <span>ANADE 10 · Um Brasil mais justo, mais forte, para todos.</span>
          <Link href="/partido" className="login-party-link">
            Conheça a ANADE <ArrowUpRight size={14} />
          </Link>
        </footer>
      </section>
    </main>
  );
}
