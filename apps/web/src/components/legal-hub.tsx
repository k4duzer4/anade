'use client';
import { useState } from 'react';
import { ArrowUpRight, CalendarClock, LockKeyhole, Plus, Scale } from 'lucide-react';
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
  legalNames,
  money,
  options,
  statusNames,
  type LegalCase,
  type Page,
} from '@/lib/organization';
import { shortDay } from '@/lib/community';
import { OrganizationFiles } from './organization-files';
import { SearchBox } from './portal-tools';
import { searchText } from '@/lib/types';
import { DeleteAction } from './delete-action';
export function LegalHub() {
  const { data } = usePortal();
  const [visibility, setVisibility] = useState('legal_team');
  const [version, setVersion] = useState(0),
    [page, setPage] = useState(0),
    [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ type: 'edit' | 'detail'; item?: LegalCase } | null>(null);
  const { value, error } = useOrganization<Page<LegalCase> & { canCreate: boolean }>(
    `/api/legal?page=${page}`,
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
        eyebrow="JURÍDICO · ACESSO RESTRITO"
        title="Cuidar dos detalhes. Proteger o projeto."
        description="Contratos, serviços, processos e intimações do RPG com responsáveis, vigência e prazos."
        action={
          value?.canCreate && (
            <button
              className="button primary"
              onClick={() => (setVisibility('legal_team'), setDialog({ type: 'edit' }))}
            >
              <Plus size={17} />
              Novo registro jurídico
            </button>
          )
        }
      />
      <ErrorNotice message={error} />
      {!value && <OrganizationLoading />}
      <div className="org-toolbar">
        <SearchBox value={search} onChange={setSearch} label="Buscar nos casos desta página" />
        <span>
          <LockKeyhole size={14} />
          Você vê somente os casos autorizados para sua conta.
        </span>
      </div>
      <div className="org-record-grid">
        {value?.records
          .filter((c) =>
            searchText(`${c.title} ${c.reference} ${c.provider}`).includes(searchText(search)),
          )
          .map((c) => (
            <article className="panel org-legal-card" key={c.id}>
              <div className="org-card-heading">
                <Badge>{legalNames[c.type]}</Badge>
                <Badge tone={c.visibility === 'members' ? 'green' : 'gold'}>
                  {c.visibility === 'members' ? 'Disponível aos filiados' : 'Sigiloso · jurídico'}
                </Badge>
                <span className={`org-status ${c.status === 'concluido' ? 'done' : ''}`}>
                  {statusNames[c.status]}
                </span>
              </div>
              <h2>{c.title}</h2>
              <p>{c.reference || 'Sem referência externa'}</p>
              <div className="org-legal-facts">
                <span>
                  <Scale size={16} />
                  {data.members.find((m) => m.id === c.assignedId)?.name || 'Sem responsável'}
                </span>
                <span>
                  <CalendarClock size={16} />
                  {c.dueDate ? `Prazo: ${shortDay(c.dueDate)}` : 'Sem prazo definido'}
                </span>
              </div>
              <button
                className="text-button"
                onClick={() => setDialog({ type: 'detail', item: c })}
              >
                Acompanhar registro
                <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
      </div>
      {value?.records.length === 0 && (
        <section className="panel">
          <Empty>
            <Scale size={28} />
            <h3>Nenhum caso disponível.</h3>
            <p>
              A equipe jurídica define os participantes e os documentos necessários em cada caso.
            </p>
          </Empty>
        </section>
      )}
      {value && <OrganizationPager page={page} hasMore={value.hasMore} onChange={setPage} />}
      {dialog?.type === 'detail' && dialog.item && (
        <Modal title={dialog.item.title} onClose={close}>
          <div className="org-card-heading">
            <Badge>{legalNames[dialog.item.type]}</Badge>
            {value?.canCreate && (
              <button
                className="text-button"
                onClick={() => (
                  setVisibility(dialog.item?.visibility || 'restricted'),
                  setDialog({ type: 'edit', item: dialog.item })
                )}
              >
                Editar registro
              </button>
            )}
          </div>
          <p className="org-body">{dialog.item.body || 'Sem observações.'}</p>
          <dl className="org-detail-grid">
            {[
              ['Referência', dialog.item.reference || 'Não informada'],
              ['Prestador / parte', dialog.item.provider || 'Não informado'],
              [
                'Início da vigência',
                dialog.item.start ? shortDay(dialog.item.start) : 'Não definido',
              ],
              ['Fim da vigência', dialog.item.end ? shortDay(dialog.item.end) : 'Não definido'],
              ['Prazo', dialog.item.dueDate ? shortDay(dialog.item.dueDate) : 'Sem prazo'],
              [
                'Pagamento',
                `${statusNames[dialog.item.paymentStatus]} · ${money(dialog.item.amountCents)}`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="form-description">
            {dialog.item.visibility === 'members'
              ? 'Disponível para os filiados.'
              : dialog.item.visibility === 'legal_team'
                ? 'Sigiloso: acesso somente à equipe jurídica.'
                : 'Sigiloso: acesso aos integrantes do jurídico selecionados.'}{' '}
            O pagamento é um registro de acompanhamento, sem movimentar caixas.
          </p>
          <OrganizationFiles
            kind="legal"
            id={dialog.item.id}
            memberIds={data.members
              .filter(
                (m) =>
                  dialog.item?.visibility === 'members' ||
                  (m.functions?.includes('Jurídico') &&
                    (dialog.item?.visibility === 'legal_team' ||
                      dialog.item?.memberIds.includes(m.id))),
              )
              .map((m) => m.id)}
            canEdit={!!value?.canCreate}
          />
          {value?.canCreate && (
            <div className="content-danger-zone">
              <DeleteAction
                url={`/api/legal/${dialog.item.id}`}
                title={dialog.item.title}
                label="Excluir registro jurídico"
                description="O registro jurídico e todos os documentos anexados serão excluídos do portal."
                requireName
                onDeleted={saved}
              />
            </div>
          )}
        </Modal>
      )}
      {dialog?.type === 'edit' && (
        <Modal
          title={dialog.item ? 'Editar registro jurídico' : 'Novo registro jurídico'}
          onClose={close}
        >
          <OrganizationForm
            url={`/api/legal${dialog.item ? `/${dialog.item.id}` : ''}`}
            method={dialog.item ? 'PUT' : 'POST'}
            onSaved={saved}
            onCancel={close}
            transform={(v, raw) => ({
              ...v,
              amountCents: cents(v.amount),
              assignedId: v.assignedId === 'none' ? '' : v.assignedId,
              memberIds: visibility === 'restricted' ? raw.getAll('memberIds') : [],
            })}
          >
            <div className="form-grid">
              <label className="field full">
                Quem pode consultar
                <Select
                  name="visibility"
                  aria-label="Visibilidade jurídica"
                  value={visibility}
                  onValueChange={setVisibility}
                  options={[
                    { value: 'legal_team', label: 'Sigiloso · somente equipe jurídica' },
                    { value: 'members', label: 'Disponível para todos os filiados' },
                    { value: 'restricted', label: 'Sigiloso · pessoas do jurídico selecionadas' },
                  ]}
                />
                <small>
                  Somente a função Jurídico permite criar ou editar, mesmo em registros disponíveis
                  aos filiados.
                </small>
              </label>
              <label className="field full">
                Título
                <input name="title" required maxLength={200} defaultValue={dialog.item?.title} />
              </label>
              <label className="field">
                Tipo
                <Select
                  name="type"
                  aria-label="Tipo jurídico"
                  defaultValue={dialog.item?.type || 'processo'}
                  options={options(legalNames)}
                />
              </label>
              <label className="field">
                Situação
                <Select
                  name="status"
                  aria-label="Situação jurídica"
                  defaultValue={dialog.item?.status || 'aberto'}
                  options={options({
                    aberto: 'Aberto',
                    em_andamento: 'Em andamento',
                    concluido: 'Concluído',
                  })}
                />
              </label>
              <label className="field full">
                Referência / número
                <input name="reference" maxLength={120} defaultValue={dialog.item?.reference} />
              </label>
              <label className="field full">
                Prestador ou parte envolvida
                <input name="provider" maxLength={200} defaultValue={dialog.item?.provider} />
              </label>
              <label className="field full">
                Detalhes e serviço contratado
                <textarea name="body" maxLength={6000} rows={4} defaultValue={dialog.item?.body} />
              </label>
              <label className="field">
                Início da vigência
                <DateTimePicker
                  dateOnly
                  name="start"
                  label="Início da vigência"
                  defaultValue={dialog.item?.start}
                  placeholder="Sem início"
                />
              </label>
              <label className="field">
                Fim da vigência
                <DateTimePicker
                  dateOnly
                  name="end"
                  label="Fim da vigência"
                  defaultValue={dialog.item?.end}
                  placeholder="Sem término"
                />
              </label>
              <label className="field">
                Prazo de resposta
                <DateTimePicker
                  dateOnly
                  name="dueDate"
                  label="Prazo jurídico"
                  defaultValue={dialog.item?.dueDate}
                  placeholder="Sem prazo"
                />
              </label>
              <label className="field">
                Responsável
                <Select
                  name="assignedId"
                  aria-label="Responsável jurídico"
                  defaultValue={dialog.item?.assignedId || 'none'}
                  options={[
                    { value: 'none', label: 'Sem responsável' },
                    ...data.members
                      .filter((m) => m.functions?.includes('Jurídico'))
                      .map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              </label>
              <label className="field">
                Pagamento
                <Select
                  name="paymentStatus"
                  aria-label="Pagamento"
                  defaultValue={dialog.item?.paymentStatus || 'nao_aplicavel'}
                  options={options({
                    nao_aplicavel: 'Não se aplica',
                    pendente: 'Pendente',
                    pago: 'Pago',
                  })}
                />
              </label>
              <label className="field">
                Valor (R$ do RPG)
                <input
                  name="amount"
                  inputMode="decimal"
                  defaultValue={((dialog.item?.amountCents || 0) / 100).toFixed(2)}
                  pattern="[0-9]+([.,][0-9]{1,2})?"
                />
              </label>
              {visibility === 'restricted' && (
                <>
                  {' '}
                  <div className="full">
                    <MembersPicker
                      label="Pessoas do jurídico com acesso ao caso"
                      members={data.members.filter((m) => m.functions?.includes('Jurídico'))}
                      selected={dialog.item?.memberIds || [data.user.id]}
                    />
                  </div>
                </>
              )}
            </div>
            <p className="form-description">
              O cargo de administrador não abre registros sigilosos nem substitui a função Jurídico.
            </p>
          </OrganizationForm>
        </Modal>
      )}
    </div>
  );
}
