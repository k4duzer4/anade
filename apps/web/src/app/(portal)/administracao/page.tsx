import type { Metadata } from 'next';
import { requireMember } from '@/lib/member-access';
import AdministrationContent from '@/components/administration-content';

export const metadata: Metadata = { title: 'Administração' };
export default async function AdministrationPage() {
  await requireMember({ adminOnly: true });
  return <AdministrationContent />;
}
