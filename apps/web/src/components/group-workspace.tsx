'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Crown, Landmark, Plus, Users, Vote } from 'lucide-react';
import { usePortal } from './portal-provider';
import { MemberAvatar } from './member-avatar';
import { PollCard } from './poll-card';
import { MeetingCard } from './meeting-card';
import { ViewFilters } from './portal-tools';
import { Empty } from './ui';
import { type Group } from '@/lib/organization';
export function GroupWorkspace({
  group,
  children,
  onCreateNote,
  workCount = 0,
}: {
  group: Group;
  workCount?: number;
  children: ReactNode;
  onCreateNote: () => void;
}) {
  const { data } = usePortal();
  const [tab, setTab] = useState('work');
  if (!data) return null;
  const members = data.members.filter((m) => group.memberIds.includes(m.id));
  const leader = members.find((m) => m.id === group.leaderId);
  const polls = data.polls.filter((p) => p.governance?.groupId === group.id);
  const meetings = data.meetings.filter((m) => m.groupId === group.id);
  return (
    <section className="group-workspace" aria-label={`Espaço de ${group.name}`}>
      <div className="group-overview">
        <section className="panel group-leadership">
          <span className="eyebrow">
            <Crown size={14} />
            LIDERANÇA DO GRUPO
          </span>
          <div>
            {leader ? (
              <>
                <MemberAvatar name={leader.name} src={leader.avatarUrl} />
                <div>
                  <h2>{leader.name}</h2>
                  <p>
                    {leader.office || 'Representante do grupo'}
                    {leader.state ? ` · ${leader.state}` : ''}
                  </p>
                  <Link href={`/filiados/${leader.id}`} className="text-button">
                    Conhecer liderança
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <span className="org-symbol">
                  <Landmark size={24} />
                </span>
                <div>
                  <h2>Liderança em definição</h2>
                  <p>A administração pode escolher uma pessoa entre os participantes.</p>
                </div>
              </>
            )}
          </div>
        </section>
        <section className="panel group-people-summary">
          <span className="eyebrow">
            <Users size={14} />
            QUEM CONSTRÓI ESTE GRUPO
          </span>
          <strong>
            {members.length} {members.length === 1 ? 'participante' : 'participantes'}
          </strong>
          <div className="group-avatar-stack">
            {members.slice(0, 5).map((m) => (
              <MemberAvatar key={m.id} name={m.name} src={m.avatarUrl} />
            ))}
            {members.length > 5 && <span>+{members.length - 5}</span>}
          </div>
          <button className="text-button" onClick={() => setTab('members')}>
            Ver participantes
            <ArrowUpRight size={13} />
          </button>
        </section>
      </div>
      <div className="group-tabs">
        <ViewFilters
          label="Áreas do grupo"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'work', label: 'Pautas e trabalho', count: workCount },
            { value: 'polls', label: 'Votações', count: polls.length },
            { value: 'meetings', label: 'Reuniões', count: meetings.length },
            { value: 'members', label: 'Participantes', count: members.length },
          ]}
        />
      </div>
      {tab === 'work' && (
        <>
          <header className="group-section-heading">
            <div>
              <h2>Pautas e trabalho</h2>
              <p>Prioridades, negociações, orientações de voto e tarefas de {group.name}.</p>
            </div>
            <button className="button primary" onClick={onCreateNote}>
              <Plus size={16} />
              Novo registro
            </button>
          </header>
          {children}
        </>
      )}
      {tab === 'polls' && (
        <>
          <header className="group-section-heading">
            <div>
              <h2>Decisões do grupo</h2>
              <p>
                Somente votações vinculadas a {group.name}. Cada uma possui seu próprio eleitorado.
              </p>
            </div>
            {data.user.admin && (
              <Link className="button primary" href={`/votacoes?grupo=${group.id}&nova=1`}>
                <Plus size={16} />
                Criar votação
              </Link>
            )}
          </header>
          <div className="refresh-polls-grid">
            {polls.map((p) => (
              <PollCard poll={p} key={p.id} />
            ))}
          </div>
          {!polls.length && (
            <section className="panel">
              <Empty>
                <Vote size={28} />
                <h3>Nenhuma votação neste grupo.</h3>
                <p>As decisões deste espaço aparecerão aqui.</p>
              </Empty>
            </section>
          )}
        </>
      )}
      {tab === 'meetings' && (
        <>
          <header className="group-section-heading">
            <div>
              <h2>Encontros do grupo</h2>
              <p>Pautas, chamada e ata no espaço da sua equipe.</p>
            </div>
            {data.user.admin && (
              <Link className="button primary" href={`/agenda?grupo=${group.id}&nova=1`}>
                <Plus size={16} />
                Agendar reunião
              </Link>
            )}
          </header>
          <div className="refresh-events-grid">
            {[...meetings]
              .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
              .map((m) => (
                <MeetingCard meeting={m} key={m.id} />
              ))}
          </div>
          {!meetings.length && (
            <section className="panel">
              <Empty>
                <CalendarDays size={28} />
                <h3>Nenhuma reunião neste grupo.</h3>
                <p>Os próximos encontros aparecerão aqui.</p>
              </Empty>
            </section>
          )}
        </>
      )}
      {tab === 'members' && (
        <>
          <header className="group-section-heading">
            <div>
              <h2>Participantes</h2>
              <p>A composição é definida pela administração.</p>
            </div>
          </header>
          <div className="group-members-grid">
            {[...members]
              .sort(
                (a, b) =>
                  Number(b.id === group.leaderId) - Number(a.id === group.leaderId) ||
                  a.name.localeCompare(b.name),
              )
              .map((m) => (
                <Link className="panel group-member" href={`/filiados/${m.id}`} key={m.id}>
                  <MemberAvatar name={m.name} src={m.avatarUrl} />
                  <h3>{m.name}</h3>
                  <p>
                    {m.id === group.leaderId ? 'Liderança' : m.office || 'Participante'}
                    {m.state ? ` · ${m.state}` : ''}
                  </p>
                  <span className="text-button">
                    Ver perfil
                    <ArrowUpRight size={13} />
                  </span>
                </Link>
              ))}
          </div>
          {!members.length && (
            <section className="panel">
              <Empty>
                <Users size={28} />
                <h3>O grupo ainda não tem participantes.</h3>
                <p>A administração pode definir a equipe em “Gerenciar grupo”.</p>
              </Empty>
            </section>
          )}
        </>
      )}
    </section>
  );
}
