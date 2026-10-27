import type { Metadata } from 'next';
import LegalDocument from '@/components/legal-document';
export const metadata: Metadata = { title: 'Política de Privacidade' };
export default function PrivacyPage() {
  return <LegalDocument privacy />;
}
