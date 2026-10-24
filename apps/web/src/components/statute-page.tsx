'use client';
import { useState } from 'react';
import { ArrowUpRight, BookOpen, FileText, Pencil, ShieldCheck } from 'lucide-react';
import { usePortal } from './portal-provider';
import { PageHeading, Modal, ErrorNotice } from './ui';
import { OrganizationForm, OrganizationLoading, useOrganization } from './organization-ui';
import { formatDate } from '@/lib/types';
export type Statute = {
  title: string;
  body: string;
  url: string;
  published: boolean;
  updatedAt: string | null;
};
export function StatutePage() {
  const { data } = usePortal(),
    [version, setVersion] = useState(0),
    [editing, setEditing] = useState(false);
  const { value, error } = useOrganization<Statute>('/api/statute', version);
  if (!data) return null;
  return (
    <div className="refresh-page statute-page">
      <PageHeading
        eyebrow="ORGANIZAÇÃO · DOCUMENTO PARTIDÁRIO"
        title="Estatuto da ANADE."
        description="As regras, os princípios e os compromissos da nossa aliança."
        action={
          data.user.admin &&
          value && (
            <button className="button primary" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              {value.published ? 'Editar estatuto' : 'Preparar estatuto'}
            </button>
          )
        }
      />
      <ErrorNotice message={error} />
      {!value && <OrganizationLoading />}
      {value && !value.published && (
        <section className="panel statute-placeholder">
          <span className="statute-symbol">
            <BookOpen size={40} strokeWidth={1.3} />
          </span>
          <span className="eyebrow">EM ELABORAÇÃO</span>
          <h2>Uma aliança também se constrói com princípios.</h2>
          <p>
            Este é o espaço do estatuto da ANADE. Assim que o documento estiver pronto, a
            administração poderá publicá-lo aqui para os filiados.
          </p>
          <span className="statute-status">
            <ShieldCheck size={16} />
            Aguardando publicação oficial
          </span>
        </section>
      )}
      {value && (value.published || (data.user.admin && (value.body || value.url))) && (
        <article className="panel statute-document">
          <header>
            <span className="eyebrow">
              {value.published ? 'DOCUMENTO OFICIAL' : 'RASCUNHO · VISÍVEL SOMENTE AO ADM'}
            </span>
            <h2>{value.title}</h2>
            {value.updatedAt && <p>Última atualização: {formatDate(value.updatedAt, true)}</p>}
          </header>
          {value.body && <div className="statute-body">{value.body}</div>}
          {value.url && (
            <a
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary"
            >
              <FileText size={16} />
              Abrir documento do estatuto
              <ArrowUpRight size={15} />
            </a>
          )}
        </article>
      )}
      {editing && value && (
        <Modal title="Preparar estatuto" onClose={() => setEditing(false)}>
          <OrganizationForm
            url="/api/statute"
            method="PUT"
            submit="Salvar estatuto"
            onSaved={() => {
              setEditing(false);
              setVersion((v) => v + 1);
            }}
            onCancel={() => setEditing(false)}
            transform={(v, raw) => ({ ...v, published: raw.get('published') === 'on' })}
          >
            <p className="form-description">
              Salve como rascunho enquanto estiver em elaboração. Os filiados verão o conteúdo
              somente depois de publicar.
            </p>
            <label className="field">
              Título
              <input name="title" defaultValue={value.title} maxLength={160} required />
            </label>
            <label className="field">
              Texto do estatuto
              <textarea
                name="body"
                defaultValue={value.body}
                maxLength={40000}
                rows={12}
                placeholder="Adicione o texto aprovado quando estiver pronto."
              />
            </label>
            <label className="field">
              Link do documento (opcional)
              <input
                name="url"
                type="url"
                defaultValue={value.url}
                maxLength={2048}
                placeholder="https://"
              />
            </label>
            <label className="statute-publish">
              <input type="checkbox" name="published" defaultChecked={value.published} />
              <span>
                Publicar para todos os filiados
                <small>Exige texto ou link. Desmarque para manter em elaboração.</small>
              </span>
            </label>
          </OrganizationForm>
        </Modal>
      )}
    </div>
  );
}
