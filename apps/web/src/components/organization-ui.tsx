'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle, Search } from 'lucide-react';
import { loadCommunity } from '@/lib/community';
import { searchText, type Member } from '@/lib/types';
import { MemberAvatar } from './member-avatar';
import { Form } from './form';
import { ErrorNotice, SubmitButton } from './ui';
import { usePortal } from './portal-provider';

export function useOrganization<T>(url: string | null, version: unknown = 0) {
  const [value, setValue] = useState<T | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    loadCommunity<T>(url, abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setValue(result);
          setError('');
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [url, version]);
  return { value, error };
}
export function MembersPicker({
  members,
  selected = [],
  name = 'memberIds',
  label = 'Participantes',
}: {
  members: Member[];
  selected?: string[];
  name?: string;
  label?: string;
}) {
  const [search, setSearch] = useState('');
  return (
    <fieldset className="org-member-picker">
      <legend>{label}</legend>
      <label className="org-picker-search">
        <Search size={15} />
        <input
          type="search"
          aria-label={`Buscar ${label.toLowerCase()}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou Discord…"
        />
      </label>
      <div>
        {members.map((m) => (
          <label
            key={m.id}
            hidden={!searchText(`${m.name} ${m.discord}`).includes(searchText(search))}
          >
            <input
              type="checkbox"
              name={name}
              value={m.id}
              defaultChecked={selected.includes(m.id)}
            />
            <MemberAvatar name={m.name} src={m.avatarUrl} />
            <span>
              {m.name}
              <small>
                {m.state} · {m.discord}
              </small>
            </span>
          </label>
        ))}
      </div>
      {!members.length && <p>Nenhum filiado disponível neste grupo.</p>}
    </fieldset>
  );
}
export function OrganizationForm({
  url,
  method = 'POST',
  onSaved,
  onCancel,
  transform,
  children,
  submit = 'Salvar',
}: {
  url: string;
  method?: string;
  onSaved: () => void;
  onCancel: () => void;
  transform: (data: Record<string, FormDataEntryValue>, raw: FormData) => unknown;
  children: ReactNode;
  submit?: string;
}) {
  const { mutate, notify } = usePortal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const raw = new FormData(e.currentTarget);
          await mutate(url, method, transform(Object.fromEntries(raw), raw));
          notify('Registro salvo.');
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <ErrorNotice message={error} />
      <div className="form-actions">
        <button type="button" className="button outline" onClick={onCancel}>
          Cancelar
        </button>
        <SubmitButton busy={busy}>{submit}</SubmitButton>
      </div>
    </Form>
  );
}
export function OrganizationPager({
  page,
  hasMore,
  onChange,
}: {
  page: number;
  hasMore?: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="org-pager">
      <button className="button secondary" disabled={!page} onClick={() => onChange(page - 1)}>
        <ArrowLeft size={15} />
        Anterior
      </button>
      <span>Página {page + 1}</span>
      <button className="button secondary" disabled={!hasMore} onClick={() => onChange(page + 1)}>
        Próxima
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
export function OrganizationLoading() {
  return (
    <p className="org-loading" role="status">
      <LoaderCircle size={18} className="spin" />
      Carregando…
    </p>
  );
}
