import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { requireMember } from '@/lib/member-access';
import { PageHeading } from '@/components/ui';
import { CheckinRanking } from '@/components/checkin-ranking';
export const metadata: Metadata = { title: 'Ranking de pontos' };
export default async function RankingPage() {
  await requireMember({ adminOnly: true });
  return (
    <div className="refresh-page">
      <PageHeading
        eyebrow="ADMINISTRAÇÃO · PARTICIPAÇÃO"
        title="Ranking de pontos."
        description="Quem participa mais dos registros diários da ANADE."
        action={
          <Link href="/administracao/pontos" className="button secondary">
            <ArrowLeft size={16} /> Consultar registros
          </Link>
        }
      />
      <p className="ranking-private">
        <LockKeyhole size={14} /> Visível somente para administradores
      </p>
      <CheckinRanking />
    </div>
  );
}
