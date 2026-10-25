'use client';
import { useState } from 'react';
import { Download, FileText, Upload, ShieldCheck } from 'lucide-react';
import { usePortal } from './portal-provider';
import { MembersPicker, useOrganization } from './organization-ui';
import { ErrorNotice, SubmitButton } from './ui';
import { DeleteAction } from './delete-action';
export function OrganizationFiles({
  kind,
  id,
  memberIds,
  canEdit,
}: {
  kind: 'legal' | 'entry';
  id: string;
  memberIds: string[];
  canEdit: boolean;
}) {
  const { data } = usePortal(),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { value, error: loadError } = useOrganization<{
    records: { id: string; name: string; url: string }[];
  }>(`/api/organization/${kind}/${id}/files`, version);
  if (!data) return null;
  return (
    <section className="org-files">
      <h3>
        <ShieldCheck size={19} />
        Documentos restritos
      </h3>
      <p className="form-description">
        Os arquivos só ficam disponíveis para as pessoas autorizadas, enquanto mantiverem acesso a
        este registro.
      </p>
      <ErrorNotice message={error || loadError} />
      <div className="org-file-list">
        {value?.records.map((f) => (
          <div className="org-file-row" key={f.id}>
            <a href={f.url}>
              <FileText size={19} />
              <span>{f.name}</span>
              <Download size={16} />
            </a>
            {canEdit && (
              <DeleteAction
                url={`/api/organization/files/${f.id}`}
                title={f.name}
                label="Excluir anexo"
                description="O documento será excluído deste registro e do armazenamento do portal."
                onDeleted={() => setVersion((v) => v + 1)}
              />
            )}
          </div>
        ))}
        {value?.records.length === 0 && <p>Nenhum documento disponível para você.</p>}
      </div>
      {canEdit && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              raw = new FormData(form),
              file = raw.get('file');
            if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) {
              setError('Escolha um PDF ou imagem de até 4 MB.');
              return;
            }
            raw.set('memberIds', JSON.stringify(raw.getAll('memberIds')));
            setBusy(true);
            setError('');
            try {
              const response = await fetch(`/api/organization/${kind}/${id}/files`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'X-CSRF-Token': data.csrf },
                body: raw,
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              setVersion((v) => v + 1);
              form.reset();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            <span>
              <Upload size={16} />
              Adicionar comprovante ou documento
            </span>
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
            <small>PDF, JPG, PNG ou WebP · até 4 MB por arquivo</small>
          </label>
          <MembersPicker
            label="Quem pode abrir este arquivo"
            members={data.members.filter((m) => memberIds.includes(m.id))}
            selected={memberIds}
          />
          <p className="form-description">
            {kind === 'legal'
              ? 'O sigilo do caso também é verificado em cada download.'
              : 'Administradores e a equipe financeira podem consultar.'}{' '}
            A seleção do arquivo não altera o acesso ao restante do registro.
          </p>
          <SubmitButton busy={busy}>Salvar documento</SubmitButton>
        </form>
      )}
    </section>
  );
}
