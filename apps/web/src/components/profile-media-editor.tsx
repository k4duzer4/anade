'use client';
import Image from 'next/image';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Camera, Crop, ImagePlus, LoaderCircle, Save, Trash2, Upload, X } from 'lucide-react';
import { usePortal } from './portal-provider';
import { ErrorNotice, Modal } from './ui';
import type { Member } from '@/lib/types';
import { ProfileImageCropper } from './profile-image-cropper';
import { centeredCrop, type CropPosition } from '@/lib/profile-crop';

function MediaField({
  kind,
  current,
  renderImage,
}: {
  kind: 'avatar' | 'banner';
  current?: string;
  renderImage?: (src?: string) => ReactNode;
}) {
  const { mutate, notify } = usePortal();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<{ source: File; position: CropPosition } | null>(null);
  const [editing, setEditing] = useState<{ source: File; position: CropPosition } | null>(null);
  const title = kind === 'avatar' ? 'Foto de perfil' : 'Banner do perfil';
  const src = (file && preview?.file === file ? preview.url : '') || current;
  const inline = !!renderImage;
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const task = requestAnimationFrame(() => setPreview({ file, url }));
    return () => {
      cancelAnimationFrame(task);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  async function save(remove = false) {
    if (!remove && !file) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      if (file) body.set('image', file);
      await mutate(
        `/api/profile/media/${kind}`,
        remove ? 'DELETE' : 'PUT',
        remove ? undefined : body,
      );
      setFile(null);
      setDraft(null);
      notify(
        kind === 'avatar'
          ? remove
            ? 'Foto de perfil removida.'
            : 'Foto de perfil atualizada.'
          : remove
            ? 'Banner do perfil removido.'
            : 'Banner do perfil atualizado.',
      );
    } catch (failure) {
      setError((failure as Error).message);
      if (inline) notify((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function adjust() {
    if (draft) {
      setEditing(draft);
      return;
    }
    if (!current) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(current, { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível abrir a imagem salva. Tente novamente.');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') || !blob.size || blob.size > 4 * 1024 * 1024)
        throw new Error('Não foi possível abrir a imagem salva. Escolha outro arquivo.');
      setEditing({
        source: new File([blob], `${kind}.webp`, { type: blob.type }),
        position: centeredCrop,
      });
    } catch (failure) {
      setError((failure as Error).message);
      if (inline) notify((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const choose = (selected?: File) => {
    if (!selected) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) ||
      selected.size === 0 ||
      selected.size > 4 * 1024 * 1024
    ) {
      const message = 'Escolha uma imagem PNG, JPG ou WebP de até 4 MB.';
      setError(message);
      if (inline) notify(message);
      return;
    }
    setError('');
    setEditing({ source: selected, position: centeredCrop });
  };
  const cropper = editing && (
    <ProfileImageCropper
      file={editing.source}
      kind={kind}
      initial={editing.position}
      onClose={() => setEditing(null)}
      onApply={(cropped, position) => {
        setFile(cropped);
        setDraft({ source: editing.source, position });
        setEditing(null);
        setError('');
      }}
    />
  );
  const discard = () => {
    setFile(null);
    setDraft(null);
    setError('');
  };
  if (renderImage)
    return (
      <div className={`profile-image-control is-${kind}`} data-has-image={!!src}>
        {renderImage(src)}
        <div
          className="profile-image-toolbar"
          role="group"
          aria-label={`Alterar ${title.toLowerCase()}`}
        >
          <label className="profile-image-action" title={`Trocar ${title.toLowerCase()}`}>
            <Camera size={17} />
            <span className="profile-image-label">
              Trocar {kind === 'avatar' ? 'foto' : 'banner'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={`Trocar ${title.toLowerCase()}`}
              disabled={busy}
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {current && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void adjust()}
                title="Ajustar recorte"
                aria-label={`Ajustar recorte ${kind === 'avatar' ? 'da foto' : 'do banner'}`}
              >
                <Crop size={16} />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save(true)}
                title={`Retirar ${kind === 'avatar' ? 'foto' : 'banner'}`}
                aria-label={`Retirar ${kind === 'avatar' ? 'foto de perfil' : 'banner'}`}
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}
              </button>
            </>
          )}
        </div>
        {file && !editing && preview?.file === file && (
          <Modal
            title={kind === 'avatar' ? 'Salvar foto de perfil' : 'Salvar banner'}
            onClose={() => {
              if (!busy) discard();
            }}
          >
            <div className="profile-image-confirm">
              <Image
                src={preview.url}
                alt={`Prévia: ${title}`}
                width={kind === 'avatar' ? 512 : 1920}
                height={kind === 'avatar' ? 512 : 640}
                unoptimized
              />
              <p>Confira o recorte antes de atualizar seu perfil.</p>
              <ErrorNotice message={error} />
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={discard}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void adjust()}
                >
                  <Crop size={15} /> Ajustar
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  {busy ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Salvar{' '}
                  {kind === 'avatar' ? 'foto' : 'banner'}
                </button>
              </div>
            </div>
          </Modal>
        )}
        {cropper}
      </div>
    );
  return (
    <section className={`profile-media-field is-${kind}`} aria-label={title}>
      <div className="profile-media-preview" data-empty={!src}>
        {src ? (
          <Image
            src={src}
            alt={`Prévia: ${title}`}
            width={kind === 'avatar' ? 512 : 1200}
            height={kind === 'avatar' ? 512 : 400}
            unoptimized
          />
        ) : (
          <span>
            {kind === 'avatar' ? <Camera size={27} /> : <ImagePlus size={30} />}
            <small>{kind === 'avatar' ? 'Sua identidade' : 'Seu espaço na ANADE'}</small>
          </span>
        )}
        {file && <span className="profile-media-pending">Prévia · ainda não salva</span>}
      </div>
      <div className="profile-media-field-heading">
        <h3>{title}</h3>
        <span>Até 4 MB</span>
      </div>
      <p>
        {kind === 'avatar'
          ? 'Foto quadrada. Sugerido: 512 × 512 px.'
          : 'Imagem horizontal. Sugerido: 1920 × 640 px.'}
      </p>
      <div className="profile-media-actions">
        <label className={`button secondary ${busy ? 'is-disabled' : ''}`} htmlFor={id}>
          <Upload size={14} /> {src ? 'Trocar imagem' : 'Escolher imagem'}
          <input
            id={id}
            type="file"
            aria-label={title}
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              event.target.value = '';
              choose(selected);
            }}
          />
        </label>
        {(file || current) && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void adjust()}
          >
            <Crop size={14} /> Ajustar recorte
          </button>
        )}
        {file ? (
          <>
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} Salvar{' '}
              {kind === 'avatar' ? 'foto' : 'banner'}
            </button>
            <button
              type="button"
              className="profile-media-discard"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setDraft(null);
                setError('');
              }}
              aria-label={`Descartar ${title.toLowerCase()}`}
            >
              <X size={15} />
            </button>
          </>
        ) : (
          current && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void save(true)}
            >
              {busy ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />} Remover{' '}
              {kind === 'avatar' ? 'foto' : 'banner'}
            </button>
          )
        )}
      </div>
      <ErrorNotice message={error} />
      {cropper}
    </section>
  );
}
export function ProfileImageControl(props: {
  kind: 'avatar' | 'banner';
  current?: string;
  children: (src?: string) => ReactNode;
}) {
  return <MediaField kind={props.kind} current={props.current} renderImage={props.children} />;
}
export function ProfileMediaEditor({ member }: { member?: Member }) {
  return (
    <section className="panel profile-media-editor" aria-labelledby="profile-media-title">
      <header>
        <span className="section-icon">
          <Camera size={20} />
        </span>
        <div>
          <span className="eyebrow">DEIXE COM A SUA CARA</span>
          <h2 id="profile-media-title">Foto e banner</h2>
          <p>PNG, JPG ou WebP, até 4 MB por imagem. Visíveis aos filiados no portal.</p>
        </div>
      </header>
      {member ? (
        <>
          <div className="profile-media-grid">
            <MediaField kind="avatar" current={member.avatarUrl} />
            <MediaField kind="banner" current={member.bannerUrl} />
          </div>
          <p className="profile-media-note">
            Escolha o enquadramento no editor e salve a foto ou o banner para publicar.
          </p>
        </>
      ) : (
        <p className="profile-media-note">
          Salve sua ficha abaixo para começar a personalizar suas imagens.
        </p>
      )}
    </section>
  );
}
