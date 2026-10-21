import type { Metadata } from 'next';
import MemberProfile from '@/components/member-profile';

export const metadata: Metadata = { title: 'Meu perfil' };
export default function MyProfilePage() {
  return <MemberProfile />;
}
