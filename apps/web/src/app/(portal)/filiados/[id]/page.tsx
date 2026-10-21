import type { Metadata } from 'next';
import MemberProfile from '@/components/member-profile';

export const metadata: Metadata = { title: 'Perfil do filiado' };
export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberProfile memberId={id} />;
}
