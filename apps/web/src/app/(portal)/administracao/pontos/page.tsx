import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireMember } from '@/lib/member-access';
import { PageHeading } from '@/components/ui';
import { CheckinHistory } from '@/components/checkin-history';

export const metadata: Metadata = { title: 'Consulta de pontos' };
export default async function CheckinAdministrationPage() {
  await requireMember({ adminOnly: true });
  return (
    <>
      <PageHeading
        title="PARTICIPAÇÃO EM DIA."
        eyebrow="ADMINISTRAÇÃO · PONTOS"
        description="Consulte os pontos registrados pelos filiados e confira os comprovantes de ações e publicações no Blue."
        action={
          <Link href="/administracao" className="button secondary">
            <ArrowLeft size={16} /> Administração
          </Link>
        }
      />
      <CheckinHistory admin />
    </>
  );
}
