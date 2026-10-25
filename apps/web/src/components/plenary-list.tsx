'use client';
import Link from 'next/link';
import {
  AudioLines,
  ArrowUpRight,
  CalendarDays,
  Landmark,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PageHeading, Empty, ErrorNotice } from './ui';
import { usePortal } from './portal-provider';
import { useOrganization, OrganizationLoading } from './organization-ui';
import { formatDate, type Meeting } from '@/lib/types';
import type { PlenaryProvider } from '@/lib/plenary';
export function PlenaryList() {
  const { data } = usePortal();
  const { value, error } = useOrganization<{ provider: PlenaryProvider; records: Meeting[] }>(
    '/api/plenaries',
    data?.serverTime,
  );
  if (!data) return null;
  return (
    <div className="refresh-page plenary-page">
      <PageHeading
        eyebrow="REUNIÕES POR VOZ · ANADE 10"
        title="O partido tem voz."
        description="Um espaço para ouvir, debater e decidir. Áudio, pautas, presença e votação na mesma mesa."
        action={
          data.user.admin && (
            <Link className="button primary" href="/agenda?nova=1&modalidade=plenario">
              <Plus size={17} />
              Agendar plenário
            </Link>
          )
        }
      />
      <section className="plenary-intro">
        <div className="plenary-intro-symbol">
          <Landmark size={48} />
        </div>
        <div>
          <span className="eyebrow">OUVIR É O PRIMEIRO PASSO</span>
          <h2>
            Muitas vozes.
            <br />
            Um projeto comum.
          </h2>
          <p>Reuniões nacionais e dos grupos, com kMeet integrado e até 40 lugares no portal.</p>
        </div>
        <div className="plenary-intro-facts">
          <span>
            <AudioLines size={20} />
            Reuniões por voz
          </span>
          <span>
            <Users size={20} />
            Presença e quórum
          </span>
          <span>
            <ShieldCheck size={20} />
            Pautas e votos pela mesa
          </span>
        </div>
      </section>
      <ErrorNotice message={error} />
      {!value && !error && <OrganizationLoading />}
      {value && (
        <>
          <div className="org-toolbar">
            <h2>Salas de reunião</h2>
            <span>{value.records.length} encontro(s) disponível(is)</span>
          </div>
          <div className="plenary-room-grid">
            {value.records.map((meeting) => (
              <article className="panel plenary-room-card" key={meeting.id}>
                <span className="org-symbol">
                  <AudioLines size={24} />
                </span>
                <span className="eyebrow">
                  {meeting.groupId ? 'REUNIÃO DO GRUPO' : 'PLENÁRIO DO PARTIDO'}
                </span>
                <h2>{meeting.title}</h2>
                <p>
                  <CalendarDays size={14} />
                  {formatDate(meeting.date)}
                </p>
                <small>{meeting.agenda.length} pauta(s) na ordem do dia</small>
                <a className="button secondary" href={`/plenario/${meeting.id}`}>
                  Abrir plenário
                  <ArrowUpRight size={16} />
                </a>
              </article>
            ))}
          </div>
          {!value.records.length && (
            <section className="panel">
              <Empty>
                <Landmark size={32} />
                <h3>O próximo debate começa aqui.</h3>
                <p>Quando houver uma reunião disponível, a sala aparecerá neste espaço.</p>
                {data.user.admin && (
                  <Link className="button primary" href="/agenda?nova=1&modalidade=plenario">
                    Agendar primeiro plenário
                  </Link>
                )}
              </Empty>
            </section>
          )}
        </>
      )}
    </div>
  );
}
