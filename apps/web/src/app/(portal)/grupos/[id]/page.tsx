import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GroupsHub } from '@/components/groups-hub';
export const metadata: Metadata = { title: 'Espaço do grupo' };
export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <GroupsHub key={id} groupId={id} />;
}
