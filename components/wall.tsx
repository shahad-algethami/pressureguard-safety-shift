'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Maximize, Minimize, ShieldCheck, Users } from 'lucide-react';
import type { Lang } from '@/lib/simulation';
type Participant = { id: string; name: string; created_at: string };
export default function Wall({
  lang = 'en',
  standalone = false,
  highlightId,
}: {
  lang?: Lang;
  standalone?: boolean;
  highlightId?: string;
}) {
  const [people, setPeople] = useState<Participant[]>([]),
    [error, setError] = useState(false),
    [storage, setStorage] = useState('local'),
    [full, setFull] = useState(false),
    [page, setPage] = useState(0),
    [locale, setLocale] = useState<Lang>(lang),
    [capacity, setCapacity] = useState(24);
  const ref = useRef<HTMLDivElement>(null);
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en);
  useEffect(() => setLocale(lang), [lang]);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setCapacity(width < 600 ? 8 : width < 900 ? 16 : 24);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/wall', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setPeople(data.participants);
      setStorage(data.storage);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const client = url && key ? createClient(url, key) : null;
    const channel = client
      ?.channel('shift-team')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => void refresh(),
      )
      .subscribe();
    const local = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pg-wall') : null;
    if (local) local.onmessage = () => void refresh();
    const listener = () => void refresh();
    window.addEventListener('pg-wall-change', listener);
    return () => {
      clearInterval(timer);
      local?.close();
      window.removeEventListener('pg-wall-change', listener);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [refresh]);
  useEffect(() => {
    const listener = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () => setPage((p) => (p + 1) % Math.max(1, Math.ceil(people.length / capacity))),
      12000,
    );
    return () => clearInterval(timer);
  }, [people.length, capacity]);
  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (ref.current?.requestFullscreen) await ref.current.requestFullscreen();
      else setFull((v) => !v);
    } catch {
      setFull((v) => !v);
    }
  }
  const shown = people.slice(
    (page % Math.max(1, Math.ceil(people.length / capacity))) * capacity,
    (page % Math.max(1, Math.ceil(people.length / capacity))) * capacity + capacity,
  );
  const nodes = shown.map((p, i) => {
    const angle = i * 2.399963;
    const radius = shown.length === 1 ? 22 : 20 + Math.sqrt(i / Math.max(shown.length - 1, 1)) * 24;
    return { ...p, x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
  });
  return (
    <div
      ref={ref}
      className={`team-wall card ${standalone ? 'standalone' : ''} ${full ? 'is-fullscreen' : ''}`}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="wall-toolbar">
        <a className="wall-brand" href="/">
          <ShieldCheck size={28} />
          <strong>
            PressureGuard <span>AI</span>
          </strong>
        </a>
        <div>
          <span className={`wall-live ${error ? 'amber' : ''}`}>
            <i className="live-dot" />
            {error
              ? t('Reconnecting', 'إعادة الاتصال')
              : storage === 'supabase'
                ? t('LIVE NETWORK', 'شبكة مباشرة')
                : t('LOCAL DEMO', 'عرض محلي')}
          </span>
          {standalone && (
            <button
              className="text-button"
              onClick={() => setLocale((l) => (l === 'en' ? 'ar' : 'en'))}
            >
              {locale === 'en' ? 'العربية' : 'English'}
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => void toggleFull()}
            aria-label={t('Toggle fullscreen', 'تبديل ملء الشاشة')}
          >
            {full ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
      <div className="wall-intro">
        <div className="eyebrow">{t('CONNECTED BY CARE', 'تجمعنا الرعاية')}</div>
        <h2>
          {t('The Shift Team', 'فريق المناوبة')} <span>|</span>{' '}
          {t('فريق المناوبة', 'The Shift Team')}
        </h2>
        <p>
          {t(
            'Every name is a commitment. Every connection makes us stronger.',
            'كل اسم التزام، وكل اتصال يجعلنا أقوى.',
          )}
        </p>
      </div>
      <div
        className="network"
        aria-label={t('Consenting participants', 'المشاركون الموافقون على العرض')}
      >
        <div className="network-grid" />
        <svg
          className="network-lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="networkglow">
              <stop stopColor="#31d6d0" stopOpacity=".12" />
              <stop offset="1" stopColor="#31d6d0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="50" cy="50" rx="44" ry="44" fill="url(#networkglow)" />
          {nodes.map((p, i) => (
            <g key={p.id}>
              <line x1="50" y1="50" x2={p.x} y2={p.y} />
              {i > 0 && (
                <line
                  x1={nodes[i - 1].x}
                  y1={nodes[i - 1].y}
                  x2={p.x}
                  y2={p.y}
                  className="secondary-line"
                />
              )}
            </g>
          ))}
        </svg>
        <div className="network-center">
          <ShieldCheck size={36} />
          <span>{t('PATIENT SAFETY', 'سلامة المريض')}</span>
        </div>
        {nodes.map((p, i) => (
          <div
            className={`person-node node-${i % 3} ${p.id === highlightId ? 'new-participant' : ''}`}
            key={p.id}
            style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${i * 0.14}s` }}
          >
            <i />
            <span title={p.name}>{p.name}</span>
          </div>
        ))}
        {!people.length && (
          <div className="wall-empty">
            <Users size={24} />
            <strong>{t('Be the first light in the network.', 'كن أول نور في الشبكة.')}</strong>
            <p>
              {t(
                'Complete your shift and choose to add your name.',
                'أكمل مناوبتك واختر إضافة اسمك.',
              )}
            </p>
          </div>
        )}
      </div>
      <div className="wall-bottom">
        <span>
          <b>{people.length}</b> {t('people connected by care', 'شخصاً تجمعهم الرعاية')}
        </span>
        <span>{t('Safer together. Always.', 'معاً، أكثر أماناً. دائماً.')}</span>
        {people.length > 24 && (
          <span>{t('Rotating through all participants', 'عرض جميع المشاركين بالتناوب')}</span>
        )}
      </div>
      {standalone && (
        <a href="/" className="wall-back">
          {t('Start your safety shift ↗', 'ابدأ مناوبة السلامة ↗')}
        </a>
      )}
    </div>
  );
}
