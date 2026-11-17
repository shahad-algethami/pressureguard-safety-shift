'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Fingerprint,
  FileText,
  CheckCheck,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useExperience } from './experience-context';
import PatientVisual from './patient-visual';
export default function WelcomeScreen() {
  const { session, busy, t, start } = useExperience();
  const [name, setName] = useState('');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={17} />
            PRESSUREGUARD / {t('EXPERIENCE', 'التجربة')}
          </div>
          <h1>{t('The Safety Shift', 'مناوبة السلامة')}</h1>
          <p>{t('Your attention. Their safety.', 'انتباهك يصنع الأمان.')}</p>
        </div>
      </div>
      {session && (
        <div className="resume-strip">
          <span>{t('Your previous progress is saved.', 'تقدمك السابق محفوظ.')}</span>
          <Link href={session.progress.completed ? '/complete' : '/review'} className="text-button">
            {session.progress.workflowVersion === 2
              ? t('Return to my shift', 'العودة إلى مناوبتي')
              : t('Earlier session preserved · start below', 'الجلسة السابقة محفوظة · ابدأ أدناه')}
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      <section className="welcome-grid">
        <div className="card welcome-card">
          <div className="eyebrow">
            {t('YOUR NEXT SHIFT STARTS HERE', 'مناوبتك القادمة تبدأ هنا')}
          </div>
          <h2>
            {t('Before the surgery.', 'قبل الجراحة.')}
            <br />
            <span className="text-turquoise">
              {t('Before the first decision.', 'قبل القرار الأول.')}
            </span>
          </h2>
          <p className="welcome-copy">
            {t(
              'Step into the role of an anesthesiologist. Review your patient’s information, work with your AI teammate, and make the decisions that protect patient safety.',
              'تولَّ دور طبيب التخدير. راجع معلومات مريضك، وتعاون مع زميلك الذكي، واتخذ القرارات التي تدعم سلامة المريض.',
            )}
          </p>
          <div className="mini-features">
            <span>
              <Fingerprint size={17} />
              {t('Verify', 'تحقّق')}
            </span>
            <span>
              <FileText size={17} />
              {t('Observe', 'لاحظ')}
            </span>
            <span>
              <CheckCheck size={17} />
              {t('Act', 'تصرّف')}
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void start(name);
            }}
          >
            <label htmlFor="visitor-name">{t('Your display name', 'اسم العرض')}</label>
            <input
              id="visitor-name"
              name="name"
              autoComplete="given-name"
              required
              minLength={2}
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Your first name or display name', 'اسمك الأول أو اسم العرض')}
            />
            <small className="privacy-note">
              {t(
                'No account needed. Your name is private unless you choose to join the wall. “Dr.” is a role-play title.',
                'لا تحتاج إلى حساب. اسمك خاص حتى توافق على عرضه في اللوحة. لقب «د.» جزء من تمثيل الدور.',
              )}
            </small>
            <button
              className="button primary start-button"
              disabled={busy || name.trim().length < 2}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  {t('Start My Shift', 'ابدأ مناوبتي')}
                  <ArrowRight size={19} />
                </>
              )}
            </button>
          </form>
          <div className="welcome-disclaimer">
            <ShieldCheck size={16} />
            {t(
              'A standalone educational activity inspired by selected WHO surgical safety principles.',
              'نشاط تعليمي مستقل مستوحى من مبادئ مختارة لمنظمة الصحة العالمية للسلامة الجراحية.',
            )}
          </div>
        </div>
        <div className="card welcome-patient">
          <div className="section-heading">
            <div>
              <div className="eyebrow">{t('YOUR PATIENT IS WAITING', 'مريضك بانتظارك')}</div>
              <h3>{t('Every detail matters.', 'كل تفصيل مهم.')}</h3>
            </div>
            <span className="subtle-badge">{t('SIMULATED', 'محاكاة')}</span>
          </div>
          <PatientVisual />
          <div className="patient-preview-info">
            <span>
              <span className="live-dot" />
              {t('Preoperative room', 'غرفة ما قبل الجراحة')}
            </span>
            <strong>PG-2048</strong>
          </div>
        </div>
      </section>
    </>
  );
}
