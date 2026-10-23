import type { Metadata } from 'next';
import { CommunityHub } from '@/components/community-hub';
export const metadata: Metadata = { title: 'Mural de comunicados' };
export default function AnnouncementsPage() {
  return <CommunityHub kind="announcement" />;
}
