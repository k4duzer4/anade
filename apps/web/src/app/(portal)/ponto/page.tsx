import type { Metadata } from 'next';
import CheckinContent from '@/components/checkin-content';

export const metadata: Metadata = { title: 'Bater ponto' };
export default function CheckinPage() {
  return <CheckinContent />;
}
