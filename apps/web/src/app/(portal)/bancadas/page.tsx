import type { Metadata } from 'next';
import { GroupsHub } from '@/components/groups-hub';
export const metadata: Metadata = { title: 'Bancadas' };
export default function Page() {
  return <GroupsHub caucus />;
}
