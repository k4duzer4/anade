import type { Metadata } from 'next';
import DirectionContent from '@/components/direction-content';
export const metadata: Metadata = { title: 'Direção' };
export default function DirectionPage() {
  return <DirectionContent />;
}
