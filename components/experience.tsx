'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  BedDouble,
  ClipboardCheck,
  Users,
  AlertTriangle,
  X,
  LoaderCircle,
} from 'lucide-react';
import { useExperience } from './experience-context';
export default function Experience({ children }: { children: React.ReactNode }) {
  const { session, lang, loading, busy, error, setError, changeLanguage, t } = useExperience();
  const path = usePathname();
  const nav = [
    { href: '/', icon: LayoutDashboard, label: t('Start my shift', 'ابدأ مناوبتي') },
    { href: '/review', icon: BedDouble, label: t('Patient safety review', 'مراجعة سلامة المريض') },
    { href: '/complete', icon: ClipboardCheck, label: t('Shift completed', 'اكتملت المناوبة') },
    { href: '/shift-wall', icon: Users, label: t('The Shift Wall', 'لوحة المناوبة') },
  ];
  return (
    <div className="app-shell refined-shell" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-shield">
            <ShieldCheck />
          </span>
          <div>
            <strong dir="ltr">
              PressureGuard <em>AI</em>
            </strong>
            <small>CLINICAL INTELLIGENCE</small>
          </div>
        </Link>
        <div className="workspace-label">{t('THE SAFETY SHIFT', 'مناوبة السلامة')}</div>
        <nav>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path === n.href ? 'page' : undefined}
              className={'nav-item ' + (path === n.href ? 'active' : '')}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
              {path === n.href && <i />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className={'live-dot ' + (!session?.aiConfigured ? 'amber' : '')} />
            <div>
              <strong>{t('AI Teammate', 'الزميل الذكي')}</strong>
              <small>
                {session?.aiConfigured
                  ? t('Connection configured', 'تم إعداد الاتصال')
                  : t('Demo guidance', 'إرشاد تجريبي')}
              </small>
            </div>
          </div>
          <span className="sidebar-foot">
            <ShieldCheck size={14} />
            {t('Fictional data. Real safety thinking.', 'بيانات خيالية. وعي حقيقي بالسلامة.')}
          </span>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <Link href="/" className="breadcrumb">
            <span>PRESSUREGUARD</span>
            <b>/</b>
            {t('The Safety Shift', 'مناوبة السلامة')}
          </Link>
          <div className="topbar-actions">
            <span className="demo-badge">
              <span className="live-dot" />
              {t('EDUCATIONAL SIMULATION', 'محاكاة تعليمية')}
            </span>
            <div className="language-switch" aria-label={t('Language', 'اللغة')}>
              <button
                disabled={busy}
                className={lang === 'ar' ? 'selected' : ''}
                onClick={() => void changeLanguage('ar')}
              >
                العربية
              </button>
              <button
                disabled={busy}
                className={lang === 'en' ? 'selected' : ''}
                onClick={() => void changeLanguage('en')}
              >
                English
              </button>
            </div>
            <span className="avatar">{session?.name.slice(0, 2).toUpperCase() || 'PG'}</span>
          </div>
        </header>
        <main id="main-content">
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button aria-label={t('Dismiss', 'إغلاق')} onClick={() => setError('')}>
                <X size={18} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="route-loading" role="status">
              <LoaderCircle className="spin" />
              {t('Restoring your shift…', 'أستعيد مناوبتك…')}
            </div>
          ) : (
            children
          )}
          <footer className="page-footer">
            <span>PressureGuard AI · {t('The Safety Shift', 'مناوبة السلامة')}</span>
            <span>
              {t(
                'Educational simulation only. Not for real clinical decision-making.',
                'محاكاة تعليمية فقط. ليست لاتخاذ قرارات سريرية فعلية.',
              )}
            </span>
            <a
              href="https://www.who.int/teams/integrated-health-services/patient-safety/research/safe-surgery"
              target="_blank"
              rel="noreferrer"
            >
              {t('Selected WHO safety principles', 'مبادئ مختارة من منظمة الصحة العالمية')} ↗
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
