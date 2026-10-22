'use client';
import { useState } from 'react';
import { Landmark, Plus, Pencil, Trash2, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, Empty, ErrorNotice, SubmitButton } from './ui';
import { DirectorForm } from './director-form';
import { type Director } from '@/lib/types';
import { MemberAvatar } from './member-avatar';
const stateNames: Record<string, string> = {
  SP: 'São Paulo',
  MG: 'Minas Gerais',
  RS: 'Rio Grande do Sul',
  BA: 'Bahia',
};
export default function DirectionContent() {
  const { data, mutate, notify } = usePortal();
  const [editing, setEditing] = useState<Director | 'new' | null>(null);
  const [removing, setRemoving] = useState<Director | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!data) return null;
  const directors = [...(data.directors || [])].sort(
    (a, b) =>
      a.position - b.position ||
      a.title.localeCompare(b.title, 'pt-BR') ||
      a.id.localeCompare(b.id),
  );
  const members = data.members;
  const isAdmin = data.user.admin;
  async function remove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!removing) return;
    setBusy(true);
    setError('');
    try {
      await mutate(`/api/directors/${removing.id}`, 'DELETE', {});
      setRemoving(null);
      notify('Diretor removido da composição.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function renderDirector(director: Director, featured = false) {
    const member = members.find((m) => m.id === director.memberId);
    const name = member?.name || 'Ficha indisponível';
    return (
      <article className={`director-card ${featured ? 'is-featured' : ''}`} key={director.id}>
        <Link
          className="director-profile-link"
          href={`/filiados/${encodeURIComponent(director.memberId)}`}
          aria-label={`Ver perfil de ${name}`}
        >
          <MemberAvatar className="director-avatar" name={name} src={member?.avatarUrl} />
          <span className="director-title">{director.title}</span>
          <h3>{name}</h3>
          <span className="director-state">
            {stateNames[member?.state || ''] || member?.state || 'Domicílio não informado'}
          </span>
        </Link>
        {isAdmin && (
          <div className="director-management">
            <button
              type="button"
              onClick={() => setEditing(director)}
              aria-label={`Editar ${director.title} — ${name}`}
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              type="button"
              className="director-remove"
              aria-label={`Remover ${director.title} — ${name}`}
              onClick={() => {
                setError('');
                setRemoving(director);
              }}
            >
              <Trash2 size={13} /> Remover
            </button>
          </div>
        )}
      </article>
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZAÇÃO PARTIDÁRIA"
        title="DIREÇÃO DA ANADE"
        description="Quem organiza nossa aliança e transforma decisões em ação coletiva."
        action={
          data.user.admin && (
            <button className="button primary" onClick={() => setEditing('new')}>
              <Plus size={17} /> Adicionar diretor
            </button>
          )
        }
      />
      <section className="direction-banner">
        <div className="direction-banner-emblem" aria-hidden="true">
          <Landmark size={35} strokeWidth={1.2} />
        </div>
        <div className="direction-banner-copy">
          <span>ALIANÇA NACIONAL DEMOCRÁTICA</span>
          <h2>
            Construir juntos.
            <br />
            <em>Conduzir com propósito.</em>
          </h2>
          <p>Conheça as pessoas e as responsabilidades que compõem a direção do partido.</p>
        </div>
        <div className="direction-total">
          <Users size={18} />
          <strong>
            {new Set(directors.map((d) => d.memberId)).size.toString().padStart(2, '0')}
          </strong>
          <span>pessoas na direção</span>
        </div>
        <span className="direction-watermark" aria-hidden="true">
          10
        </span>
      </section>
      <div className="direction-section-title">
        <span className="eyebrow">COMPOSIÇÃO DO DIRETÓRIO</span>
        <span>
          {directors.length} cargo{directors.length === 1 ? '' : 's'} ocupado
          {directors.length === 1 ? '' : 's'}
        </span>
      </div>
      {directors.length ? (
        <section className="direction-directory" aria-label="Composição do diretório">
          <div
            className="direction-grid direction-featured"
            role="group"
            aria-label="Primeira fileira da direção"
          >
            {directors.slice(0, 4).map((director) => renderDirector(director, true))}
          </div>
          {directors.length > 4 && (
            <div
              className="direction-grid direction-members"
              role="group"
              aria-label="Demais integrantes da direção"
            >
              {directors.slice(4).map((director) => renderDirector(director))}
            </div>
          )}
        </section>
      ) : (
        <section className="panel full">
          <Empty>
            <Landmark size={32} />
            <h3>A direção será apresentada aqui.</h3>
            <p>
              {data.user.admin
                ? 'Adicione os filiados que ocupam cargos na organização do partido.'
                : 'A administração ainda não publicou a composição do diretório.'}
            </p>
            {data.user.admin && (
              <button className="button primary" onClick={() => setEditing('new')}>
                <Plus size={16} /> Adicionar primeiro diretor
              </button>
            )}
          </Empty>
        </section>
      )}
      <p className="page-note">
        <ShieldCheck size={15} /> Composição publicada pela administração · Visível apenas aos
        filiados.
      </p>
      {editing && (
        <Modal
          title={editing === 'new' ? 'ADICIONAR DIRETOR' : 'EDITAR DIRETOR'}
          onClose={() => setEditing(null)}
        >
          <DirectorForm
            director={editing === 'new' ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}
      {removing && (
        <Modal
          title="REMOVER DA DIREÇÃO"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <form onSubmit={remove}>
            <p className="form-description">
              Remover{' '}
              <strong>
                {data.members.find((m) => m.id === removing.memberId)?.name || 'este filiado'}
              </strong>{' '}
              do cargo de <strong>{removing.title}</strong>?
            </p>
            <p className="form-description">
              A ficha e a filiação serão mantidas. Você poderá adicionar esse diretor novamente.
            </p>
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setRemoving(null)}
              >
                Cancelar
              </button>
              <SubmitButton busy={busy}>Remover diretor</SubmitButton>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
