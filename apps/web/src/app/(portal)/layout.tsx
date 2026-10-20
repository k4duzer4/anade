import type { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';
import { requireMember } from '@/lib/member-access';
export default async function PortalLayout({ children }: { children: ReactNode }) {
  await requireMember();
  return <PortalShell>{children}</PortalShell>;
}
