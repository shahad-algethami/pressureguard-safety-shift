'use client';
import Link from 'next/link';
import { Check, ShieldCheck, ArrowUpRight, Download } from 'lucide-react';
import { useExperience, useSessionGate } from './experience-context';
export default function CompleteScreen() {
  const s = useSessionGate(true),
    { t } = useExperience();
  if (!s) return null;
  const checks = [
    t('Two patient identifiers matched', 'تمت مطابقة معرّفين للمريض'),
    t('Procedure records compared', 'تمت مقارنة وثائق الإجراء'),
    t('Discrepancy identified and documented', 'تم تحديد التعارض وتوثيقه'),
    t('Safer decision selected', 'تم اختيار القرار الأكثر أماناً'),
    t('Verification request submitted', 'تم إرسال طلب التحقق'),
  ];
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            visitor: s!.name,
            patient: 'PG-2048',
            completedAt: s!.progress.request?.submittedAt,
            checks,
            observation: s!.progress.approvedObservation,
            request: s!.progress.request,
            educationalOnly: true,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'pressureguard-safety-shift.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="completion-page card">
      <div className="completion-emblem">
        <ShieldCheck size={42} />
      </div>
      <div className="section-kicker">{t('SHIFT COMPLETE', 'اكتملت المناوبة')}</div>
      <h1>
        {t('Well done, Dr. ', 'أحسنت يا د. ')}
        {s.name}
      </h1>
      <p>
        {t(
          'You made the discrepancy visible and chose verification before proceeding.',
          'أظهرت التعارض واخترت التحقق قبل المتابعة.',
        )}
      </p>
      <small>
        {t(
          'Doctor title is part of this educational roleplay.',
          'لقب الطبيب جزء من تقمّص الدور التعليمي.',
        )}
      </small>
      <ul className="completion-checks">
        {checks.map((c) => (
          <li key={c}>
            <Check size={18} />
            {c}
          </li>
        ))}
      </ul>
      <div className="pending-result">
        <span className="status-pending">{t('Pending Verification', 'قيد التحقق')}</span>
        <p>
          {t(
            'The allergy discrepancy remains unresolved. Finishing this experience does not mean the patient is ready for surgery.',
            'تعارض الحساسية ما زال غير محسوم. إكمال التجربة لا يعني أن المريض جاهز للجراحة.',
          )}
        </p>
      </div>
      <details>
        <summary>{t('View your documented handoff', 'عرض التوثيق والتسليم')}</summary>
        <p>{s.progress.approvedObservation}</p>
        <p>{s.progress.request?.message}</p>
      </details>
      <div className="choice-row">
        <Link className="primary" href="/shift-wall">
          {t('Meet The Shift Team', 'انضم إلى فريق المناوبة')}
          <ArrowUpRight size={18} />
        </Link>
        <button className="secondary" onClick={download}>
          <Download size={16} />
          {t('Save summary', 'حفظ الملخص')}
        </button>
      </div>
    </section>
  );
}
