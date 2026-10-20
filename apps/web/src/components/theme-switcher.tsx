'use client';
import { useId, useSyncExternalStore } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { m } from 'motion/react';
const subscribe = () => () => {};
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const id = useId();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <div className="theme-switcher" role="group" aria-label="Aparência do portal">
      {[
        { value: 'light', label: 'Modo claro', Icon: Sun },
        { value: 'dark', label: 'Modo escuro', Icon: Moon },
        { value: 'system', label: 'Tema do sistema', Icon: Monitor },
      ].map(({ value, label, Icon }) => (
        <button
          type="button"
          key={value}
          aria-label={label}
          title={label}
          aria-pressed={mounted && theme === value}
          onClick={() => setTheme(value)}
        >
          {mounted && theme === value && (
            <m.span
              className="theme-pill"
              layoutId={`theme-${id}`}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}
