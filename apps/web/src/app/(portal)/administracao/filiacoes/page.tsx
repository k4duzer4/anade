import type { Metadata } from 'next';
import { requireMember } from '@/lib/member-access';
import AffiliationsAdmin from '@/components/affiliations-admin';
export const metadata: Metadata = { title: 'Solicitações de filiação' };
export default async function AffiliationsPage() {
  await requireMember({ adminOnly: true });
  return <AffiliationsAdmin />;
}
