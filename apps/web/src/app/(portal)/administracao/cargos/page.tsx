import type { Metadata } from 'next';
import { AssignmentsAdmin } from '@/components/assignments-admin';
import { requireMember } from '@/lib/member-access';
export const metadata: Metadata = { title: 'Cargos e funções' };
export default async function Page() {
  await requireMember({ adminOnly: true });
  return <AssignmentsAdmin />;
}
