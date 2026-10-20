'use client';
import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { usePortal } from './portal-provider';
import { ErrorNotice, SubmitButton } from './ui';
import type { Director } from '@/lib/types';
export function DirectorForm({ director, onClose }: { director?: Director; onClose: () => void }) {
  const { data, mutate, notify } = usePortal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!data?.user.admin) return null;
  const members = [...data.members].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await mutate(
        director ? `/api/directors/${director.id}` : '/api/directors',
        director ? 'PUT' : 'POST',
        { ...fields, position: Number(fields.position) },
      );
      onClose();
      notify(director ? 'Composição da direção atualizada.' : 'Diretor adicionado.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <p className="form-description">
        Vincule um filiado e apresente seu papel na organização da ANADE.
      </p>
      <fieldset className="director-fields" disabled={busy}>
        <div className="form-grid">
          <label className="field full">
            Filiado
            <select name="memberId" required defaultValue={director?.memberId || ''}>
              <option value="" disabled>
                Selecione uma ficha cadastrada
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.blue || member.discord}
                </option>
              ))}
            </select>
            <small>O filiado precisa ter preenchido a ficha no portal.</small>
          </label>
          <label className="field full">
            Cargo na direção
            <input
              name="title"
              required
              maxLength={100}
              defaultValue={director?.title || ''}
              placeholder="Ex.: Secretaria de comunicação"
            />
          </label>
          <label className="field full">
            Responsabilidades <span className="optional">Opcional</span>
            <textarea
              name="responsibility"
              rows={3}
              maxLength={500}
              defaultValue={director?.responsibility || ''}
              placeholder="Descreva a atuação deste cargo no partido."
            />
          </label>
          <label className="field full">
            Ordem de exibição
            <input
              name="position"
              type="number"
              required
              min={1}
              max={99}
              step={1}
              defaultValue={director?.position || 1}
            />
            <small>
              Números menores aparecem primeiro. Em caso de empate, a ordem é alfabética pelo cargo.
            </small>
          </label>
        </div>
      </fieldset>
      <p className="detail-note">
        <ShieldCheck size={17} /> Este cadastro apresenta a composição do partido. O acesso de
        administrador é definido pelos cargos do Discord.
      </p>
      <ErrorNotice message={error} />
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <SubmitButton busy={busy}>Salvar diretor</SubmitButton>
      </div>
    </form>
  );
}
