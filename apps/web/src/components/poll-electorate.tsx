'use client';
import { useState } from 'react';
import { usePortal } from './portal-provider';
import { useOrganization, MembersPicker } from './organization-ui';
import { type Group } from '@/lib/organization';
import { Select } from './select';
import { DateTimePicker } from './date-time-picker';
import { ErrorNotice } from './ui';
export function PollElectorate({ initialGroupId }: { initialGroupId?: string }) {
  const { data } = usePortal(),
    [groupId, setGroupId] = useState(initialGroupId || 'all');
  const { value, error } = useOrganization<{ records: Group[] }>('/api/groups');
  if (!data) return null;
  const group = value?.records.find((g) => g.id === groupId),
    members = data.members.filter((m) => groupId === 'all' || group?.memberIds.includes(m.id));
  return (
    <div className="org-electorate full">
      <h3>Eleitorado e regras</h3>
      <p className="form-description">
        Revise antes de publicar. Eleitores, abertura, prazo, modalidade e regras ficam fixos nesta
        votação, mesmo se o grupo mudar depois. Nas bancadas, o cargo eletivo oficial também é
        verificado na confirmação do voto.
      </p>
      <ErrorNotice message={error} />
      <div className="form-grid">
        <label className="field full">
          Grupo eleitor
          <Select
            name="groupId"
            aria-label="Grupo eleitor"
            value={groupId}
            onValueChange={setGroupId}
            options={[
              { value: 'all', label: 'Todos os filiados' },
              ...(value?.records || []).map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </label>
        <div className="full">
          <MembersPicker
            key={groupId}
            name="electorIds"
            label="Eleitores desta votação"
            members={members}
            selected={members.map((m) => m.id)}
          />
        </div>
        <label className="field">
          Quórum de participação (%)
          <input name="quorumPercent" type="number" min={0} max={100} defaultValue={50} required />
          <small>Abstenções contam para o quórum. 0% dispensa mínimo.</small>
        </label>
        <label className="field">
          Regra de aprovação
          <Select
            name="approvalRule"
            aria-label="Regra de aprovação"
            defaultValue="plurality"
            options={[
              { value: 'plurality', label: 'Mais votos válidos (sem empate)' },
              { value: 'absolute', label: 'Mais da metade do eleitorado' },
              { value: 'two_thirds', label: 'Dois terços do eleitorado' },
            ]}
          />
        </label>
        <label className="field full">
          Abrir votação em
          <DateTimePicker
            name="opensAt"
            label="Abertura da votação"
            placeholder="Imediatamente após publicar"
          />
          <small>Opcional. Horário local do dispositivo.</small>
        </label>
      </div>
    </div>
  );
}
