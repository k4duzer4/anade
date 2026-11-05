import type { Metadata } from 'next';
import { MaterialsHub } from '@/components/materials-hub';
import { requireMember } from '@/lib/member-access';
export const metadata: Metadata = { title: 'Acervo de comunicação' };
export default async function MaterialsPage() {
  await requireMember();
  return <MaterialsHub />;
}
