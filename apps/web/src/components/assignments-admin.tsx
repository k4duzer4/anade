'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ContactRound, ShieldCheck, Search } from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, ErrorNotice, Empty } from './ui';
import { Select } from './select';
import { OrganizationForm, OrganizationLoading, useOrganization } from './organization-ui';
import { MemberAvatar } from './member-avatar';
import { searchText } from '@/lib/types';
type Assignment = {
  office: string;
  officeState: string;
  functions: string[];
  functionState: string;
};
type Account = { id: string; name: string; discord: string };
export function AssignmentsAdmin() {
  const { data } = usePortal(),
    params = useSearchParams();
  const [selected, setSelected] = useState(params.get('membro') || ''),
    [search, setSearch] = useState('');
  const { value, error } = useOrganization<{ accounts: Account[] }>(
    data?.user.admin ? '/api/admin/accounts' : null,
  );
  if (!data?.user.admin) return <Empty>Esta área é exclusiva para administradores.</Empty>;
  const account = value?.accounts.find((a) => a.id === selected);
  return (
    <div className="refresh-page">
      <PageHeading
        eyebrow="ADMINISTRAÇÃO · ATRIBUIÇÕES"
        title="Cada pessoa, seu papel."
        description="Defina o cargo eletivo e as funções partidárias. Essas atribuições controlam o acesso e a participação no portal."
        action={
          <Link className="button secondary" href="/administracao">
            <ArrowLeft size={16} />
            Voltar à administração
          </Link>
        }
      />
      <ErrorNotice message={error} />
      <p className="assignment-notice">
        <ShieldCheck size={19} />
        Sem cargo ou função atribuídos, a pessoa é membro comum. O perfil não permite alterar essas
        permissões. A administração do site é uma permissão separada.
      </p>
      <div className="assignment-admin-layout">
        <section className="panel assignment-accounts">
          <label className="org-picker-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar conta para atribuir cargo"
              placeholder="Nome, Discord ou ID"
            />
          </label>
          {!value && <OrganizationLoading />}
          <div>
            {value?.accounts
              .filter((a) =>
                searchText(`${a.name} ${a.discord} ${a.id}`).includes(searchText(search)),
              )
              .map((a) => (
                <button
                  type="button"
                  aria-pressed={selected === a.id}
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                >
                  <MemberAvatar
                    name={a.name || a.discord}
                    src={data.members.find((m) => m.id === a.id)?.avatarUrl}
                  />
                  <span>
                    <strong>{a.name || a.discord}</strong>
                    <small>@{a.discord}</small>
                  </span>
                </button>
              ))}
          </div>
        </section>
        <section className="panel assignment-editor">
          {account ? (
            <AssignmentEditor key={account.id} account={account} />
          ) : (
            <Empty>
              <ContactRound size={29} />
              <h2>Escolha uma pessoa.</h2>
              <p>Selecione uma conta para consultar ou alterar suas atribuições.</p>
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}
function AssignmentEditor({ account }: { account: Account }) {
  const { config, notify } = usePortal();
  const [version, setVersion] = useState(0);
  const { value, error } = useOrganization<{ assignment: Assignment }>(
    `/api/admin/assignments/${account.id}`,
    version,
  );
  if (!value)
    return (
      <>
        <ErrorNotice message={error} />
        <OrganizationLoading />
      </>
    );
  const role = value.assignment;
  return (
    <>
      <header>
        <span className="eyebrow">ATRIBUIÇÕES OFICIAIS</span>
        <h2>{account.name || account.discord}</h2>
        <p>
          @{account.discord} · {account.id}
        </p>
      </header>
      <OrganizationForm
        key={version}
        url={`/api/admin/assignments/${account.id}`}
        method="PUT"
        submit="Salvar cargo e funções"
        onSaved={() => {
          setVersion((v) => v + 1);
          notify('Cargo e funções atualizados.');
        }}
        onCancel={() => setVersion((v) => v + 1)}
        transform={(v, raw) => ({
          ...v,
          office: v.office === 'none' ? '' : v.office,
          officeState: v.officeState === 'none' ? '' : v.officeState,
          functionState: v.functionState === 'none' ? '' : v.functionState,
          functions: raw.getAll('functions'),
        })}
      >
        <div className="form-grid">
          <label className="field full">
            Cargo eletivo
            <Select
              name="office"
              aria-label="Cargo eletivo"
              defaultValue={role.office || 'none'}
              options={[
                { value: 'none', label: 'Sem cargo · membro comum' },
                ...(config?.electoralOffices || []).map((s) => ({ value: s, label: s })),
              ]}
            />
          </label>
          <label className="field full">
            Estado do cargo
            <Select
              name="officeState"
              aria-label="Estado do cargo"
              defaultValue={role.officeState || 'none'}
              options={[
                { value: 'none', label: 'Nacional / não se aplica' },
                ...(config?.states || []).map((s) => ({ value: s, label: s })),
              ]}
            />
          </label>
          <fieldset className="assignment-functions full">
            <legend>Funções dentro do partido</legend>
            <p>
              A pessoa pode acumular funções. Desmarque todas para retirar as funções partidárias.
            </p>
            {(config?.partyFunctions || []).map((f) => (
              <label key={f}>
                <input
                  type="checkbox"
                  name="functions"
                  value={f}
                  defaultChecked={role.functions.includes(f)}
                />
                <span>{f}</span>
              </label>
            ))}
          </fieldset>
          <label className="field full">
            Estado da função partidária
            <Select
              name="functionState"
              aria-label="Estado da função partidária"
              defaultValue={role.functionState || 'none'}
              options={[
                { value: 'none', label: 'Nacional / não se aplica' },
                ...(config?.states || []).map((s) => ({ value: s, label: s })),
              ]}
            />
            <small>Obrigatório para presidente estadual e coordenador estadual.</small>
          </label>
        </div>
        <p className="assignment-notice">
          Deputado federal vota na Câmara; senador vota no Senado. Jurídico autoriza a gestão
          jurídica. Financeiro ou Tesoureiro autoriza movimentações e comprovantes. Essas funções
          também são exigidas dos administradores para atuar nessas áreas.
        </p>
      </OrganizationForm>
    </>
  );
}
