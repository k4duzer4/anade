'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ContactRound,
  Hash,
  Landmark,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Vote,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { Badge, Empty, ErrorNotice, PageHeading, SubmitButton } from './ui';
import { initials } from '@/lib/types';

type Account = { id: string; discord: string; name: string; isAdmin: boolean };

export default function AdministrationContent() {
  const { data, mutate, notify } = usePortal();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [discordId, setDiscordId] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/admin/accounts', { cache: 'no-store', signal });
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Não foi possível carregar as contas. Tente novamente.');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Acesso administrativo indisponível.');
    return result.accounts as Account[];
  }, []);
  useEffect(() => {
    if (!data?.user.admin) return;
    const controller = new AbortController();
    loadAccounts(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setAccounts(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [data?.user.admin, loadAccounts]);

  if (!data?.user.admin)
    return (
      <section className="panel">
        <Empty>
          <ShieldCheck size={28} />
          <p>Esta área é exclusiva para administradores.</p>
          <Link href="/painel" className="button secondary">
            Voltar ao painel
          </Link>
        </Empty>
      </section>
    );

  const admins = accounts.filter((account) => account.isAdmin);
  function locate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const found = accounts.find((account) => account.id === discordId.trim());
    setSelected(found || null);
    if (!found)
      setError(
        'Essa conta ainda não está no portal. Peça à pessoa para entrar com o Discord pelo menos uma vez e atualize esta página.',
      );
  }
  async function grant() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await mutate('/api/admin/admins', 'POST', { discordId: selected.id });
      setAccounts(await loadAccounts());
      setSelected({ ...selected, isAdmin: true });
      notify('Permissão de administrador concedida.');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const actions = [
    {
      title: 'Agenda do partido',
      description: 'Reuniões, pautas e atas.',
      href: '/agenda',
      Icon: CalendarDays,
    },
    {
      title: 'Votações internas',
      description: 'Propostas e decisões coletivas.',
      href: '/votacoes',
      Icon: Vote,
    },
    {
      title: 'Direção',
      description: 'Composição e responsabilidades.',
      href: '/direcao',
      Icon: Landmark,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="GESTÃO DO PORTAL"
        title="ADMINISTRAÇÃO."
        description="Organize o partido e gerencie quem pode cuidar deste espaço."
        action={
          <Badge tone="gold">
            <ShieldCheck size={14} /> Acesso administrativo
          </Badge>
        }
      />
      <section className="admin-overview" aria-label="Resumo do portal">
        <div>
          <span>
            <Users size={18} /> FILIADOS CADASTRADOS
          </span>
          <strong>{data.members.length}</strong>
          <small>fichas no diretório</small>
        </div>
        <div>
          <span>
            <ShieldCheck size={18} /> ADMINISTRADORES LOCAIS
          </span>
          <strong>{loading ? '—' : admins.length}</strong>
          <small>permissões gerenciadas no portal</small>
        </div>
        <div>
          <span>
            <Vote size={18} /> VOTAÇÕES EM ABERTO
          </span>
          <strong>
            {
              data.polls.filter(
                (poll) => !poll.closed && Date.parse(poll.deadline) > Date.parse(data.serverTime),
              ).length
            }
          </strong>
          <small>decisões em andamento</small>
        </div>
      </section>
      <section className="admin-shortcuts" aria-label="Ferramentas de administração">
        {actions.map(({ title, description, href, Icon }) => (
          <Link href={href} key={href}>
            <span className="section-icon">
              <Icon size={21} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </section>
      <div className="admin-columns">
        <section className="panel admin-grant-panel">
          <header className="admin-section-heading">
            <span className="section-icon">
              <UserPlus size={21} />
            </span>
            <div>
              <span className="eyebrow">COMPARTILHAR A GESTÃO</span>
              <h2>Adicionar administrador</h2>
            </div>
          </header>
          <p className="admin-description">
            Informe o ID do usuário no Discord e confira a conta antes de conceder a permissão.
          </p>
          <form onSubmit={locate} className="admin-lookup-form">
            <label className="field">
              ID do usuário Discord
              <div className="admin-id-input">
                <Hash size={17} />
                <input
                  value={discordId}
                  onChange={(event) => {
                    setDiscordId(event.target.value);
                    setSelected(null);
                    setError('');
                  }}
                  placeholder="Ex.: 123456789012345678"
                  inputMode="numeric"
                  pattern="[0-9]{17,20}"
                  minLength={17}
                  maxLength={20}
                  required
                  disabled={busy || loading}
                  autoComplete="off"
                  aria-describedby="admin-id-help"
                />
              </div>
              <small id="admin-id-help">
                Use o ID da pessoa, não o ID de um cargo. Ela precisa ter entrado no portal pelo
                menos uma vez.
              </small>
            </label>
            <button type="submit" className="button secondary" disabled={busy || loading}>
              {loading ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}{' '}
              Localizar conta
            </button>
          </form>
          {selected && (
            <div className="admin-account-preview">
              <div className="admin-account-identity">
                <span className="avatar large">{initials(selected.name || selected.discord)}</span>
                <div>
                  <strong>{selected.name || selected.discord}</strong>
                  <span>@{selected.discord}</span>
                  <code>{selected.id}</code>
                </div>
              </div>
              {selected.isAdmin ? (
                <p className="admin-already-granted">
                  <Check size={17} /> Esta conta já é administradora.
                </p>
              ) : (
                <>
                  <p>
                    Essa pessoa poderá gerenciar reuniões, votações, direção e conceder
                    administração a outras contas.
                  </p>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void grant();
                    }}
                  >
                    <SubmitButton busy={busy}>
                      <ShieldCheck size={16} /> Conceder administração
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
          )}
          <ErrorNotice message={error} />
        </section>
        <section className="panel admin-list-panel">
          <header className="admin-section-heading">
            <span className="section-icon">
              <ShieldCheck size={21} />
            </span>
            <div>
              <span className="eyebrow">QUEM CUIDA DO PORTAL</span>
              <h2>Administradores locais</h2>
            </div>
          </header>
          {loading ? (
            <div className="admin-loading" role="status">
              <LoaderCircle className="spin" size={21} /> Carregando contas…
            </div>
          ) : admins.length ? (
            <ul className="admin-account-list">
              {admins.map((account) => (
                <li key={account.id}>
                  <span className="avatar">{initials(account.name || account.discord)}</span>
                  <div>
                    <strong>
                      {account.name || account.discord}
                      {account.id === data.user.id && <small>Você</small>}
                    </strong>
                    <span>@{account.discord}</span>
                    <code>{account.id}</code>
                  </div>
                  <ShieldCheck size={17} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              <ContactRound size={25} />
              <p>
                Nenhuma conta com administração local. Acesso também pode ser concedido por um cargo
                configurado no Discord.
              </p>
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}
