'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ContactRound,
  Hash,
  LoaderCircle,
  Search,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  LayoutDashboard,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { Empty, ErrorNotice, PageHeading, SubmitButton } from './ui';
import { Form } from './form';
import { AdminOverview } from './admin-overview';
import { MemberAvatar } from './member-avatar';

type Account = { id: string; discord: string; name: string; isAdmin: boolean };

export default function AdministrationContent() {
  const { data, mutate, notify, refresh } = usePortal();
  const [tab, setTab] = useState<'overview' | 'access'>('overview');
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [discordId, setDiscordId] = useState('');
  const [selected, setSelected] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [accountsError, setAccountsError] = useState('');
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
        if (!controller.signal.aborted) {
          setAccounts(result);
          setAccountsError('');
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setAccountsError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [data?.user.admin, loadAccounts, version]);

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
  return (
    <div className="refresh-page admin-dashboard">
      <PageHeading
        eyebrow="ADMINISTRAÇÃO · ANADE 10"
        title="Centro de gestão."
        description="Acompanhe a participação, organize as decisões e cuide da nossa aliança."
        action={
          <button
            className="button secondary"
            type="button"
            disabled={refreshing || loading}
            onClick={async () => {
              setRefreshing(true);
              setLoading(true);
              setError('');
              setAccountsError('');
              setVersion((v) => v + 1);
              try {
                await refresh();
              } finally {
                setRefreshing(false);
              }
            }}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            Atualizar painel
          </button>
        }
      />
      <div className="admin-navigation">
        <Link href="/administracao/cargos" className="button secondary">
          <ContactRound size={16} />
          Cargos e funções
        </Link>
        <div role="group" aria-label="Seções da administração" className="refresh-filters">
          <button
            type="button"
            aria-pressed={tab === 'overview'}
            onClick={() => setTab('overview')}
          >
            <LayoutDashboard size={15} />
            Visão geral
          </button>
          <button type="button" aria-pressed={tab === 'access'} onClick={() => setTab('access')}>
            <ShieldCheck size={15} />
            Acessos e equipe
          </button>
        </div>
        <span>
          <ShieldCheck size={14} />
          Exclusivo da administração
        </span>
      </div>
      {tab === 'overview' ? (
        <>
          <ErrorNotice message={accountsError} />
          <AdminOverview
            adminsCount={loading || accountsError ? null : admins.length}
            refreshVersion={version}
            onManageAccess={() => setTab('access')}
          />
        </>
      ) : (
        <>
          <ErrorNotice message={accountsError} />
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
              <Form onSubmit={locate} className="admin-lookup-form">
                <label className="field">
                  ID do usuário Discord
                  <div className="admin-id-input">
                    <Hash size={17} />
                    <input
                      name="discordId"
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
                      disabled={busy || loading || !!accountsError}
                      autoComplete="off"
                      aria-describedby="admin-id-help"
                    />
                  </div>
                  <small id="admin-id-help">
                    Use o ID da pessoa, não o ID de um cargo. Ela precisa ter entrado no portal pelo
                    menos uma vez.
                  </small>
                </label>
                <button
                  type="submit"
                  className="button secondary"
                  disabled={busy || loading || !!accountsError}
                >
                  {loading ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}{' '}
                  Localizar conta
                </button>
              </Form>
              {selected && (
                <div className="admin-account-preview">
                  <div className="admin-account-identity">
                    <MemberAvatar
                      className="avatar large"
                      name={selected.name || selected.discord}
                      src={data.members.find((m) => m.id === selected.id)?.avatarUrl}
                    />
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
                      <Form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void grant();
                        }}
                      >
                        <SubmitButton busy={busy}>
                          <ShieldCheck size={16} /> Conceder administração
                        </SubmitButton>
                      </Form>
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
                      <MemberAvatar
                        name={account.name || account.discord}
                        src={data.members.find((m) => m.id === account.id)?.avatarUrl}
                      />
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
                    Nenhuma conta com administração local. Acesso também pode ser concedido por um
                    cargo configurado no Discord.
                  </p>
                </Empty>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
