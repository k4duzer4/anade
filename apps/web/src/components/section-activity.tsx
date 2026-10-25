'use client';
import { useEffect, useRef } from 'react';
import { usePortal } from './portal-provider';
export function SectionActivity({ path }: { path: string }) {
  const { data, activity, markActivitySeen } = usePortal();
  const entered = useRef('');
  useEffect(() => {
    if (!data || !activity || !markActivitySeen) return;
    const visit = `${data.user.id}:${path}`;
    if (entered.current === visit) return;
    entered.current = visit;
    const keys = activity.sections[path]?.unseenKeys || [];
    if (keys.length)
      void markActivitySeen(path, keys).catch(() => {
        if (entered.current === visit) entered.current = '';
      });
  }, [path, data, activity, markActivitySeen]);
  return null;
}
