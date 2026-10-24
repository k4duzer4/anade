'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ArrowUpRight } from 'lucide-react';
import { usePortal } from './portal-provider';
import { Modal, Empty, ErrorNotice } from './ui';
import { OrganizationLoading, OrganizationPager, useOrganization } from './organization-ui';
import { type Notification, type Page } from '@/lib/organization';
import { formatDate } from '@/lib/types';
export function NotificationCenter() {
  const { data, mutate } = usePortal();
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const { value, error: loadError } = useOrganization<Page<Notification> & { unread: number }>(
    data ? `/api/notifications?page=${page}` : null,
    `${data?.serverTime}:${version}`,
  );
  async function read(keys: string[]) {
    setBusy(true);
    setError('');
    try {
      await mutate('/api/notifications/read', 'PUT', { keys });
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="icon-button org-bell"
        aria-label={`Notificações${value?.unread ? `, ${value.unread} não lidas` : ''}`}
        onClick={() => setOpen(true)}
      >
        <Bell size={20} />
        {!!value?.unread && <span>{value.unread > 99 ? '99+' : value.unread}</span>}
      </button>
      {open && (
        <Modal title="Suas notificações" onClose={() => setOpen(false)}>
          <p className="form-description">
            Atribuições, menções, reuniões nas próximas 24 horas e prazos. Os avisos são atualizados
            enquanto você navega no portal.
          </p>
          <ErrorNotice message={error || loadError} />
          {!value && <OrganizationLoading />}
          {!!value?.records.some((n) => !n.read) && (
            <button
              className="text-button org-read-all"
              disabled={busy}
              onClick={() => read(value.records.filter((n) => !n.read).map((n) => n.key))}
            >
              <CheckCheck size={16} />
              Marcar esta página como lida
            </button>
          )}
          <div className="org-notifications">
            {value?.records.map((n) => (
              <article className={n.read ? 'is-read' : ''} key={n.key}>
                <span className="org-notification-dot" />
                <div>
                  <span className="eyebrow">
                    {n.type === 'mencao'
                      ? 'MENÇÃO'
                      : n.type === 'prazo'
                        ? 'AGENDA E PRAZOS'
                        : 'ATRIBUIÇÃO'}
                  </span>
                  <h3>{n.title}</h3>
                  {n.date && <p>{formatDate(n.date)}</p>}
                  <Link href={n.href} className="text-button" onClick={() => setOpen(false)}>
                    Ver no portal
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
                {!n.read && (
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Marcar como lida: ${n.title}`}
                    onClick={() => read([n.key])}
                  >
                    <CheckCheck size={17} />
                  </button>
                )}
              </article>
            ))}
          </div>
          {value?.records.length === 0 && (
            <Empty>
              <Bell size={26} />
              <h3>Tudo em dia por aqui.</h3>
              <p>Seus próximos avisos aparecerão neste espaço.</p>
            </Empty>
          )}
          {value && <OrganizationPager page={page} hasMore={value.hasMore} onChange={setPage} />}
        </Modal>
      )}
    </>
  );
}
