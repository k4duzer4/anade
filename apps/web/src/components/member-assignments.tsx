'use client';
import Link from 'next/link';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { type Member } from '@/lib/types';
export function MemberAssignments({ member, admin = false }: { member?: Member; admin?: boolean }) {
  return (
    <section className="panel assignment-summary">
      <header>
        <ShieldCheck size={19} />
        <h2>Cargo e funções</h2>
        {admin && member && (
          <Link className="text-button" href={`/administracao/cargos?membro=${member.id}`}>
            Gerenciar
            <ArrowUpRight size={13} />
          </Link>
        )}
      </header>
      <dl>
        <div>
          <dt>Cargo eletivo</dt>
          <dd>
            {member?.office || 'Sem cargo eletivo'}
            {member?.officeState ? ` · ${member.officeState}` : ''}
          </dd>
        </div>
        <div>
          <dt>Funções no partido</dt>
          <dd>
            {member?.functions?.length
              ? member.functions.map((f) => (
                  <span key={f}>
                    {f}
                    {['Presidente estadual', 'Coordenador estadual'].includes(f) &&
                    member.functionState
                      ? ` · ${member.functionState}`
                      : ''}
                  </span>
                ))
              : 'Membro comum'}
          </dd>
        </div>
      </dl>
      <p>
        Definidos pela administração. Alterar os dados pessoais da ficha não altera essas
        atribuições.
      </p>
    </section>
  );
}
