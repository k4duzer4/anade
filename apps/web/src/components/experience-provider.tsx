'use client';
import { ThemeProvider } from 'next-themes';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip';
export function ExperienceProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey="anade-theme"
      disableTransitionOnChange
    >
      <LazyMotion features={domAnimation}>
        <MotionConfig
          reducedMotion="user"
          transition={{ type: 'spring', stiffness: 240, damping: 27 }}
        >
          <TooltipProvider delayDuration={350} skipDelayDuration={100}>
            {children}
          </TooltipProvider>
        </MotionConfig>
      </LazyMotion>
    </ThemeProvider>
  );
}
