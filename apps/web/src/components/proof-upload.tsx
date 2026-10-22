'use client';

import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import { Check, FileImage, ImagePlus, Maximize2, MessageSquare, Upload, X } from 'lucide-react';
import { Modal } from './ui';

export function ProofUpload({
  name,
  label,
  description,
  disabled,
  file,
  onChange,
}: {
  name: string;
  label: string;
  description: string;
  disabled: boolean;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const id = useId();
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const previewUrl = preview?.file === file ? preview?.url : '';
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // The URL is created and released with the same file, including replacement.
    const task = requestAnimationFrame(() => setPreview({ file, url }));
    return () => {
      cancelAnimationFrame(task);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  function choose(selected?: File) {
    if (disabled || !selected) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) ||
      selected.size > 10 * 1024 * 1024 ||
      selected.size === 0
    ) {
      setError('Escolha uma imagem PNG, JPG ou WebP de até 10 MB.');
      return;
    }
    setError('');
    setExpanded(false);
    onChange(selected);
  }
  const Icon = name === 'blue' ? MessageSquare : FileImage;
  return (
    <section
      className={`proof-upload ${file ? 'has-file' : ''} ${dragging ? 'is-dragging' : ''}`}
      data-disabled={disabled}
    >
      <div className="proof-upload-heading">
        <span className="proof-step">{name === 'blue' ? '02' : '01'}</span>
        <div>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>
        {file && (
          <span className="proof-added-mark" aria-label="Print adicionado">
            <Check size={14} />
          </span>
        )}
      </div>
      <label
        className="proof-upload-area"
        htmlFor={id}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && event.dataTransfer.types.includes('Files')) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          )
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files[0]);
        }}
        onPaste={(event) => {
          const pasted = event.clipboardData.files[0];
          if (pasted) {
            event.preventDefault();
            choose(pasted);
          }
        }}
      >
        {file && previewUrl ? (
          <Image src={previewUrl} alt={`Prévia: ${label}`} width={800} height={600} unoptimized />
        ) : (
          <span className="proof-upload-empty">
            <span className="proof-upload-illustration">
              <Icon size={30} />
              <span>
                <ImagePlus size={14} />
              </span>
            </span>
            <strong>{dragging ? 'Solte o print aqui' : 'Arraste seu print aqui'}</strong>
            <span>ou clique para escolher</span>
            <span className="proof-upload-pick">
              <Upload size={13} /> Selecionar imagem
            </span>
          </span>
        )}
        <input
          id={id}
          key={file?.name || 'empty'}
          type="file"
          name={name}
          aria-label={label}
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          required={!file}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            choose(selected);
            event.target.value = '';
          }}
        />
        {file && <span className="proof-replace">Trocar imagem</span>}
      </label>
      {file && (
        <div className="proof-file-info">
          <span>
            <strong>{file.name}</strong>
            <small>{(file.size / 1024 / 1024).toFixed(1)} MB · Imagem adicionada</small>
          </span>
          {previewUrl && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setExpanded(true)}
              aria-label={`Ampliar ${label.toLocaleLowerCase('pt-BR')}`}
            >
              <Maximize2 size={15} />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setError('');
              setExpanded(false);
              onChange(null);
            }}
            aria-label={`Remover ${label.toLocaleLowerCase('pt-BR')}`}
          >
            <X size={15} /> Remover
          </button>
        </div>
      )}
      {!file && (
        <p className="proof-upload-help">
          PNG, JPG ou WebP · até 10 MB · também aceita colar imagem
        </p>
      )}
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
      {expanded && file && previewUrl && (
        <Modal title="Conferir print antes de enviar" onClose={() => setExpanded(false)}>
          <div className="checkin-proof-viewer">
            <Image
              src={previewUrl}
              alt={`Ampliação: ${label}`}
              width={1600}
              height={2000}
              unoptimized
            />
            <button type="button" className="button secondary" onClick={() => setExpanded(false)}>
              Voltar ao envio
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
