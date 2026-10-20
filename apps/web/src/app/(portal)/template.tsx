'use client';
import { m, useReducedMotion } from 'motion/react';
export default function PortalTemplate({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className="page-transition"
      initial={reduced ? false : { opacity: 0, y: 16, filter: 'blur(5px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
