import type { Metadata } from 'next';
import { PlenaryList } from '@/components/plenary-list';
export const metadata: Metadata = { title: 'Plenário virtual' };
export default function Page() {
  return <PlenaryList />;
}
