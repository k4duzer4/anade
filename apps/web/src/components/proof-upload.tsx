'use client';

import Image from 'next/image';
import { useEffect, useId, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';

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
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // The URL is created and released with the same file, including replacement.
    const task = requestAnimationFrame(() => setPreview(url));
    return () => {
      cancelAnimationFrame(task);
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return (
    <section className={`proof-upload ${file ? 'has-file' : ''}`}>
      <div className="proof-upload-heading">
        <span className="section-icon">
          <Camera size={20} />
        </span>
        <div>
          <h3>{label}</h3>
          <p>{description}</p>
        </div>
      </div>
      <label className="proof-upload-area" htmlFor={id}>
        {file && preview ? (
          <Image src={preview} alt={`Prévia: ${label}`} width={800} height={600} unoptimized />
        ) : (
          <span className="proof-upload-empty">
            <ImagePlus size={29} />
            <strong>Escolher print</strong>
            <span>PNG, JPG ou WebP · até 10 MB</span>
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
            if (!selected) return;
            if (
              !['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) ||
              selected.size > 10 * 1024 * 1024
            ) {
              setError('Escolha uma imagem PNG, JPG ou WebP de até 10 MB.');
              event.target.value = '';
              return;
            }
            setError('');
            onChange(selected);
          }}
        />
        {file && <span className="proof-replace">Trocar imagem</span>}
      </label>
      {file && (
        <div className="proof-file-info">
          <span>{file.name}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setError('');
              onChange(null);
            }}
            aria-label={`Remover ${label.toLocaleLowerCase('pt-BR')}`}
          >
            <X size={15} /> Remover
          </button>
        </div>
      )}
      {error && (
        <p className="error-notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
