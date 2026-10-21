'use client';
import { useState } from 'react';
import { m } from 'motion/react';
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  AtSign,
  MapPin,
  ArrowUpRight,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, Empty, ErrorNotice, SubmitButton } from './ui';
import { DirectorForm } from './director-form';
import { initials, type Director } from '@/lib/types';
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
      <div className="direction-grid">
        {directors.length ? (
          directors.map((director, index) => {
            const member = data.members.find((m) => m.id === director.memberId);
            return (
              <m.article
                className="director-card"
                key={director.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="director-card-header">
                  <span className="director-seal">
                    <Landmark size={17} /> ANA<span>DE</span>
                  </span>
                  <span className="director-index">
                    {String(index + 1).padStart(2, '0')} <i /> DIREÇÃO
                  </span>
                </div>
                <div className="director-identity">
                  <div className="director-avatar">{initials(member?.name || 'ANADE')}</div>
                  <div>
                    <span className="director-title">{director.title}</span>
                    <h3>{member?.name || 'Ficha indisponível'}</h3>
                    <span className="director-blue">
                      <AtSign size={12} />
                      {member?.blue?.replace(/^@/, '') || 'Blue não informado'}
                    </span>
                  </div>
                </div>
                <div className="director-responsibility">
                  <span>ÁREA DE ATUAÇÃO</span>
                  <p>
                    {director.responsibility ||
                      'As responsabilidades deste cargo serão publicadas pela administração.'}
                  </p>
                </div>
                <div className="director-footer">
                  <span>
                    <MapPin size={13} /> {member?.state || '—'} <i /> {member?.season || 'ANADE'}
                  </span>
                  <Link
                    href={`/filiados/${encodeURIComponent(director.memberId)}`}
                    aria-label={`Ver perfil de ${member?.name || 'este diretor'}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
                {data.user.admin && (
                  <div className="director-management">
                    <button className="text-button" onClick={() => setEditing(director)}>
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      className="text-button director-remove"
                      onClick={() => {
                        setError('');
                        setRemoving(director);
                      }}
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                )}
              </m.article>
            );
          })
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
      </div>
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
