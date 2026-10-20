'use client';
import type { ReactNode, PointerEvent } from 'react';
import { useMotionValue, useMotionTemplate, m, useReducedMotion } from 'motion/react';
export function Spotlight({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const reduced = useReducedMotion();
  const background = useMotionTemplate`radial-gradient(480px circle at ${x}px ${y}px, rgba(229,181,43,.14), transparent 65%)`;
  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
  }
  return (
    <div className={`spotlight ${className}`} onPointerMove={move}>
      {!reduced && <m.div className="spotlight-light" style={{ background }} aria-hidden="true" />}
      {children}
    </div>
  );
}
