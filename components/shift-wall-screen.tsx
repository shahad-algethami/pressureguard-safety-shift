'use client';
import { useState } from 'react';
import Link from 'next/link';
import Wall from './wall';
import { useExperience } from './experience-context';
export default function ShiftWallScreen() {
  const { session: s, lang, t, busy, request } = useExperience(),
    [skip, setSkip] = useState(false);
  async function consent(value: boolean) {
    const result = await request('/api/wall', { consent: value });
    if (result) {
      window.dispatchEvent(new Event('pg-wall-change'));
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('pg-wall');
        channel.postMessage('refresh');
        channel.close();
      }
    }
  }
  return (
    <div className="shift-wall-page">
      {s?.progress.completed && !s.progress.joined && !skip && (
        <section className="wall-consent card">
          <div>
            <h1>{t('Your shift. Our shared commitment.', 'مناوبتك… والتزامنا المشترك.')}</h1>
            <p>
              {t(
                'Join The Shift Team? Your name will be displayed publicly on this wall and exhibition screens. Participation is optional; you can remove your name from this session.',
                'هل تنضم لفريق المناوبة؟ سيظهر اسمك علناً على هذا الجدار وشاشات المعرض. المشاركة اختيارية ويمكنك إزالة اسمك من هذه الجلسة.',
              )}
            </p>
          </div>
          <div className="choice-row">
            <button className="primary" disabled={busy} onClick={() => consent(true)}>
              {t('Join the wall', 'انضم للجدار')}
            </button>
            <button className="secondary" onClick={() => setSkip(true)}>
              {t('Not now', 'ليس الآن')}
            </button>
          </div>
        </section>
      )}
      {s?.progress.joined && (
        <div className="joined-notice">
          <span>{t('Your name is part of The Shift Team.', 'اسمك الآن ضمن فريق المناوبة.')}</span>
          <button className="text-button" disabled={busy} onClick={() => consent(false)}>
            {t('Remove my name', 'إزالة اسمي')}
          </button>
        </div>
      )}
      <Wall lang={lang} highlightId={s?.progress.joined ? s.id : undefined} />
      <div className="wall-page-links">
        <Link href="/wall" target="_blank">
          {t('Open exhibition display', 'فتح شاشة المعرض')}
        </Link>
        <Link href="/">{t('Return to welcome', 'العودة للترحيب')}</Link>
      </div>
    </div>
  );
}
