'use client';
import { useState } from 'react';
import { AlertTriangle, LoaderCircle, Trash2 } from 'lucide-react';
import { usePortal } from './portal-provider';
import { Modal, ErrorNotice } from './ui';

export function DeleteAction({
  url,
  title,
  description,
  label = 'Excluir',
  onDeleted,
  requireName = false,
}: {
  url: string;
  title: string;
  description: string;
  label?: string;
  onDeleted?: () => void;
  requireName?: boolean;
}) {
  const { mutate, notify } = usePortal();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [name, setName] = useState('');
  const close = () => {
    if (!busy) setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        className="text-button danger delete-action"
        aria-label={`${label}: ${title}`}
        onClick={() => {
          setError('');
          setName('');
          setOpen(true);
        }}
      >
        <Trash2 size={14} />
        {label}
      </button>
      {open && (
        <Modal title={label} onClose={close}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || (requireName && name.trim() !== title)) return;
              setBusy(true);
              setError('');
              try {
                await mutate(url, 'DELETE', {});
                notify('Registro excluído.');
                setOpen(false);
                onDeleted?.();
              } catch (failure) {
                setError((failure as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="deletion-warning">
              <AlertTriangle size={24} />
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
            <p className="form-description">Esta ação é definitiva e não pode ser desfeita.</p>
            {requireName && (
              <label className="field">
                Digite o nome acima para confirmar
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  required
                  disabled={busy}
                />
              </label>
            )}
            <ErrorNotice message={error} />
            <div className="form-actions">
              <button type="button" className="button outline" onClick={close} disabled={busy}>
                Cancelar
              </button>
              <button
                type="submit"
                className="button deletion-confirm"
                disabled={busy || (requireName && name.trim() !== title)}
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}Excluir
                definitivamente
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
