'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  FileText,
  FolderOpen,
  ImagePlus,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { usePortal } from './portal-provider';
import { Empty, ErrorNotice, Modal, SubmitButton } from './ui';
import { Select } from './select';
import { Form } from './form';
import { DeleteAction } from './delete-action';
import { portalRequest } from '@/lib/portal-request';

const categories = [
  { value: 'logos', label: 'Logos e identidade' },
  { value: 'panfletos', label: 'Panfletos' },
  { value: 'redes', label: 'Redes sociais' },
  { value: 'apresentacoes', label: 'Apresentações' },
  { value: 'outros', label: 'Outros materiais' },
];
type Material = {
  id: string;
  title: string;
  description: string;
  category: string;
  fileName: string;
  mime: string;
  bytes: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  previewUrl: string | null;
};
type Library = {
  records: Material[];
  total: number;
  hasMore: boolean;
  page: number;
  storageReady: boolean;
};
const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const categoryLabel = (value: string) =>
  categories.find((c) => c.value === value)?.label || 'Material';
const fileType = (mime: string) =>
  mime === 'application/pdf' ? 'PDF' : mime.split('/')[1].toUpperCase().replace('JPEG', 'JPG');

export function MaterialsHub() {
  const { data, mutate, notify } = usePortal();
  const [category, setCategory] = useState(''),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState('');
  const [page, setPage] = useState(0),
    [version, setVersion] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    value: Library | null;
    error: string;
  } | null>(null);
  const requestUrl = `/api/materials?${new URLSearchParams({ category, search: query, page: String(page) })}`;
  const requestKey = `${requestUrl}#${version}`;
  const loading = response?.key !== requestKey;
  const library = !loading ? response?.value : null;
  const loadError = !loading ? response?.error || '' : '';
  const [editor, setEditor] = useState<'new' | Material | null>(null),
    [preview, setPreview] = useState<Material | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const abort = new AbortController();
    portalRequest<Library>(requestUrl, { signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) setResponse({ key: requestKey, value, error: '' });
      })
      .catch((e) => {
        if (!abort.signal.aborted) setResponse({ key: requestKey, value: null, error: e.message });
      });
    return () => abort.abort();
  }, [requestUrl, requestKey]);
  if (!data) return null;
  const refresh = () => {
    setPage(0);
    setVersion((v) => v + 1);
  };
  const admin = data.user.admin;
  return (
    <div className="materials-page">
      <header className="materials-heading">
        <div>
          <span className="eyebrow">COMUNICAÇÃO · ANADE</span>
          <h1>
            Acervo de comunicação<span>.</span>
          </h1>
          <p>A identidade da nossa aliança, pronta para circular.</p>
        </div>
        {admin && (
          <button
            className="button primary"
            onClick={() => setEditor('new')}
            disabled={!library?.storageReady}
          >
            <Plus size={17} /> Adicionar material
          </button>
        )}
      </header>
      <section className="materials-intro">
        <div className="materials-intro-copy">
          <span className="materials-intro-icon">
            <Layers size={25} />
          </span>
          <div>
            <span className="eyebrow">UMA ALIANÇA, A MESMA IDENTIDADE</span>
            <h2>Encontre. Baixe. Compartilhe.</h2>
            <p>Logos, peças de campanha e materiais institucionais reunidos em um só lugar.</p>
          </div>
        </div>
        <div className="materials-intro-seal">
          <ShieldCheck size={18} />
          <span>
            Acervo do partido<small>Materiais publicados pela administração</small>
          </span>
        </div>
      </section>
      <nav className="materials-categories" aria-label="Categorias do acervo">
        {[{ value: '', label: 'Todo o acervo' }, ...categories].map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={category === c.value}
            onClick={() => {
              setCategory(c.value);
              setPage(0);
            }}
          >
            <span>
              {c.value === '' && <FolderOpen size={16} />} {c.label}
            </span>
            {category === c.value && <span className="materials-category-dot" />}
          </button>
        ))}
      </nav>
      <div className="materials-toolbar">
        <div>
          <h2>{category ? categoryLabel(category) : 'Todos os materiais'}</h2>
          <span aria-live="polite">
            {loading
              ? 'Consultando acervo…'
              : `${library?.total || 0} ${(library?.total || 0) === 1 ? 'material disponível' : 'materiais disponíveis'}`}
          </span>
        </div>
        <label className="materials-search">
          <Search size={17} />
          <input
            type="search"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no acervo"
            aria-label="Buscar materiais"
          />
          {search && (
            <button aria-label="Limpar busca" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </label>
      </div>
      <ErrorNotice message={loadError} />
      {loadError && (
        <button className="button secondary" onClick={() => setVersion((v) => v + 1)}>
          Tentar novamente
        </button>
      )}
      {library && !library.storageReady && admin && (
        <p className="connection-error">
          O armazenamento precisa ser configurado para receber novos materiais.
        </p>
      )}
      {loading ? (
        <div className="materials-loading" role="status">
          <LoaderCircle className="spin" size={24} /> Preparando o acervo…
        </div>
      ) : !loadError && library && !library.records.length ? (
        <section className="materials-empty">
          <Empty>
            <span className="materials-empty-icon">
              <FolderOpen size={34} />
            </span>
            <h3>
              {query || category ? 'Nenhum material encontrado.' : 'Nossa identidade começa aqui.'}
            </h3>
            <p>
              {query || category
                ? 'Tente outra busca ou consulte todas as categorias.'
                : admin
                  ? 'Publique a primeira logo, panfleto ou peça de comunicação da ANADE.'
                  : 'Os materiais publicados pela administração aparecerão aqui.'}
            </p>
            {query || category ? (
              <button
                className="button secondary"
                onClick={() => {
                  setSearch('');
                  setQuery('');
                  setCategory('');
                  setPage(0);
                }}
              >
                Ver todo o acervo
              </button>
            ) : (
              admin &&
              library.storageReady && (
                <button className="button primary" onClick={() => setEditor('new')}>
                  <Plus size={16} /> Publicar primeiro material
                </button>
              )
            )}
          </Empty>
        </section>
      ) : (
        !loadError && (
          <div className="materials-grid">
            {library?.records.map((item) => (
              <article className="material-card" key={item.id}>
                <button
                  className={`material-cover ${item.previewUrl ? 'is-image' : 'is-document'}`}
                  onClick={() => setPreview(item)}
                  aria-label={`Visualizar ${item.title}`}
                >
                  {item.previewUrl ? (
                    <Image
                      src={item.previewUrl}
                      alt={item.title}
                      fill
                      unoptimized
                      sizes="(max-width: 650px) 100vw, (max-width: 1100px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="material-document">
                      <FileText size={44} />
                      <span>DOCUMENTO PDF</span>
                    </div>
                  )}
                  <span className="material-cover-type">{fileType(item.mime)}</span>
                  <span className="material-cover-action">
                    <ArrowUpRight size={18} />
                  </span>
                </button>
                <div className="material-body">
                  <span className="material-category">{categoryLabel(item.category)}</span>
                  <button className="material-title" onClick={() => setPreview(item)}>
                    <h3>{item.title}</h3>
                  </button>
                  <p>{item.description || 'Material de comunicação da ANADE.'}</p>
                  <div className="material-file-info">
                    <span>
                      {fileType(item.mime)} · {sizeLabel(item.bytes)}
                    </span>
                    <span>
                      {new Date(item.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </span>
                  </div>
                  <a
                    className="button secondary material-download"
                    href={item.downloadUrl}
                    download
                  >
                    <ArrowDownToLine size={16} /> Baixar original
                  </a>
                  {admin && (
                    <div className="material-management">
                      <button
                        className="text-button"
                        onClick={() => setEditor(item)}
                        aria-label={`Editar ${item.title}`}
                      >
                        <Pencil size={13} /> Editar
                      </button>
                      <DeleteAction
                        url={`/api/materials/${item.id}`}
                        title={item.title}
                        description="O material será retirado do acervo e deixará de estar disponível para download."
                        onDeleted={refresh}
                      />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )
      )}
      {library && !loading && (page > 0 || library.hasMore) && (
        <div className="materials-pagination">
          <button
            className="button outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span>Página {page + 1}</span>
          <button
            className="button outline"
            disabled={!library.hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      )}
      <footer className="materials-footnote">
        <ShieldCheck size={15} />
        <span>Disponível para os filiados. A administração organiza e atualiza este acervo.</span>
      </footer>
      {editor && (
        <MaterialEditor
          key={typeof editor === 'string' ? 'new' : editor.id}
          item={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
            notify('Material salvo no acervo.');
          }}
          mutate={mutate}
        />
      )}
      {preview && (
        <Modal
          title={preview.title}
          onClose={() => setPreview(null)}
          className="material-preview-dialog"
        >
          <div className={`material-preview ${preview.previewUrl ? 'is-image' : ''}`}>
            {preview.previewUrl ? (
              <Image
                src={preview.previewUrl}
                alt={preview.title}
                width={1400}
                height={1000}
                unoptimized
                style={{ width: '100%', height: 'auto', maxHeight: '55vh', objectFit: 'contain' }}
              />
            ) : (
              <>
                <FileText size={52} />
                <p>Documento em PDF</p>
                <span>Baixe o arquivo para consultar ou imprimir.</span>
              </>
            )}
          </div>
          <span className="material-category">{categoryLabel(preview.category)}</span>
          {preview.description && (
            <p className="material-preview-description">{preview.description}</p>
          )}
          <p className="form-description">
            {preview.fileName} · {sizeLabel(preview.bytes)} · {fileType(preview.mime)}
          </p>
          <a href={preview.downloadUrl} download className="button primary">
            <ArrowDownToLine size={16} /> Baixar arquivo original
          </a>
        </Modal>
      )}
    </div>
  );
}

function MaterialEditor({
  item,
  onClose,
  onSaved,
  mutate,
}: {
  item?: Material;
  onClose: () => void;
  onSaved: () => void;
  mutate: (url: string, method: string, body: unknown) => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function chooseFile(value?: File) {
    if (!value) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(value.type)) {
      setError('Escolha PNG, JPG, WebP ou PDF.');
      return;
    }
    if (value.size > 4 * 1024 * 1024) {
      setError('Cada arquivo deve ter até 4 MB.');
      return;
    }
    setFile(value);
    setPreview(value.type.startsWith('image/') ? URL.createObjectURL(value) : '');
    setError('');
  }
  return (
    <Modal
      title={item ? 'Editar material' : 'Adicionar ao acervo'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="form-description">
        {item
          ? 'Atualize as informações para facilitar a busca no acervo.'
          : 'Publique um arquivo para os filiados visualizarem e baixarem.'}
      </p>
      <Form
        className="material-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (!item && !file) {
            setError('Escolha um arquivo para publicar.');
            return;
          }
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError('');
          try {
            if (item)
              await mutate(`/api/materials/${item.id}`, 'PUT', {
                title: form.get('title'),
                description: form.get('description'),
                category: form.get('category'),
              });
            else {
              form.set('file', file!, file!.name);
              await mutate('/api/materials', 'POST', form);
            }
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="material-editor-fields">
          {!item && (
            <label
              className={`material-upload ${file ? 'has-file' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) chooseFile(e.dataTransfer.files[0]);
              }}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                aria-label="Arquivo do material"
                disabled={busy}
                onChange={(e) => {
                  chooseFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {preview ? (
                <Image
                  src={preview}
                  alt="Prévia do arquivo escolhido"
                  width={120}
                  height={80}
                  unoptimized
                />
              ) : file ? (
                <FileText size={30} />
              ) : (
                <UploadCloud size={32} />
              )}
              <strong>{file ? file.name : 'Arraste o arquivo ou clique para escolher'}</strong>
              <span>
                {file
                  ? `${sizeLabel(file.size)} · Clique para trocar`
                  : 'PNG, JPG, WebP ou PDF · Até 4 MB'}
              </span>
              {file && (
                <span className="material-upload-ready">
                  <Check size={13} /> Arquivo selecionado
                </span>
              )}
            </label>
          )}
          <label className="field">
            Título
            <input
              name="title"
              defaultValue={item?.title}
              maxLength={140}
              placeholder="Ex.: Logo ANADE — fundo transparente"
              required
            />
          </label>
          <label className="field">
            Categoria
            <Select
              aria-label="Categoria do material"
              name="category"
              defaultValue={item?.category || 'logos'}
              options={categories}
            />
          </label>
          <label className="field">
            Descrição e orientações de uso
            <textarea
              name="description"
              defaultValue={item?.description}
              maxLength={1500}
              rows={3}
              placeholder="Ex.: Versão para fundos claros. Mantenha as proporções da marca."
            />
          </label>
        </fieldset>
        <ErrorNotice message={error} />
        <div className="form-actions">
          <button type="button" className="button outline" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <SubmitButton busy={busy}>
            {item ? <Pencil size={15} /> : <ImagePlus size={17} />}{' '}
            {busy ? 'Salvando…' : item ? 'Salvar alterações' : 'Publicar material'}
          </SubmitButton>
        </div>
      </Form>
    </Modal>
  );
}
