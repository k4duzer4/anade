'use client';
import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  LockKeyhole,
  Pencil,
  Plus,
  Wallet as WalletIcon,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, Empty, ErrorNotice, Badge } from './ui';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import {
  MembersPicker,
  OrganizationForm,
  OrganizationLoading,
  OrganizationPager,
  useOrganization,
} from './organization-ui';
import {
  cents,
  entryNames,
  money,
  options,
  walletNames,
  type Entry,
  type Page,
  type Wallet,
} from '@/lib/organization';
import { shortDay } from '@/lib/community';
import { OrganizationFiles } from './organization-files';

export function FinanceHub() {
  const { data } = usePortal();
  const [version, setVersion] = useState(0),
    [page, setPage] = useState(0),
    [wallet, setWallet] = useState('all');
  const [dialog, setDialog] = useState<{
    type: 'wallet' | 'entry' | 'files';
    wallet?: Wallet;
    entry?: Entry;
  } | null>(null);
  const { value, error } = useOrganization<Page<Entry> & { wallets: Wallet[] }>(
    `/api/finance?page=${page}${wallet === 'all' ? '' : `&wallet=${wallet}`}`,
    `${version}:${data?.serverTime}`,
  );
  if (!data) return null;
  const close = () => setDialog(null),
    saved = () => {
      close();
      setPage(0);
      setVersion((v) => v + 1);
    };
  return (
    <div className="refresh-page org-page">
      <PageHeading
        eyebrow="FINANCEIRO · ANADE"
        title="Cada recurso, um destino."
        description="Controle interno dos recursos do RPG, separado por caixa, fundo eleitoral e campanha."
        action={
          <div className="org-actions">
            {data.user.admin && (
              <button className="button secondary" onClick={() => setDialog({ type: 'wallet' })}>
                <Plus size={16} />
                Criar caixa
              </button>
            )}
            {!!value?.wallets.length && (
              <button className="button primary" onClick={() => setDialog({ type: 'entry' })}>
                <Plus size={17} />
                Registrar movimentação
              </button>
            )}
          </div>
        }
      />
      <ErrorNotice message={error} />
      {!value && <OrganizationLoading />}
      <div className="org-wallet-grid">
        {value?.wallets.map((w) => (
          <article className="panel org-wallet" key={w.id}>
            <div className="org-card-heading">
              <span className="org-symbol">
                <WalletIcon size={22} />
              </span>
              <Badge>{walletNames[w.type]}</Badge>
              {data.user.admin && (
                <button
                  className="icon-button"
                  aria-label={`Editar ${w.name}`}
                  onClick={() => setDialog({ type: 'wallet', wallet: w })}
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
            <h2>{w.name}</h2>
            <span className="eyebrow">DISPONÍVEL</span>
            <strong>{money(w.available)}</strong>
            <dl>
              <div>
                <dt>Saldo</dt>
                <dd>{money(w.balance)}</dd>
              </div>
              <div>
                <dt>Reservado</dt>
                <dd>{money(w.reserved)}</dd>
              </div>
            </dl>
            <button
              className="text-button"
              onClick={() => {
                setWallet(w.id);
                setPage(0);
              }}
            >
              Ver extrato
              <ArrowUpRight size={14} />
            </button>
          </article>
        ))}
      </div>
      {value?.wallets.length === 0 && (
        <section className="panel">
          <Empty>
            <LockKeyhole size={27} />
            <h3>Nenhum caixa disponível.</h3>
            <p>A administração define quem pode consultar e movimentar cada caixa.</p>
          </Empty>
        </section>
      )}
      {!!value?.wallets.length && (
        <>
          <div className="org-toolbar">
            <h2>Movimentações</h2>
            <Select
              aria-label="Filtrar caixa"
              value={wallet}
              onValueChange={(v) => {
                setWallet(v);
                setPage(0);
              }}
              options={[
                { value: 'all', label: 'Todos os meus caixas' },
                ...value.wallets.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
          </div>
          <div className="panel org-ledger">
            {value.records.map((e) => (
              <article key={e.id}>
                <span className={`org-ledger-icon ${e.type}`}>
                  {e.type === 'receita' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </span>
                <div>
                  <span className="eyebrow">
                    {entryNames[e.type]} · {shortDay(e.date)}
                  </span>
                  <h3>{e.title}</h3>
                  <p>
                    {value.wallets.find((w) => w.id === e.walletId)?.name}
                    {e.recipient ? ` · ${e.recipient}` : ''}
                  </p>
                </div>
                <strong>
                  {e.type === 'despesa' ? '−' : e.type === 'receita' ? '+' : ''}
                  {money(e.amountCents)}
                </strong>
                <button
                  className="icon-button"
                  aria-label={`Detalhes e comprovantes de ${e.title}`}
                  onClick={() => setDialog({ type: 'files', entry: e })}
                >
                  <FileText size={18} />
                </button>
              </article>
            ))}
            {value.records.length === 0 && <Empty>As movimentações aparecerão aqui.</Empty>}
          </div>
          <OrganizationPager page={page} hasMore={value.hasMore} onChange={setPage} />
          <p className="org-help">
            <LockKeyhole size={14} />
            Extrato permanente: lançamentos não são apagados ou reescritos. Não realiza
            transferências no Legado.
          </p>
        </>
      )}
      {dialog?.type === 'wallet' && (
        <Modal title={dialog.wallet ? 'Editar caixa' : 'Criar caixa'} onClose={close}>
          <OrganizationForm
            url={`/api/finance/wallets${dialog.wallet ? `/${dialog.wallet.id}` : ''}`}
            method={dialog.wallet ? 'PUT' : 'POST'}
            onSaved={saved}
            onCancel={close}
            transform={(v, raw) => ({ ...v, memberIds: raw.getAll('memberIds') })}
          >
            <div className="form-grid">
              <label className="field full">
                Nome do caixa
                <input name="name" required maxLength={120} defaultValue={dialog.wallet?.name} />
              </label>
              <label className="field full">
                Tipo
                <Select
                  name="type"
                  aria-label="Tipo de caixa"
                  defaultValue={dialog.wallet?.type || 'partidario'}
                  options={options(walletNames)}
                />
              </label>
              <div className="full">
                <MembersPicker
                  label="Acesso e movimentação"
                  members={data.members}
                  selected={dialog.wallet?.memberIds}
                />
              </div>
            </div>
            <p className="form-description">
              Administradores têm acesso a todos os caixas. O saldo inicial deve ser lançado como
              receita.
            </p>
          </OrganizationForm>
        </Modal>
      )}
      {dialog?.type === 'entry' && value && (
        <Modal title="Registrar movimentação" onClose={close}>
          <EntryEditor
            wallets={value.wallets}
            initial={wallet === 'all' ? value.wallets[0]?.id : wallet}
            onSaved={saved}
            onCancel={close}
          />
        </Modal>
      )}
      {dialog?.type === 'files' && dialog.entry && (
        <Modal title={dialog.entry.title} onClose={close}>
          <dl className="org-detail-grid">
            <div>
              <dt>Tipo</dt>
              <dd>{entryNames[dialog.entry.type]}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{money(dialog.entry.amountCents)}</dd>
            </div>
            <div>
              <dt>Destinatário / origem</dt>
              <dd>{dialog.entry.recipient || 'Não informado'}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{shortDay(dialog.entry.date)}</dd>
            </div>
          </dl>
          <p className="org-body">{dialog.entry.body}</p>
          <OrganizationFiles
            kind="entry"
            id={dialog.entry.id}
            memberIds={value?.wallets.find((w) => w.id === dialog.entry?.walletId)?.memberIds || []}
            canEdit
          />
        </Modal>
      )}
    </div>
  );
}
function EntryEditor({
  wallets,
  initial,
  onSaved,
  onCancel,
}: {
  wallets: Wallet[];
  initial?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [walletId, setWalletId] = useState(initial || wallets[0]?.id || ''),
    [type, setType] = useState('receita');
  const current = wallets.find((w) => w.id === walletId);
  return (
    <OrganizationForm
      url="/api/finance/entries"
      onSaved={onSaved}
      onCancel={onCancel}
      submit="Confirmar lançamento"
      transform={(v) => ({
        ...v,
        amountCents: cents(v.amount),
        reservationId: v.reservationId === 'none' ? '' : v.reservationId,
      })}
    >
      <p className="form-description">
        Confira antes de confirmar. O lançamento fica registrado no extrato. Uma reserva separa o
        valor disponível; a despesa ligada à reserva consome essa separação.
      </p>
      <div className="form-grid">
        <label className="field">
          Caixa
          <Select
            name="walletId"
            aria-label="Caixa"
            value={walletId}
            onValueChange={setWalletId}
            options={wallets.map((w) => ({ value: w.id, label: w.name }))}
          />
        </label>
        <label className="field">
          Operação
          <Select
            name="type"
            aria-label="Operação"
            value={type}
            onValueChange={setType}
            options={options(entryNames)}
          />
        </label>
        <label className="field full">
          Descrição
          <input name="title" required maxLength={200} />
        </label>
        <label className="field">
          Valor (R$ do RPG)
          <input
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            required
            pattern="[0-9]+([.,][0-9]{1,2})?"
          />
        </label>
        <label className="field">
          Data
          <DateTimePicker name="date" label="Data do lançamento" dateOnly required />
        </label>
        <label className="field full">
          Destinatário / origem
          <input name="recipient" maxLength={200} />
        </label>
        {['despesa', 'liberacao'].includes(type) && (
          <label className="field full">
            Reserva vinculada
            <Select
              key={`${walletId}:${type}`}
              name="reservationId"
              aria-label="Reserva vinculada"
              defaultValue="none"
              options={[
                {
                  value: 'none',
                  label:
                    type === 'liberacao'
                      ? 'Escolha a reserva'
                      : 'Sem reserva · usar saldo disponível',
                },
                ...(current?.reservations.filter((r) => r.remaining > 0) || []).map((r) => ({
                  value: r.id,
                  label: `${r.title} · ${money(r.remaining)}`,
                })),
              ]}
            />
          </label>
        )}
        <label className="field full">
          Observações
          <textarea name="body" maxLength={2000} rows={3} />
        </label>
      </div>
      <p className="form-description">
        Disponível neste caixa: {money(current?.available || 0)}. Comprovantes podem ser adicionados
        depois pelo extrato.
      </p>
    </OrganizationForm>
  );
}
