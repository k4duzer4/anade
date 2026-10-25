'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { Bell, CheckCheck, ArrowUpRight, Clock3, AtSign, Inbox, X } from 'lucide-react';
import { usePortal } from './portal-provider';
import { Empty, ErrorNotice } from './ui';
import { OrganizationLoading, OrganizationPager, useOrganization } from './organization-ui';
import { type Notification, type Page } from '@/lib/organization';
import { formatDate } from '@/lib/types';
export function NotificationCenter() {
  const { data, mutate } = usePortal(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState<string[]>([]);
  const { value, error: loadError } = useOrganization<Page<Notification> & { unread: number }>(
    data ? `/api/notifications?page=${page}` : null,
    `${data?.serverTime}:${version}`,
  );
  const isRead = (n: Notification) => n.read || confirmed.includes(n.key);
  const unread = Math.max(
    0,
    (value?.unread || 0) -
      (value?.records.filter((n) => !n.read && confirmed.includes(n.key)).length || 0),
  );
  async function read(keys: string[]) {
    setBusy(true);
    setError('');
    try {
      await mutate('/api/notifications/read', 'PUT', { keys });
      setConfirmed((current) => [...new Set([...current, ...keys])]);
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function follow(n: Notification) {
    if (busy) return;
    if (!isRead(n) && !(await read([n.key]))) return;
    setOpen(false);
    router.push(n.href);
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="icon-button org-bell"
          aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}
        >
          <Bell size={20} />
          {unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="notification-popover"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          aria-label="Suas notificações"
        >
          <header className="notification-heading">
            <span className="notification-heading-icon">
              <Bell size={20} />
            </span>
            <div>
              <span className="eyebrow">SEU DIA NA ANADE</span>
              <h2>Notificações</h2>
              <p>
                {unread
                  ? `${unread} ${unread === 1 ? 'aviso não lido' : 'avisos não lidos'}`
                  : 'Tudo em dia por aqui.'}
              </p>
            </div>
            <Popover.Close className="icon-button" aria-label="Fechar notificações">
              <X size={17} />
            </Popover.Close>
          </header>
          <div className="notification-toolbar">
            <span>Abra um aviso para marcá-lo como lido.</span>
            {value?.records.some((n) => !isRead(n)) && (
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Marcar esta página como lida"
                title="Marcar esta página como lida"
                onClick={() => void read(value.records.filter((n) => !isRead(n)).map((n) => n.key))}
              >
                <CheckCheck size={17} />
              </button>
            )}
          </div>
          <ErrorNotice message={error || loadError} />
          <div className="notification-scroll">
            {!value && <OrganizationLoading />}
            {value?.records.map((n) => {
              const Icon = n.type === 'mencao' ? AtSign : n.type === 'prazo' ? Clock3 : Inbox;
              return (
                <button
                  className={`notification-item ${isRead(n) ? 'is-read' : 'is-new'}`}
                  key={n.key}
                  disabled={busy}
                  onClick={() => void follow(n)}
                  aria-label={`Abrir notificação: ${n.title}`}
                >
                  <span className="notification-item-icon">
                    <Icon size={17} />
                  </span>
                  <span className="notification-item-copy">
                    <span className="notification-item-label">
                      {n.type === 'mencao'
                        ? 'VOCÊ FOI MENCIONADO'
                        : n.type === 'prazo'
                          ? 'AGENDA E PRAZOS'
                          : 'PARA VOCÊ'}
                      {!isRead(n) && <i aria-label="Não lida" />}
                    </span>
                    <strong>{n.title}</strong>
                    {n.date && <time dateTime={n.date}>{formatDate(n.date)}</time>}
                    <span className="notification-item-action">
                      {busy ? 'Aguarde…' : 'Ver no portal'}
                      <ArrowUpRight size={12} />
                    </span>
                  </span>
                </button>
              );
            })}
            {value?.records.length === 0 && (
              <Empty>
                <CheckCheck size={30} />
                <h3>Nenhum aviso por enquanto.</h3>
                <p>Suas atribuições, menções e prazos aparecem aqui.</p>
              </Empty>
            )}
          </div>
          {value && (page > 0 || value.hasMore) && (
            <footer className="notification-pagination">
              <OrganizationPager page={page} hasMore={value.hasMore} onChange={setPage} />
            </footer>
          )}
          <Popover.Arrow className="notification-arrow" width={14} height={7} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
