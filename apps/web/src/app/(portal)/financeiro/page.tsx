import type { Metadata } from 'next';
import { FinanceHub } from '@/components/finance-hub';
export const metadata: Metadata = { title: 'Financeiro' };
export default function Page() {
  return <FinanceHub />;
}
