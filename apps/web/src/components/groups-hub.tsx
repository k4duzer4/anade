'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  CalendarDays,
  Landmark,
  LockKeyhole,
  Pencil,
  Plus,
  Users,
  Vote,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, Empty, ErrorNotice, Badge } from './ui';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import { MemberAvatar } from './member-avatar';
import {
  MembersPicker,
  OrganizationForm,
  OrganizationLoading,
  OrganizationPager,
  useOrganization,
} from './organization-ui';
import {
  groupNames,
  noteNames,
  options,
  type Group,
  type GroupNote,
  type Page,
} from '@/lib/organization';
import { shortDay } from '@/lib/community';
import { SearchBox } from './portal-tools';
import { searchText } from '@/lib/types';

export function GroupsHub({ caucus = false }: { caucus?: boolean }) {
  const { data } = usePortal(),
    params = useSearchParams();
  const [version, setVersion] = useState(0),
    [page, setPage] = useState(0),
    [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{
    type: 'group' | 'note';
    group?: Group;
    note?: GroupNote;
  } | null>(null);
  const { value: result, error } = useOrganization<{ records: Group[] }>(
    '/api/groups',
    `${version}:${data?.serverTime}`,
  );
  const groups =
    result?.records.filter((g) => !caucus || ['camara', 'senado'].includes(g.type)) || [];
  const selected = groups.find((g) => g.id === params.get('grupo'));
  const { value: notes, error: notesError } = useOrganization<Page<GroupNote>>(
    selected?.canAccess ? `/api/groups/${selected.id}/notes?page=${page}` : null,
    version,
  );
  if (!data) return null;
  const path = caucus ? '/bancadas' : '/grupos';
  const close = () => setDialog(null),
    saved = () => {
      setVersion((v) => v + 1);
      close();
    };
  return (
    <div className="refresh-page org-page">
      <PageHeading
        eyebrow={caucus ? 'ESPAÇO DAS BANCADAS' : 'ORGANIZAÇÃO · ANADE'}
        title={caucus ? 'Uma bancada. Uma direção.' : 'Cada equipe, um propósito.'}
        description={
          caucus
            ? 'Parlamentares, liderança e prioridades legislativas em um só lugar.'
            : 'Grupos de trabalho, diretórios estaduais e equipes com participantes definidos.'
        }
        action={
          data.user.admin && (
            <button className="button primary" onClick={() => setDialog({ type: 'group' })}>
              <Plus size={17} />
              Criar grupo
            </button>
          )
        }
      />
      <ErrorNotice message={error || notesError} />
      {!result && <OrganizationLoading />}
      <div className="org-toolbar">
        <SearchBox label="Buscar grupo" value={search} onChange={setSearch} />
        <span>{groups.length} grupos · participação definida pela administração</span>
      </div>
      <div className="org-group-grid">
        {groups
          .filter((g) => searchText(`${g.name} ${g.state}`).includes(searchText(search)))
          .map((g) => (
            <article
              className={`panel org-group-card ${selected?.id === g.id ? 'is-selected' : ''}`}
              key={g.id}
            >
              <div className="org-card-heading">
                <span className="org-symbol">
                  <Landmark size={22} />
                </span>
                <Badge>
                  {groupNames[g.type]}
                  {g.state ? ` · ${g.state}` : ''}
                </Badge>
              </div>
              <h2>{g.name}</h2>
              <p>{g.description || 'Um espaço para organizar o trabalho da nossa aliança.'}</p>
              <span className="org-meta">
                <Users size={15} />
                {g.memberIds.length} participantes
              </span>
              <div className="org-card-actions">
                {g.canAccess ? (
                  <Link
                    className="text-button"
                    href={`${path}?grupo=${g.id}#grupo-${g.id}`}
                    onClick={() => setPage(0)}
                  >
                    Entrar no grupo
                    <ArrowUpRight size={15} />
                  </Link>
                ) : (
                  <span className="org-meta">
                    <LockKeyhole size={14} />
                    Somente participantes
                  </span>
                )}
                {data.user.admin && (
                  <button
                    className="icon-button"
                    aria-label={`Editar ${g.name}`}
                    onClick={() => setDialog({ type: 'group', group: g })}
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
      </div>
      {selected?.canAccess && (
        <section className="org-workspace" key={selected.id} id={`grupo-${selected.id}`}>
          <header className="org-workspace-heading">
            <div>
              <span className="eyebrow">ESPAÇO DO GRUPO</span>
              <h2>{selected.name}</h2>
              <p>
                Liderança:{' '}
                {data.members.find((m) => m.id === selected.leaderId)?.name || 'Ainda não definida'}
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => setDialog({ type: 'note', group: selected })}
            >
              <Plus size={17} />
              Novo registro
            </button>
          </header>
          <div className="org-quicklinks">
            <Link href={`/agenda?grupo=${selected.id}`}>
              <CalendarDays size={17} />
              Reuniões do grupo
            </Link>
            <Link href={`/votacoes?grupo=${selected.id}`}>
              <Vote size={17} />
              Votações do grupo
            </Link>
          </div>
          <details className="panel org-participants">
            <summary>Participantes · {selected.memberIds.length}</summary>
            <div>
              {data.members
                .filter((m) => selected.memberIds.includes(m.id))
                .map((m) => (
                  <Link href={`/filiados/${m.id}`} key={m.id}>
                    <MemberAvatar name={m.name} src={m.avatarUrl} />
                    <span>
                      {m.name}
                      {m.id === selected.leaderId && <small>Liderança</small>}
                    </span>
                  </Link>
                ))}
            </div>
          </details>
          <div className="org-record-grid">
            {notes?.records
              .filter((n) => n.groupId === selected.id)
              .map((n) => (
                <article className="panel org-note-card" key={n.id}>
                  <div className="org-card-heading">
                    <Badge>{noteNames[n.type]}</Badge>
                    <span className={`org-status ${n.status === 'concluido' ? 'done' : ''}`}>
                      {n.status === 'concluido' ? 'Concluído' : 'Em aberto'}
                    </span>
                  </div>
                  <h3>{n.title}</h3>
                  <p className="org-body">{n.body}</p>
                  <div className="org-note-footer">
                    <span>
                      {n.assignedId
                        ? `Responsável: ${data.members.find((m) => m.id === n.assignedId)?.name || 'Filiado'}`
                        : 'Sem responsável'}
                      {n.dueDate && ` · Até ${shortDay(n.dueDate)}`}
                    </span>
                    {(data.user.admin ||
                      selected.leaderId === data.user.id ||
                      n.authorId === data.user.id) && (
                      <button
                        className="text-button"
                        onClick={() => setDialog({ type: 'note', group: selected, note: n })}
                      >
                        Editar registro
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {notes?.records.length === 0 && (
            <section className="panel">
              <Empty>
                <Landmark size={26} />
                <h3>O trabalho começa aqui.</h3>
                <p>Registre pautas, prioridades, negociações e orientações de voto.</p>
              </Empty>
            </section>
          )}
          {notes && <OrganizationPager page={page} hasMore={notes.hasMore} onChange={setPage} />}
        </section>
      )}
      {dialog?.type === 'group' && (
        <Modal title={dialog.group ? 'Editar grupo' : 'Criar grupo'} onClose={close}>
          <GroupEditor group={dialog.group} onSaved={saved} onCancel={close} />
        </Modal>
      )}
      {dialog?.type === 'note' && dialog.group && (
        <Modal title={dialog.note ? 'Editar registro' : 'Novo registro do grupo'} onClose={close}>
          <OrganizationForm
            url={`/api/groups/${dialog.group.id}/notes${dialog.note ? `/${dialog.note.id}` : ''}`}
            method={dialog.note ? 'PUT' : 'POST'}
            onSaved={saved}
            onCancel={close}
            transform={(v, raw) => ({
              ...v,
              assignedId: v.assignedId === 'none' ? '' : v.assignedId,
              mentionIds: raw.getAll('mentionIds'),
            })}
          >
            <div className="form-grid">
              <label className="field full">
                Título
                <input name="title" required maxLength={200} defaultValue={dialog.note?.title} />
              </label>
              <label className="field">
                Tipo
                <Select
                  name="type"
                  aria-label="Tipo de registro"
                  defaultValue={dialog.note?.type || 'pauta'}
                  options={options(noteNames)}
                />
              </label>
              <label className="field">
                Situação
                <Select
                  name="status"
                  aria-label="Situação do registro"
                  defaultValue={dialog.note?.status || 'aberto'}
                  options={[
                    { value: 'aberto', label: 'Em aberto' },
                    { value: 'concluido', label: 'Concluído' },
                  ]}
                />
              </label>
              <label className="field full">
                Detalhes
                <textarea name="body" maxLength={6000} rows={4} defaultValue={dialog.note?.body} />
              </label>
              <label className="field">
                Responsável
                <Select
                  name="assignedId"
                  aria-label="Responsável"
                  defaultValue={dialog.note?.assignedId || 'none'}
                  options={[
                    { value: 'none', label: 'Sem responsável' },
                    ...data.members
                      .filter((m) => dialog.group?.memberIds.includes(m.id))
                      .map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              </label>
              <label className="field">
                Prazo
                <DateTimePicker
                  dateOnly
                  name="dueDate"
                  label="Prazo do registro"
                  defaultValue={dialog.note?.dueDate}
                  placeholder="Sem prazo"
                />
              </label>
              <div className="full">
                <MembersPicker
                  name="mentionIds"
                  label="Mencionar participantes"
                  members={data.members.filter((m) => dialog.group?.memberIds.includes(m.id))}
                  selected={dialog.note?.mentionIds}
                />
              </div>
            </div>
          </OrganizationForm>
        </Modal>
      )}
    </div>
  );
}
function GroupEditor({
  group,
  onSaved,
  onCancel,
}: {
  group?: Group;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { data, config } = usePortal();
  const [type, setType] = useState(group?.type || 'outro');
  if (!data) return null;
  return (
    <OrganizationForm
      url={`/api/groups${group ? `/${group.id}` : ''}`}
      method={group ? 'PUT' : 'POST'}
      onSaved={onSaved}
      onCancel={onCancel}
      transform={(v, raw) => ({
        ...v,
        leaderId: v.leaderId === 'none' ? '' : v.leaderId,
        memberIds: raw.getAll('memberIds'),
      })}
    >
      <p className="form-description">
        Escolha participantes reais. O cargo informado na ficha do personagem não concede acesso
        automaticamente.
      </p>
      <div className="form-grid">
        <label className="field full">
          Nome
          <input name="name" required maxLength={120} defaultValue={group?.name} />
        </label>
        <label className="field">
          Tipo
          <Select
            name="type"
            aria-label="Tipo de grupo"
            value={type}
            onValueChange={setType}
            options={options(groupNames)}
          />
        </label>
        {type === 'estadual' && (
          <label className="field">
            Estado
            <Select
              name="state"
              required
              aria-label="Estado do diretório"
              defaultValue={group?.state || undefined}
              options={(config?.states || []).map((s) => ({ value: s, label: s }))}
            />
          </label>
        )}
        <label className="field full">
          Descrição
          <textarea
            name="description"
            maxLength={2000}
            rows={3}
            defaultValue={group?.description}
          />
        </label>
        <label className="field full">
          Liderança
          <Select
            name="leaderId"
            aria-label="Liderança"
            defaultValue={group?.leaderId || 'none'}
            options={[
              { value: 'none', label: 'Ainda não definida' },
              ...data.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <small>A liderança precisa estar marcada entre os participantes.</small>
        </label>
        <div className="full">
          <MembersPicker members={data.members} selected={group?.memberIds} />
        </div>
      </div>
    </OrganizationForm>
  );
}
