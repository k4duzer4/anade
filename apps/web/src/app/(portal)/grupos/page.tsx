import type { Metadata } from 'next';
import { GroupsHub } from '@/components/groups-hub';
export const metadata: Metadata = { title: 'Grupos e diretórios' };
export default function Page() {
  return <GroupsHub />;
}
