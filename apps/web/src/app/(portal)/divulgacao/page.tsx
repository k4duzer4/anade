import type { Metadata } from 'next';
import { PublicationsHub } from '@/components/publications-hub';
export const metadata: Metadata = { title: 'Mural de divulgação' };
export default function PublicationsPage() {
  return <PublicationsHub />;
}
