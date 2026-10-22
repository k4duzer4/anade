'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Vote,
  Users,
  ContactRound,
  Flag,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Landmark,
  Settings2,
  Clock3,
} from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { initials } from '@/lib/types';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { m } from 'motion/react';
const nav = [
  { path: '/painel', title: 'Visão geral', icon: LayoutDashboard },
  { path: '/agenda', title: 'Agenda do partido', icon: CalendarDays },
  { path: '/votacoes', title: 'Votações internas', icon: Vote },
  { path: '/ponto', title: 'Bater ponto', icon: Clock3 },
  { path: '/filiados', title: 'Nossos filiados', icon: Users },
  { path: '/direcao', title: 'Direção', icon: Landmark },
  { path: '/ficha', title: 'Meu perfil', icon: ContactRound },
  { path: '/administracao', title: 'Administração', icon: Settings2 },
];
export default function PortalLayout({ children }: { children: ReactNode }) {
  const { data, config, loading, error, logout, refresh } = usePortal();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!loading && !data) router.replace('/');
  }, [data, loading, router]);
  if (loading || !data)
    return (
      <div className="page-loader">
        <span className="loader-brand">
          ANADE<span>10</span>
        </span>
        <p>Preparando nosso espaço…</p>
      </div>
    );
  const member = data.members.find((m) => m.id === data.user.id),
    name = member?.name || data.user.discord;
  const visibleNav = nav.filter((item) => item.path !== '/administracao' || data.user.admin);
  const active = visibleNav.find((n) => n.path === path || path.startsWith(`${n.path}/`));
  async function exit() {
    try {
      await logout();
      router.replace('/');
    } catch {
      await refresh();
    }
  }
  return (
    <div className={`portal-shell ${menu ? 'menu-open' : ''}`}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link className="sidebar-brand" href="/painel" aria-label="ANADE 10, início">
          <div className="brand-image">
            <Image
              src="/brand/anade-logo.png"
              alt="ANADE 10 com seu jacaré"
              width={180}
              height={180}
            />
          </div>
          <span>ALIANÇA NACIONAL DEMOCRÁTICA</span>
        </Link>
        <div className="sidebar-divider">
          <span>PORTAL DO FILIADO</span>
          <i />
        </div>
        <nav aria-label="Menu principal">
          {visibleNav.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setMenu(false)}
              className={active?.path === item.path ? 'active' : ''}
              aria-current={active?.path === item.path ? 'page' : undefined}
            >
              {active?.path === item.path && (
                <m.span
                  className="nav-active-pill"
                  layoutId="sidebar-active"
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                />
              )}
              <item.icon size={19} />
              {item.title}
              {item.path === '/votacoes' && data.polls.filter((p) => !p.closed).length > 0 && (
                <span className="nav-count">{data.polls.filter((p) => !p.closed).length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="nav-secondary">
          <Link
            href="/partido"
            onClick={() => setMenu(false)}
            className={path === '/partido' ? 'active' : ''}
          >
            <Flag size={18} /> A ANADE
          </Link>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-motto">
            <span>UMA ALIANÇA DE IDEIAS.</span>
            <strong>
              UM PROJETO
              <br />
              DE TODOS.
            </strong>
            <span className="gold-rule" />
          </div>
          <a
            className="wiki-link"
            href="https://legado.planalto.fun/wiki/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wiki do Legado
            <ArrowUpRight size={15} />
          </a>
          <div className="user-block">
            <div className="avatar">{initials(name)}</div>
            <div>
              <strong>{name.split(' ').slice(0, 2).join(' ')}</strong>
              <small>{data.user.admin ? 'Direção nacional' : 'Filiado ANADE'}</small>
            </div>
            <button aria-label="Sair da conta" className="icon-button" onClick={exit}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {menu && (
        <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMenu(false)} />
      )}
      <div className="portal-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span>Diretório digital</span>
            <ChevronRight size={13} />
            <b>
              {path === '/ficha/editar'
                ? 'Editar meu perfil'
                : path.startsWith('/filiados/')
                  ? 'Perfil do filiado'
                  : active?.title || 'A ANADE'}
            </b>
          </div>
          <div className="topbar-right">
            <ThemeSwitcher />
            <span className="verified">
              <ShieldCheck size={14} />
              {config?.demo ? 'Acesso demonstrativo' : 'Filiado verificado'}
            </span>
            <Link href="/ficha" className="avatar small" aria-label="Abrir meu perfil">
              {initials(name)}
            </Link>
          </div>
        </header>
        {config?.demo && (
          <div className="demo-banner">
            <span>
              <i /> AMBIENTE DE DEMONSTRAÇÃO
            </span>
            <span>Dados fictícios · alterações serão perdidas ao reiniciar</span>
          </div>
        )}
        <main id="conteudo" className="page-content">
          {error && (
            <div className="connection-error">
              {error}
              <button onClick={() => void refresh()}>
                <RefreshCw size={14} /> Atualizar
              </button>
            </div>
          )}
          {children}
          <footer className="portal-footer">
            <span>
              <b>
                ANADE<span>10</span>
              </b>{' '}
              Aliança Nacional Democrática
            </span>
            <span>Portal independente · RPG Legado · Horários de Brasília</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
