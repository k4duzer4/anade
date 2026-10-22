'use client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, LoaderCircle, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { ErrorNotice, Modal } from './ui';
import {
  centeredCrop,
  clamp,
  cropRectangle,
  exportProfileCrop,
  type CropPosition,
} from '@/lib/profile-crop';

export function ProfileImageCropper({
  file,
  kind,
  initial = centeredCrop,
  onApply,
  onClose,
}: {
  file: File;
  kind: 'avatar' | 'banner';
  initial?: CropPosition;
  onApply: (file: File, position: CropPosition) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [position, setPosition] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    start: CropPosition;
    overflowX: number;
    overflowY: number;
  } | null>(null);
  const hint = useId();
  const zoomId = useId();
  const avatar = kind === 'avatar';
  const rect = size.width ? cropRectangle(size.width, size.height, avatar ? 1 : 3, position) : null;
  useEffect(() => {
    const source = URL.createObjectURL(file);
    const frame = requestAnimationFrame(() => setUrl(source));
    return () => {
      cancelAnimationFrame(frame);
      URL.revokeObjectURL(source);
    };
  }, [file]);
  function zoom(value: number) {
    setPosition((current) => ({ ...current, zoom: clamp(value, 1, 3) }));
  }
  async function apply() {
    if (!image.current || !rect || busy) return;
    setBusy(true);
    setError('');
    try {
      onApply(await exportProfileCrop(image.current, kind, position), position);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={avatar ? 'Ajustar foto de perfil' : 'Ajustar banner'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className={`profile-cropper ${avatar ? 'crop-avatar' : 'crop-banner'}`} aria-busy={busy}>
        <p className="profile-crop-hint" id={hint}>
          <Move size={16} />
          <span>
            Arraste a imagem para posicionar e use o zoom para aproximar.
            <small>No teclado, use as setas para mover a imagem.</small>
          </span>
        </p>
        <button
          type="button"
          className={`profile-crop-stage ${dragging ? 'is-dragging' : ''}`}
          disabled={busy || !rect}
          aria-label={`Área de recorte ${avatar ? 'da foto' : 'do banner'}`}
          aria-describedby={hint}
          onPointerDown={(event) => {
            if (event.button !== 0 || !rect) return;
            event.preventDefault();
            event.currentTarget.focus();
            const bounds = event.currentTarget.getBoundingClientRect();
            drag.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              start: position,
              overflowX: ((size.width / rect.width - 1) * bounds.width) / 2,
              overflowY: ((size.height / rect.height - 1) * bounds.height) / 2,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || start.id !== event.pointerId) return;
            setPosition({
              ...start.start,
              x:
                start.overflowX > 0.01
                  ? clamp(start.start.x + (event.clientX - start.x) / start.overflowX)
                  : 0,
              y:
                start.overflowY > 0.01
                  ? clamp(start.start.y + (event.clientY - start.y) / start.overflowY)
                  : 0,
            });
          }}
          onPointerUp={(event) => {
            if (drag.current?.id !== event.pointerId) return;
            drag.current = null;
            setDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(false);
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 0.2 : 0.05;
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key))
              return;
            event.preventDefault();
            if (event.key === 'Home') {
              setPosition(centeredCrop);
              return;
            }
            setPosition((current) => ({
              ...current,
              x: clamp(
                current.x +
                  (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
              ),
              y: clamp(
                current.y +
                  (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
              ),
            }));
          }}
        >
          {url && (
            <Image
              ref={image}
              src={url}
              alt="Imagem em edição"
              width={1200}
              height={1200}
              unoptimized
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth * img.naturalHeight > 24000000) {
                  setError('A resolução é muito grande. Use uma imagem de até 24 megapixels.');
                  return;
                }
                setSize({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              onError={() => {
                setSize({ width: 0, height: 0 });
                setError('Não foi possível abrir essa imagem. Escolha outro arquivo.');
              }}
              style={
                rect
                  ? {
                      width: `${(size.width / rect.width) * 100}%`,
                      height: `${(size.height / rect.height) * 100}%`,
                      left: `${(-rect.x / rect.width) * 100}%`,
                      top: `${(-rect.y / rect.height) * 100}%`,
                    }
                  : { opacity: 0 }
              }
            />
          )}
          <span className="profile-crop-grid" aria-hidden="true" />
          {!rect && !error && (
            <span className="profile-crop-loading">
              <LoaderCircle className="spin" size={23} /> Abrindo imagem…
            </span>
          )}
        </button>
        <div className="profile-crop-zoom">
          <label htmlFor={zoomId}>
            Zoom <output>{Math.round(position.zoom * 100)}%</output>
          </label>
          <div>
            <button
              type="button"
              disabled={busy || !rect || position.zoom <= 1}
              aria-label="Diminuir zoom"
              onClick={() => zoom(position.zoom - 0.1)}
            >
              <ZoomOut size={18} />
            </button>
            <input
              id={zoomId}
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={position.zoom}
              disabled={busy || !rect}
              onChange={(event) => zoom(Number(event.target.value))}
              aria-label="Zoom do recorte"
              aria-valuetext={`${Math.round(position.zoom * 100)}%`}
            />
            <button
              type="button"
              disabled={busy || !rect || position.zoom >= 3}
              aria-label="Aumentar zoom"
              onClick={() => zoom(position.zoom + 0.1)}
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </div>
        <div className="profile-crop-info">
          <span>{avatar ? 'Foto quadrada · 512 × 512' : 'Banner horizontal · 1920 × 640'}</span>
          <button type="button" disabled={busy} onClick={() => setPosition(centeredCrop)}>
            <RotateCcw size={13} /> Centralizar
          </button>
        </div>
        <ErrorNotice message={error} />
        <div className="profile-crop-footer">
          <p>
            Depois, clique em <strong>Salvar {avatar ? 'foto' : 'banner'}</strong> para publicar.
          </p>
          <div>
            <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy || !rect}
              onClick={() => void apply()}
            >
              {busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Usar
              recorte
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
