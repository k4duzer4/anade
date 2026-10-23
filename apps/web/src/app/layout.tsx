import type { Metadata } from 'next';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import './globals.css';
import './modern.css';
import './cards.css';
import './details.css';
import './direction.css';
import './profile.css';
import './administration.css';
import './controls.css';
import './checkins.css';
import './portal-refresh.css';
import { PortalProvider } from '@/components/portal-provider';
import { ExperienceProvider } from '@/components/experience-provider';
export const metadata: Metadata = {
  title: { default: 'ANADE 10 • Portal do Filiado', template: '%s | ANADE 10' },
  description:
    'Portal interno da Aliança Nacional Democrática no RPG Legado. Diferentes correntes. Um projeto comum.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ExperienceProvider>
          <PortalProvider>{children}</PortalProvider>
        </ExperienceProvider>
      </body>
    </html>
  );
}
