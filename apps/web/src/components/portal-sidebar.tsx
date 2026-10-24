'use client';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  ContactRound,
  Flag,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Megaphone,
  Network,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Scale,
  Settings2,
  ShieldCheck,
  Users,
  Vote,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip } from './floating-ui';
import { MemberAvatar } from './member-avatar';

type NavItem = { path: string; title: string; icon: LucideIcon; adminOnly?: boolean };
export const sidebarGroups = [
  {
    id: 'routine',
    title: 'Dia a dia',
    icon: CalendarDays,
    items: [
      { path: '/agenda', title: 'Agenda do partido', icon: CalendarDays },
      { path: '/calendario', title: 'Calendário do Legado', icon: Clock3 },
      { path: '/comunicados', title: 'Comunicados', icon: Megaphone },
      { path: '/ponto', title: 'Bater ponto', icon: Clock3 },
    ],
  },
  {
    id: 'participation',
    title: 'Participação',
    icon: Vote,
    items: [
      { path: '/votacoes', title: 'Votações internas', icon: Vote },
      { path: '/propostas', title: 'Central de propostas', icon: Lightbulb },
      { path: '/campanha', title: 'Central de campanha', icon: Rocket },
      { path: '/divulgacao', title: 'Mural de divulgação', icon: Newspaper },
    ],
  },
  {
    id: 'organization',
    title: 'Organização',
    icon: Network,
    items: [
      { path: '/grupos', title: 'Grupos e diretórios', icon: Network },
      { path: '/bancadas', title: 'Bancadas', icon: Landmark },
      { path: '/filiados', title: 'Nossos filiados', icon: Users },
      { path: '/direcao', title: 'Direção', icon: Landmark },
      { path: '/estatuto', title: 'Estatuto', icon: BookOpen },
    ],
  },
  {
    id: 'management',
    title: 'Gestão',
    icon: ShieldCheck,
    items: [
      { path: '/financeiro', title: 'Financeiro', icon: Wallet },
      { path: '/juridico', title: 'Jurídico', icon: Scale },
      { path: '/administracao', title: 'Administração', icon: Settings2, adminOnly: true },
    ],
  },
] satisfies { id: string; title: string; icon: LucideIcon; items: NavItem[] }[];
const overview: NavItem = { path: '/painel', title: 'Visão geral', icon: LayoutDashboard };
const profile: NavItem = { path: '/ficha', title: 'Meu perfil', icon: ContactRound };
const party: NavItem = { path: '/partido', title: 'A ANADE', icon: Flag };
export const sidebarItems: NavItem[] = [
  overview,
  ...sidebarGroups.flatMap((g) => g.items),
  profile,
  party,
];
const wideSnapshot = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 701px)').matches;
const narrowSnapshot = () => false;
function subscribeWidth(changed: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(min-width: 701px)');
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
}
type Preferences = { collapsed: boolean; openGroups: Record<string, boolean> };
const key = 'anade:navigation:v1';
export function useSidebarPreferences() {
  const [preferences, setPreferences] = useState<Preferences>({ collapsed: false, openGroups: {} });
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved && typeof saved === 'object')
          setPreferences({
            collapsed: saved.collapsed === true,
            openGroups: Object.fromEntries(
              sidebarGroups
                .filter((g) => typeof saved.openGroups?.[g.id] === 'boolean')
                .map((g) => [g.id, saved.openGroups[g.id]]),
            ),
          });
      } catch {
        /* Navigation still works without browser storage. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  function change(next: Preferences) {
    setPreferences(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Keep the current session preference in memory. */
    }
  }
  return {
    preferences,
    toggleCollapsed: () => change({ ...preferences, collapsed: !preferences.collapsed }),
    toggleGroup: (id: string, open: boolean) =>
      change({ ...preferences, openGroups: { ...preferences.openGroups, [id]: open } }),
  };
}
export function PortalSidebar({
  path,
  admin,
  name,
  avatarUrl,
  menuOpen,
  onNavigate,
  onExit,
  preferences,
  toggleCollapsed,
  toggleGroup,
  pendingVotes = 0,
}: {
  path: string;
  admin: boolean;
  name: string;
  avatarUrl?: string;
  menuOpen: boolean;
  onNavigate: () => void;
  onExit: () => void;
  preferences: Preferences;
  toggleCollapsed: () => void;
  toggleGroup: (id: string, open: boolean) => void;
  pendingVotes?: number;
}) {
  const uid = useId();
  const container = useRef<HTMLElement>(null);
  const wide = useSyncExternalStore(subscribeWidth, wideSnapshot, narrowSnapshot);
  const rail = wide && preferences.collapsed;
  useEffect(() => {
    if (!menuOpen || wide) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    container.current?.querySelector<HTMLButtonElement>('.sidebar-mobile-close')?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onNavigate();
      }
      if (event.key === 'Tab') {
        const targets = Array.from(
          container.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') || [],
        ).filter((el) => el.getClientRects().length > 0);
        const first = targets[0],
          last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [menuOpen, wide, onNavigate]);
  const active = sidebarItems.find(
    (item) => path === item.path || path.startsWith(`${item.path}/`),
  );
  const currentGroup = sidebarGroups.find((g) =>
    g.items.some((item) => item.path === active?.path),
  );
  function itemLink(item: NavItem) {
    const selected = active?.path === item.path;
    return (
      <Tooltip side="right" content={item.title} key={item.path}>
        <Link
          href={item.path}
          className={`sidebar-link ${selected ? 'active' : ''}`}
          aria-label={item.title}
          aria-current={selected ? 'page' : undefined}
          onClick={onNavigate}
        >
          <item.icon size={19} aria-hidden="true" />
          <span className="sidebar-link-label">{item.title}</span>
          {item.path === '/votacoes' && pendingVotes > 0 && (
            <span className="nav-count" aria-label={`${pendingVotes} votações aguardando seu voto`}>
              {pendingVotes}
            </span>
          )}
          {selected && <span className="sidebar-current-mark" aria-hidden="true" />}
        </Link>
      </Tooltip>
    );
  }
  return (
    <aside
      ref={container}
      inert={!wide && !menuOpen}
      className="sidebar sidebar-modern"
      aria-label="Navegação do portal"
      id="portal-navigation"
    >
      <div className="sidebar-top">
        <Link
          className="sidebar-brand"
          href="/painel"
          aria-label="ANADE 10, início"
          onClick={onNavigate}
        >
          <span className="sidebar-full-brand">
            <Image
              src="/brand/anade-logo.png"
              alt="ANADE 10 com seu jacaré"
              width={174}
              height={174}
              priority
            />
            <span>PORTAL DO FILIADO</span>
          </span>
          <span className="sidebar-compact-brand" aria-hidden="true">
            A<span>10</span>
          </span>
        </Link>
        <Tooltip content={preferences.collapsed ? 'Expandir menu' : 'Recolher menu'}>
          <button
            type="button"
            className="sidebar-collapse"
            onClick={toggleCollapsed}
            aria-label={preferences.collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-controls="portal-navigation"
            aria-expanded={!preferences.collapsed}
          >
            {preferences.collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </Tooltip>
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={onNavigate}
          aria-label="Fechar menu lateral"
          tabIndex={menuOpen ? 0 : -1}
        >
          <X size={20} />
        </button>
      </div>
      <nav className="sidebar-scroll" aria-label="Menu principal">
        <div className="sidebar-home">{itemLink(overview)}</div>
        {sidebarGroups.map((g) => {
          const open =
            preferences.openGroups[g.id] ??
            (currentGroup ? currentGroup.id === g.id : g.id === 'routine');
          return (
            <section
              className={`sidebar-section ${currentGroup?.id === g.id ? 'has-active-page' : ''}`}
              key={g.id}
              aria-label={g.title}
            >
              <button
                type="button"
                className="sidebar-section-trigger"
                aria-expanded={rail ? true : open}
                aria-controls={`${uid}-${g.id}`}
                onClick={() => toggleGroup(g.id, !open)}
              >
                <g.icon size={17} aria-hidden="true" />
                <span>{g.title}</span>
                <ChevronDown size={15} className="sidebar-section-chevron" aria-hidden="true" />
              </button>
              <div
                className="sidebar-submenu"
                data-open={open}
                hidden={!open && !rail}
                id={`${uid}-${g.id}`}
              >
                <div>
                  {g.items
                    .filter((item) => !('adminOnly' in item) || admin)
                    .map((item) => itemLink(item))}
                </div>
              </div>
            </section>
          );
        })}
        <div className="sidebar-personal">
          {itemLink(profile)}
          {itemLink(party)}
        </div>
      </nav>
      <footer className="sidebar-footer">
        <Tooltip content="Abrir a Wiki do Legado">
          <a
            className="sidebar-wiki"
            href="https://legado.planalto.fun/wiki/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BookOpen size={17} />
            <span>Wiki do Legado</span>
            <ArrowUpRight size={14} />
          </a>
        </Tooltip>
        <div className="sidebar-account">
          <Tooltip content={`Meu perfil · ${name}`}>
            <Link
              href="/ficha"
              className="sidebar-account-link"
              aria-label={`Meu perfil · ${name}`}
              onClick={onNavigate}
            >
              <MemberAvatar name={name} src={avatarUrl} />
              <span>
                <strong>{name.split(' ').slice(0, 2).join(' ')}</strong>
                <small>{admin ? 'Administração ANADE' : 'Filiado ANADE'}</small>
              </span>
            </Link>
          </Tooltip>
          <Tooltip content="Sair da conta">
            <button className="sidebar-exit" aria-label="Sair da conta" onClick={onExit}>
              <LogOut size={17} />
            </button>
          </Tooltip>
        </div>
      </footer>
    </aside>
  );
}
