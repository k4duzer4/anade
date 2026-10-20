'use client';
import { useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';
export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!ref.current || !inView) return;
    if (reduced) {
      ref.current.textContent = String(value).padStart(2, '0');
      return;
    }
    const animation = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = String(Math.round(latest)).padStart(2, '0');
      },
    });
    return () => animation.stop();
  }, [value, inView, reduced]);
  return (
    <span ref={ref} aria-label={String(value)}>
      {String(value).padStart(2, '0')}
    </span>
  );
}
