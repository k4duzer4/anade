import type { ReactNode } from 'react';
import PortalShell from '@/components/portal-shell';
import { requireMember } from '@/lib/member-access';
export default async function PortalLayout({ children }: { children: ReactNode }) {
  await requireMember({allowGuest:true});
  return <PortalShell>{children}</PortalShell>;
}
