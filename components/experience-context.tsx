'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Lang, Progress, Action } from '@/lib/simulation';
import { errorMessage } from '@/lib/messages';
export type ClientSession = {
  id: string;
  name: string;
  lang: Lang;
  createdAt: string;
  progress: Progress;
  storage: 'local' | 'supabase';
  aiConfigured: boolean;
};
type Context = {
  session: ClientSession | null;
  lang: Lang;
  loading: boolean;
  busy: boolean;
  error: string;
  setError: (s: string) => void;
  request: (path: string, data: unknown) => Promise<ClientSession | null>;
  act: (a: Action) => Promise<ClientSession | null>;
  changeLanguage: (l: Lang) => Promise<void>;
  start: (name: string) => Promise<void>;
  t: (en: string, ar: string) => string;
  refresh: () => Promise<void>;
};
const ExperienceContext = createContext<Context | null>(null);
export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null),
    [lang, setLang] = useState<Lang>('en'),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const router = useRouter(),
    lock = useRef(false);
  const refresh = useCallback(async () => {
    const r = await fetch('/api/session', { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      setSession(data);
      setLang(data.lang);
    } else if (r.status === 401) setSession(null);
    else throw new Error('REQUEST_FAILED');
  }, []);
  useEffect(() => {
    const saved = localStorage.getItem('pg-language');
    if (saved === 'ar' || saved === 'en') setLang(saved);
    void refresh()
      .catch(() => setError('REQUEST_FAILED'))
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('pg-language', lang);
  }, [lang]);
  const request = useCallback(
    async (path: string, data: unknown) => {
      if (lock.current) return null;
      lock.current = true;
      setBusy(true);
      setError('');
      try {
        const r = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await r.json();
        if (!r.ok) {
          if (r.status === 409) await refresh();
          throw new Error(result.error || 'REQUEST_FAILED');
        }
        setSession(result);
        setLang(result.lang);
        return result as ClientSession;
      } catch (e) {
        setError((e as Error).message || 'REQUEST_FAILED');
        return null;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  const act = (a: Action) => request('/api/session', a);
  async function changeLanguage(l: Lang) {
    if (busy) return;
    if (session) {
      await act({ type: 'language', lang: l });
    } else setLang(l);
  }
  async function start(name: string) {
    const s = await request('/api/session', { type: 'start', name, lang });
    if (s) router.push('/review');
  }
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  return (
    <ExperienceContext.Provider
      value={{
        session,
        lang,
        loading,
        busy,
        error: error ? errorMessage(error, lang) : '',
        setError,
        request,
        act,
        changeLanguage,
        start,
        t,
        refresh,
      }}
    >
      {children}
    </ExperienceContext.Provider>
  );
}
export function useExperience() {
  const c = useContext(ExperienceContext);
  if (!c) throw new Error('ExperienceProvider required');
  return c;
}
export function useSessionGate(completed = false) {
  const { session, loading } = useExperience();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!session || session.progress.workflowVersion !== 2) router.replace('/');
    else if (completed && !session.progress.completed) router.replace('/review');
    else if (!completed && session.progress.completed) router.replace('/complete');
  }, [session, loading, completed, router]);
  return !loading &&
    session?.progress.workflowVersion === 2 &&
    (completed ? session.progress.completed : !session.progress.completed)
    ? session
    : null;
}
