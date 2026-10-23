import type { Metadata } from 'next';
import { CommunityHub } from '@/components/community-hub';
export const metadata: Metadata = { title: 'Central de campanha' };
export default function CampaignPage() {
  return <CommunityHub kind="campaign" />;
}
