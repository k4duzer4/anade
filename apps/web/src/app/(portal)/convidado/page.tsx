import type { Metadata } from 'next';
import { requireGuest } from '@/lib/member-access';
export const metadata:Metadata={title:'Acesso de convidado'};
export default async function GuestPage() {await requireGuest();return null;}
