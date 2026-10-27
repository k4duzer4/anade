'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Menu, X, ChevronRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { usePortal } from '@/components/portal-provider';
import { MemberAvatar } from './member-avatar';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { GlobalSearch } from './global-search';
import { NotificationCenter } from './notification-center';
import { SectionActivity } from './section-activity';
import { uniqueUnseenCount } from '@/lib/activity';
import { GuestPage } from './guest-page';
import {
  PortalSidebar,
  sidebarItems,
  sidebarGroups,
  useSidebarPreferences,
} from './portal-sidebar';
export default function PortalLayout({ children }: { children: ReactNode }) {
  const { data, config, loading, error, logout, refresh, activity } = usePortal();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const sidebar = useSidebarPreferences();
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
  const guest = data.user.guest === true;
  const visibleNav = sidebarItems.filter((item) => guest || !item.adminOnly || data.user.admin);
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
    <div
      className={`portal-shell ${menu ? 'menu-open' : ''} ${sidebar.preferences.collapsed ? 'sidebar-is-collapsed' : ''}`}
    >
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      {!guest && <SectionActivity path={path} />}
      <PortalSidebar
        path={path}
        admin={data.user.admin}
        guest={guest}
        name={name}
        avatarUrl={member?.avatarUrl}
        menuOpen={menu}
        onNavigate={closeMenu}
        onExit={exit}
        {...sidebar}
        pendingVotes={
          data.polls.filter((p) => !p.closed && !p.hasVoted && p.canVote !== false).length
        }
        unseenCounts={Object.fromEntries(
          Object.entries(activity?.sections || {}).map(([path, value]) => [path, value.unseen]),
        )}
        folderCounts={Object.fromEntries(
          sidebarGroups.map((g) => [
            g.id,
            uniqueUnseenCount(
              activity,
              g.items.map((item) => item.path),
            ),
          ]),
        )}
      />
      {menu && (
        <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMenu(false)} />
      )}
      <div className="portal-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label={menu ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menu}
              aria-controls="portal-navigation"
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
                  : path.startsWith('/grupos/')
                    ? 'Espaço do grupo'
                    : active?.title || 'A ANADE'}
            </b>
          </div>
          <div className="topbar-right">
            {!guest && (
              <>
                <GlobalSearch />
                <NotificationCenter />
              </>
            )}
            <ThemeSwitcher />
            <span className="verified">
              <ShieldCheck size={14} />
              {guest ? 'Convidado' : config?.demo ? 'Acesso demonstrativo' : 'Filiado verificado'}
            </span>
            <Link href="/ficha" aria-label="Abrir meu perfil">
              <MemberAvatar className="avatar small" name={name} src={member?.avatarUrl} />
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
          {guest ? <GuestPage path={path} /> : children}
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
