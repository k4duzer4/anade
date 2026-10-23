import type { Metadata } from 'next';
import { CommunityHub } from '@/components/community-hub';
export const metadata: Metadata = { title: 'Central de propostas' };
export default function ProposalsPage() {
  return <CommunityHub kind="proposal" />;
}
