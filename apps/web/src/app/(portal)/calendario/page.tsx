import type { Metadata } from 'next';
import { GameCalendarPanel } from '@/components/game-calendar';
export const metadata: Metadata = { title: 'Calendário do Legado' };
export default function Page() {
  return <GameCalendarPanel />;
}
