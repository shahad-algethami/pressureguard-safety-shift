'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import { useExperience, useSessionGate } from './experience-context';
import PatientVisual from './patient-visual';
import { currentTask, fallbackGuide } from '@/lib/simulation';
import type { RecordCard } from '@/lib/records';
import { smartMessages, discrepancyHint, documentationFallback } from '@/lib/smart-messages';

export default function ReviewScreen() {
  const s = useSessionGate(),
    { lang, t, busy, act, request } = useExperience(),
    router = useRouter();
  const stage = s ? currentTask(s.progress) : 0;
  const [cards, setCards] = useState<RecordCard[]>([]),
    [recordsError, setRecordsError] = useState(false),
    [reload, setReload] = useState(0),
    [text, setText] = useState(''),
    [noticed, setNoticed] = useState<'yes' | 'no' | null>(null),
    [feedback, setFeedback] = useState<{ text: string; observation: string; lang: string } | null>(
      null,
    ),
    [guide, setGuide] = useState<{ text: string; mode: string } | null>(null);
  const loaded = useRef('');
  useEffect(() => {
    if (!s) return;
    const controller = new AbortController();
    setCards([]);
    setRecordsError(false);
    fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => setCards(d.cards))
      .catch((e) => {
        if (e.name !== 'AbortError') setRecordsError(true);
      });
    return () => controller.abort();
  }, [s?.id, stage, lang, reload]);
  useEffect(() => {
    if (!s || stage === 2) return;
    let active = true;
    setGuide(null);
    fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.text) setGuide(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [s?.id, stage, lang]);
  useEffect(() => {
    if (!s || stage !== 2 || noticed !== 'yes' || !text.trim()) return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const timer = setTimeout(() => {
      void fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'observation-feedback', observation: text, lang }),
        signal: controller.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error('feedback-unavailable');
          return r.json();
        })
        .then((result) => {
          if (active)
            setFeedback({
              text: result.text || documentationFallback[lang],
              observation: text,
              lang,
            });
        })
        .catch(() => {
          if (active) setFeedback({ text: documentationFallback[lang], observation: text, lang });
        })
        .finally(() => clearTimeout(timeout));
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [s?.id, stage, noticed, text, lang]);
  useEffect(() => {
    if (!s || loaded.current === s.id) return;
    loaded.current = s.id;
    const draft = sessionStorage.getItem('pg-draft-' + s.id);
    setText(draft ?? s.progress.observationDraft ?? '');
  }, [s]);
  function updateText(value: string) {
    setText(value);
    if (s) sessionStorage.setItem('pg-draft-' + s.id, value);
  }
  if (!s) return null;
  const p = s.progress,
    titles = [
      t('Verify patient identity', 'تحقق من هوية المريض'),
      t('Compare the procedure', 'قارن الإجراء الجراحي'),
      t('Review the clinical records', 'راجع السجلات السريرية'),
      t('Choose the safe next step', 'اختر الخطوة الآمنة التالية'),
    ];
  async function continueReview() {
    if (noticed !== 'yes') return;
    await act({ type: 'notice-discrepancy', noticed: true, text, lang });
  }
  async function chooseSafe() {
    const result = await act({ type: 'decision', choice: 'verify' });
    if (result) await request('/api/verification', {});
  }
  async function submit() {
    if (!p.request) return;
    const result = await act({ type: 'submit-request', requestId: p.request.id, confirmed: true });
    if (result?.progress.completed) router.push('/complete');
  }
  return (
    <div className="review-page">
      <div className="section-kicker">
        <ShieldCheck size={17} />
        {t('PRESSUREGUARD / PATIENT SAFETY', 'PRESSUREGUARD / سلامة المريض')}
      </div>
      <div className="review-heading">
        <div>
          <h1>{t('The Safety Shift', 'مناوبة السلامة')}</h1>
          <p>
            {t(
              'Review the evidence. Make the safer decision.',
              'راجع الأدلة. اتخذ القرار الأكثر أماناً.',
            )}
          </p>
        </div>
        <span className="pill">{t('FICTIONAL CASE', 'حالة خيالية')} · PG-2048</span>
      </div>
      <ol className="task-track" aria-label={t('Review progress', 'تقدم المراجعة')}>
        {titles.map((title, i) => (
          <li
            key={title}
            className={i === stage ? 'current' : i < stage ? 'done' : ''}
            aria-current={i === stage ? 'step' : undefined}
          >
            <span>{i < stage ? <Check size={15} /> : String(i + 1).padStart(2, '0')}</span>
            <b>{title}</b>
          </li>
        ))}
      </ol>
      <div className="review-layout">
        <aside className="patient-context card">
          <PatientVisual
            verified={p.identityVerified}
            onWristband={
              stage === 0
                ? () =>
                    document
                      .getElementById('record-wristband')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                : undefined
            }
            onRecord={() =>
              document
                .getElementById('active-records')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          />
          <div className="patient-caption">
            <b>{t('Omar Abdullah Al-Harbi', 'عمر عبدالله الحربي')}</b>
            <small>{t('Fictional patient · BED-001', 'مريض خيالي · BED-001')}</small>
          </div>
          <div className="readiness-mini">
            {[
              [t('Identity', 'الهوية'), p.identityVerified],
              [t('Procedure', 'الإجراء'), p.procedureChecked],
              [t('Allergy verification', 'التحقق من الحساسية'), false],
            ].map(([label, ok]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <b className={ok ? 'verified' : 'pending'}>
                  {ok ? t('Matched', 'متطابق') : t('Pending', 'قيد التحقق')}
                </b>
              </div>
            ))}
          </div>
        </aside>
        <section className="task-panel card" aria-labelledby="task-title">
          <div className="task-label">
            {t('TASK', 'المهمة')} {stage + 1} / 4
          </div>
          <h2 id="task-title">{titles[stage]}</h2>
          <div className="agent-notice" role="status">
            <Sparkles size={19} />
            <div>
              <b>
                {t('AI Care Teammate', 'زميلك الذكي')}{' '}
                <small>
                  {guide?.mode === 'live'
                    ? t('LIVE', 'متصل')
                    : guide?.mode === 'demo'
                      ? t('DEMO GUIDE', 'إرشاد تجريبي')
                      : t('GUIDANCE', 'إرشاد')}
                </small>
              </b>
              <p>
                {stage < 2
                  ? smartMessages[lang][stage]
                  : stage === 2
                    ? noticed === 'no'
                      ? discrepancyHint[lang]
                      : noticed === 'yes'
                        ? feedback?.observation === text && feedback.lang === lang
                          ? feedback.text
                          : documentationFallback[lang]
                        : smartMessages[lang][2]
                    : guide?.text || fallbackGuide({ ...s, tokenHash: '', aiCalls: 0 })}
              </p>
            </div>
          </div>
          {stage < 3 && (
            <div
              id="active-records"
              className="record-comparison"
              aria-busy={!cards.length && !recordsError}
            >
              {recordsError ? (
                <button className="secondary" onClick={() => setReload((v) => v + 1)}>
                  {t('Could not load records. Retry', 'تعذر تحميل السجلات. أعد المحاولة')}
                </button>
              ) : !cards.length ? (
                <p role="status">{t('Reading the records…', 'جارٍ قراءة السجلات…')}</p>
              ) : (
                cards.map((card) => (
                  <article className="source-record" id={'record-' + card.id} key={card.id}>
                    <div className="record-title">
                      <FileText size={17} />
                      <h3>{card.title}</h3>
                    </div>
                    <dl>
                      {card.fields.map((f, i) => (
                        <div key={i}>
                          <dt>{f.label}</dt>
                          <dd dir={f.code ? 'ltr' : undefined}>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))
              )}
            </div>
          )}
          {stage < 2 && (
            <>
              <p className="task-question">
                {stage === 0
                  ? t(
                      'Do the full name AND medical record number match?',
                      'هل يتطابق الاسم الكامل ورقم الملف الطبي معاً؟',
                    )
                  : t(
                      'Does the procedure on the schedule match the consent form?',
                      'هل يتطابق الإجراء في جدول العمليات مع نموذج الموافقة؟',
                    )}
              </p>
              <div className="choice-row">
                <button
                  className="primary"
                  disabled={busy || !cards.length}
                  onClick={() =>
                    act({ type: stage === 0 ? 'identity' : 'procedure', decision: 'match' })
                  }
                >
                  {t('Match', 'متطابق')}
                </button>
                <button
                  className="secondary"
                  disabled={busy || !cards.length}
                  onClick={() =>
                    act({ type: stage === 0 ? 'identity' : 'procedure', decision: 'mismatch' })
                  }
                >
                  {t('Mismatch', 'غير متطابق')}
                </button>
              </div>
              {stage === 1 && (
                <p className="fine-print">
                  {t(
                    'This checks documentation consistency only. A signature does not establish valid informed consent or complete the surgical checklist.',
                    'هذه مقارنة لاتساق الوثائق فقط. وجود توقيع لا يثبت صلاحية الموافقة المستنيرة ولا يُكمل قائمة السلامة الجراحية.',
                  )}
                </p>
              )}
            </>
          )}
          {stage === 2 && (
            <div className="observation-flow">
              <fieldset>
                <legend className="task-question">
                  {t(
                    'Did you notice a discrepancy between the two records?',
                    'هل لاحظت اختلافًا بين السجلين؟',
                  )}
                </legend>
                <div className="choice-row">
                  <button
                    type="button"
                    className={noticed === 'yes' ? 'primary' : 'secondary'}
                    aria-pressed={noticed === 'yes'}
                    onClick={() => setNoticed('yes')}
                  >
                    {t('Yes', 'نعم')}
                  </button>
                  <button
                    type="button"
                    className={noticed === 'no' ? 'primary' : 'secondary'}
                    aria-pressed={noticed === 'no'}
                    onClick={() => setNoticed('no')}
                  >
                    {t('No', 'لا')}
                  </button>
                </div>
              </fieldset>
              <label className="task-question" htmlFor="observation">
                {t('Your observation (optional)', 'ملاحظتك (اختياري)')}
              </label>
              <textarea
                id="observation"
                rows={3}
                maxLength={1400}
                value={text}
                onChange={(e) => updateText(e.target.value)}
                placeholder={t(
                  'Describe what the documents show in your own words…',
                  'صف ما يظهر في الوثيقتين بأسلوبك…',
                )}
                disabled={busy}
              />
              <div className="note-actions">
                <small>{text.length} / 1400</small>
                <button
                  className="primary"
                  disabled={busy || noticed !== 'yes'}
                  onClick={continueReview}
                >
                  {t('Continue', 'متابعة')}
                </button>
              </div>
            </div>
          )}
          {stage === 3 && (
            <div className="handoff-flow">
              <div className="approved-note">
                <small>{t('Your approved observation', 'ملاحظتك المعتمدة')}</small>
                <p>{p.approvedObservation}</p>
              </div>
              <span className="status-pending">{t('Pending Verification', 'قيد التحقق')}</span>
              <p>
                {t('What should happen before proceeding?', 'ما الخطوة المطلوبة قبل المتابعة؟')}
              </p>
              <div className="decision-options">
                <button
                  className="secondary"
                  disabled={busy || p.safeDecision}
                  onClick={() => act({ type: 'decision', choice: 'proceed' })}
                >
                  {t('Proceed using one record', 'المتابعة بالاعتماد على سجل واحد')}
                </button>
                <button className="primary" disabled={busy || !!p.request} onClick={chooseSafe}>
                  {busy
                    ? t('Preparing…', 'جارٍ التحضير…')
                    : p.safeDecision
                      ? t('Retry preparing verification request', 'أعد تحضير طلب التحقق')
                      : t('Pause and request verification', 'التوقف وطلب التحقق')}
                </button>
              </div>
              {p.request && (
                <section className="request-preview">
                  <h3>{t('Review the verification request', 'راجع طلب التحقق')}</h3>
                  <p dir={p.request.lang === 'ar' ? 'rtl' : 'ltr'}>{p.request.message}</p>
                  <small>
                    {t(
                      'Recipient: anesthesia / clinical team (simulation). No real clinical message will be sent.',
                      'المستلم: فريق التخدير / الفريق السريري (محاكاة). لن تُرسل رسالة سريرية حقيقية.',
                    )}
                  </small>
                  <button className="primary" disabled={busy} onClick={submit}>
                    {busy
                      ? t('Saving…', 'جارٍ الحفظ…')
                      : t('Confirm and submit request', 'تأكيد وإرسال الطلب')}
                  </button>
                </section>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
