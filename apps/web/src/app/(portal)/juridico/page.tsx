import type { Metadata } from 'next';
import { LegalHub } from '@/components/legal-hub';
export const metadata: Metadata = { title: 'Jurídico' };
export default function Page() {
  return <LegalHub />;
}
