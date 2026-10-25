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
import { portalRequest, createRefreshQueue } from '@/lib/portal-request';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
type Context = {
  config: Config | null;
  data: PortalState | null;
  loading: boolean;
  error: string;
  refresh: (fresh?: boolean) => Promise<void>;
  mutate: (url: string, method: string, body: unknown) => Promise<void>;
  loginDemo: (role: string) => Promise<void>;
  logout: () => Promise<void>;
  notify: (text: string) => void;
  activity: ActivityState | null;
  markActivitySeen: (path: string, keys: string[]) => Promise<void>;
};
const PortalContext = createContext<Context | null>(null);
async function request(url: string, method = 'GET', body?: unknown, csrf?: string) {
  return portalRequest(url, { method, body, csrf });
}
export function PortalProvider({ children }: { children: ReactNode }) {
  const [activity, setActivity] = useState<ActivityState | null>(null);
  const epoch = useRef(0),
    lifecycle = useRef(new AbortController());
  const activityInFlight = useRef<{ epoch: number; task: Promise<void> } | null>(null);
  const activityRequest = useRef(0);
  const loadActivity = useCallback(async () => {
    const currentEpoch = epoch.current;
    if (activityInFlight.current?.epoch === currentEpoch) return activityInFlight.current.task;
    const sequence = ++activityRequest.current;
    const task = (async () => {
      try {
        const value = await portalRequest<ActivityState>('/api/activity', {
          signal: lifecycle.current.signal,
        });
        if (sequence === activityRequest.current && currentEpoch === epoch.current)
          setActivity(value);
      } catch {
        /* Keep the last confirmed counts if this optional request fails. */
      }
    })();
    activityInFlight.current = { epoch: currentEpoch, task };
    await task;
    if (activityInFlight.current?.task === task) activityInFlight.current = null;
  }, []);
  const [config, setConfig] = useState<Config | null>(null),
    [data, setData] = useState<PortalState | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const performRefresh = useCallback(async () => {
    const currentEpoch = epoch.current;
    try {
      const value = await portalRequest<PortalState>('/api/state', {
        signal: lifecycle.current.signal,
      });
      if (currentEpoch !== epoch.current) return;
      setData(value);
      void loadActivity();
      setError('');
    } catch (e) {
      if (currentEpoch !== epoch.current) return;
      const err = e as Error & { status?: number };
      if (err.status === 401 || err.status === 403) {
        setData(null);
        setActivity(null);
        activityRequest.current++;
      }
      setError(err.status === 401 ? '' : err.message);
    }
  }, [loadActivity]);
  const refreshQueue = useRef<ReturnType<typeof createRefreshQueue> | null>(null);
  const refresh = useCallback(
    (fresh = false) => {
      if (!refreshQueue.current) refreshQueue.current = createRefreshQueue(performRefresh);
      return refreshQueue.current(fresh);
    },
    [performRefresh],
  );
  const cancelReads = useCallback(() => {
    epoch.current++;
    lifecycle.current.abort();
    activityRequest.current++;
  }, []);
  useEffect(() => {
    if (lifecycle.current.signal.aborted) lifecycle.current = new AbortController();
    let active = true;
    async function init() {
      try {
        await Promise.all([
          portalRequest<Config>('/api/config', { signal: lifecycle.current.signal }).then(
            (value) => {
              if (active) setConfig(value);
            },
          ),
          refresh(true),
        ]);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    let lastBackground = 0;
    const focus = () => {
      if (
        document.visibilityState === 'hidden' ||
        navigator.onLine === false ||
        Date.now() - lastBackground < 5000
      )
        return;
      lastBackground = Date.now();
      void refresh();
    };
    window.addEventListener('focus', focus);
    window.addEventListener('online', focus);
    document.addEventListener('visibilitychange', focus);
    const timer = setInterval(focus, 60000);
    return () => {
      active = false;
      cancelReads();
      window.removeEventListener('focus', focus);
      window.removeEventListener('online', focus);
      document.removeEventListener('visibilitychange', focus);
      clearInterval(timer);
    };
  }, [refresh, cancelReads]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  async function mutate(url: string, method: string, body: unknown) {
    await request(url, method, body, data?.csrf);
    await refresh(true);
  }
  async function loginDemo(role: string) {
    await request('/api/demo-login', 'POST', { role });
    await refresh(true);
  }
  async function logout() {
    await request('/api/logout', 'POST', {}, data?.csrf);
    epoch.current++;
    lifecycle.current.abort();
    lifecycle.current = new AbortController();
    setData(null);
    setActivity(null);
    activityRequest.current++;
    setError('');
  }
  const markActivitySeen = useCallback(
    async (path: string, keys: string[]) => {
      const currentEpoch = epoch.current;
      for (let offset = 0; offset < keys.length; offset += 200) {
        const result = await portalRequest<{ keys: string[] }>('/api/activity/seen', {
          method: 'PUT',
          body: { path, keys: keys.slice(offset, offset + 200) },
          csrf: data?.csrf,
          signal: lifecycle.current.signal,
        });
        if (currentEpoch !== epoch.current) return;
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
