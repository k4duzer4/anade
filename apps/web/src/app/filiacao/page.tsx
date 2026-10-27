import type { Metadata } from 'next';
import AffiliationContent from '@/components/affiliation-content';
export const metadata: Metadata = { title: 'Solicitar filiação' };
export default function AffiliationPage() {
  return <AffiliationContent />;
}
