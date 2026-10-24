import type { Metadata } from 'next';
import { GroupsHub } from '@/components/groups-hub';
import { redirect } from 'next/navigation';
export const metadata: Metadata = { title: 'Grupos e diretórios' };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ grupo?: string }>;
}) {
  const { grupo } = await searchParams;
  if (grupo && /^[0-9a-f-]{36}$/i.test(grupo)) redirect(`/grupos/${grupo}`);
  return <GroupsHub />;
}
