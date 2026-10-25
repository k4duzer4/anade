'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { acknowledgeActivity, type ActivityState } from '@/lib/activity';
import type { Config, PortalState } from '@/lib/types';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
type Context = {
  config: Config | null;
  data: PortalState | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  mutate: (url: string, method: string, body: unknown) => Promise<void>;
  loginDemo: (role: string) => Promise<void>;
  logout: () => Promise<void>;
  notify: (text: string) => void;
  activity: ActivityState | null;
  markActivitySeen: (path: string, keys: string[]) => Promise<void>;
};
const PortalContext = createContext<Context | null>(null);
async function request(url: string, method = 'GET', body?: unknown, csrf?: string) {
  const multipart = body instanceof FormData;
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    },
    ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
  });
  if (!res.headers.get('content-type')?.includes('application/json')) {
    throw new Error('O portal está temporariamente indisponível. Tente novamente em instantes.');
  }
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(data.error || 'Não foi possível concluir a operação.'), {
      status: res.status,
    });
  return data;
}
export function PortalProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const activityRequest = useRef(0);
  const loadActivity = useCallback(async () => {
    const sequence = ++activityRequest.current;
    try {
      const value = await request('/api/activity');
      if (sequence === activityRequest.current) setActivity(value);
    } catch {
      /* Keep the last confirmed counts if this optional request fails. */
    }
  }, []);
  const [config, setConfig] = useState<Config | null>(null),
    [data, setData] = useState<PortalState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    try {
      const value = await request('/api/state');
      setData(value);
      void loadActivity();
      setError('');
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401 || err.status === 403) {
        setData(null);
        setActivity(null);
        activityRequest.current++;
      }
      setError(err.status === 401 ? '' : err.message);
    }
  }, [loadActivity]);
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const value = await request('/api/config');
        if (active) setConfig(value);
        await refresh();
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    const focus = () => {
      void refresh();
    };
    window.addEventListener('focus', focus);
    const timer = setInterval(focus, 60000);
    return () => {
      active = false;
      window.removeEventListener('focus', focus);
      clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  async function mutate(url: string, method: string, body: unknown) {
    await request(url, method, body, data?.csrf);
    await refresh();
  }
  async function loginDemo(role: string) {
    await request('/api/demo-login', 'POST', { role });
    await refresh();
  }
  async function logout() {
    await request('/api/logout', 'POST', {}, data?.csrf);
    setData(null);
    setActivity(null);
    activityRequest.current++;
    setError('');
  }
  const markActivitySeen = useCallback(
    async (path: string, keys: string[]) => {
      for (let offset = 0; offset < keys.length; offset += 200) {
        const result = await request(
          '/api/activity/seen',
          'PUT',
          { path, keys: keys.slice(offset, offset + 200) },
          data?.csrf,
        );
        activityRequest.current++;
        setActivity((current) => acknowledgeActivity(current, result.keys));
      }
    },
    [data?.csrf],
  );
  return (
    <PortalContext.Provider
      value={{
        config,
        data,
        loading,
        error,
        refresh,
        mutate,
        loginDemo,
        logout,
        notify: setNotice,
        activity,
        markActivitySeen,
      }}
    >
      {children}
      <AnimatePresence>
        {notice && (
          <m.div
            className="toast"
            role="status"
            key={notice}
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 10, x: '-50%' }}
          >
            <CheckCircle2 size={18} />
            {notice}
          </m.div>
        )}
      </AnimatePresence>
    </PortalContext.Provider>
  );
}
export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) throw new Error('PortalProvider ausente.');
  return context;
}
