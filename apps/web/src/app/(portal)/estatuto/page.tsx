import type { Metadata } from 'next';
import { StatutePage } from '@/components/statute-page';
export const metadata: Metadata = { title: 'Estatuto da ANADE' };
export default function Statute() {
  return <StatutePage />;
}
