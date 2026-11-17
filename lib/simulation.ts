import { z } from 'zod';
import type { NoteReview, VerificationRequest } from './review-types';
export type Lang = 'en' | 'ar';
// Preserve the original case. These source records are never changed by AI or visitors.
export const patient = {
  name: { en: 'Omar Abdullah Al-Harbi', ar: 'عمر عبدالله الحربي' },
  dob: '1984-03-12',
  mrn: 'PG-2048',
  bed: 'BED-001',
  procedure: { en: 'Laparoscopic cholecystectomy', ar: 'استئصال المرارة بالمنظار' },
  site: { en: 'Abdomen; laterality not applicable', ar: 'البطن؛ تحديد الجانب غير منطبق' },
  admissionAllergy: { en: 'No known drug allergies', ar: 'لا توجد حساسية دوائية معروفة' },
  anesthesiaAllergy: {
    en: 'Penicillin — rash reported by patient',
    ar: 'البنسلين — طفح جلدي بحسب إفادة المريض',
  },
} as const;
export const documents = ['wristband', 'admission', 'anesthesia', 'consent'] as const;
export type DocumentId = (typeof documents)[number];
export const sourceRecords = {
  wristband: { name: patient.name.en, mrn: patient.mrn as string },
  medical: { name: patient.name.en, mrn: patient.mrn as string },
  schedule: { name: patient.name.en, procedure: 'laparoscopic-cholecystectomy' },
  consent: { name: patient.name.en, procedure: 'laparoscopic-cholecystectomy', signed: true },
  admission: { allergy: 'none-known' },
  anesthesia: { allergy: 'penicillin', reaction: 'reported-rash' },
};
export function compareIdentity(r = sourceRecords) {
  return r.wristband.name === r.medical.name && r.wristband.mrn === r.medical.mrn;
}
export function compareProcedure(r = sourceRecords) {
  return r.schedule.name === r.consent.name && r.schedule.procedure === r.consent.procedure;
}
export function allergyConflict(r = sourceRecords) {
  return r.admission.allergy !== r.anesthesia.allergy;
}
export interface Progress {
  workflowVersion: number;
  opened: DocumentId[];
  identifiers: string[];
  identityVerified: boolean;
  procedureChecked: boolean;
  discrepancy: boolean;
  handoff: boolean;
  note: string;
  recipient: string;
  completed: boolean;
  joined: boolean;
  lastAction: string;
  version: number;
  observationOriginal: string;
  observationDraft: string;
  reviews: NoteReview[];
  approvedObservation: string;
  approvedReviewId: string | null;
  safeDecision: boolean;
  request: VerificationRequest | null;
}
export interface Session {
  id: string;
  tokenHash: string;
  name: string;
  lang: Lang;
  createdAt: string;
  progress: Progress;
  aiCalls: number;
}
export const initialProgress = (): Progress => ({
  workflowVersion: 2,
  opened: [],
  identifiers: [],
  identityVerified: false,
  procedureChecked: false,
  discrepancy: false,
  handoff: false,
  note: '',
  recipient: '',
  completed: false,
  joined: false,
  lastAction: 'welcome',
  version: 0,
  observationOriginal: '',
  observationDraft: '',
  reviews: [],
  approvedObservation: '',
  approvedReviewId: null,
  safeDecision: false,
  request: null,
});
export function normalizeSession(s: Session): Session {
  return {
    ...s,
    progress: {
      ...initialProgress(),
      ...s.progress,
      workflowVersion: s.progress.workflowVersion ?? 1,
    },
  };
}
export const nameSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[\p{L}\p{M} .'-]+$/u, 'Use letters for your display name.');
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('identity'), decision: z.enum(['match', 'mismatch']) }),
  z.object({ type: z.literal('procedure'), decision: z.enum(['match', 'mismatch']) }),
  z.object({ type: z.literal('save-draft'), text: z.string().max(1400) }),
  z.object({
    type: z.literal('notice-discrepancy'),
    noticed: z.literal(true),
    text: z.string().max(1400),
    lang: z.enum(['en', 'ar']),
  }),
  z.object({
    type: z.literal('approve-note'),
    reviewId: z.string().uuid(),
    text: z.string().trim().min(1).max(1400),
  }),
  z.object({ type: z.literal('decision'), choice: z.enum(['verify', 'proceed']) }),
  z.object({
    type: z.literal('submit-request'),
    requestId: z.string().uuid(),
    confirmed: z.literal(true),
  }),
  z.object({ type: z.literal('language'), lang: z.enum(['en', 'ar']) }),
]);
export type Action = z.infer<typeof actionSchema>;
export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function transition(progress: Progress, action: Action): Progress {
  const p = structuredClone(progress);
  if (p.workflowVersion !== 2 && action.type !== 'language') throw new RuleError('legacySession');
  if (action.type === 'submit-request') throw new RuleError('submissionRequired');
  if (p.completed && action.type !== 'language') throw new RuleError('completed');
  if (action.type === 'identity') {
    if (action.decision !== 'match' || !compareIdentity()) throw new RuleError('identityRetry');
    p.identifiers = ['name', 'mrn'];
    p.identityVerified = true;
  }
  if (action.type === 'procedure') {
    if (!p.identityVerified) throw new RuleError('verifyIdentity');
    if (action.decision !== 'match' || !compareProcedure()) throw new RuleError('procedureRetry');
    p.procedureChecked = true;
  }
  if (action.type === 'save-draft') {
    if (!p.procedureChecked) throw new RuleError('procedureFirst');
    if (p.approvedObservation) throw new RuleError('noteLocked');
    p.observationDraft = action.text;
  }
  if (action.type === 'notice-discrepancy') {
    if (!p.identityVerified || !p.procedureChecked || !allergyConflict())
      throw new RuleError('reviewFirst');
    if (p.approvedObservation) throw new RuleError('noteLocked');
    p.observationOriginal ||= action.text;
    p.observationDraft = action.text;
    // Existing handoff contract: a visitor acknowledgement, not an AI review.
    // Preserve raw writing separately; never present its unverified claims as facts.
    p.approvedReviewId = 'visitor-discrepancy-acknowledgement';
    p.approvedObservation =
      action.lang === 'ar'
        ? 'لاحظ الزائر تعارضاً بين معلومات الحساسية في السجلين. يلزم طلب التحقق قبل الاعتماد على المعلومات. الحالة: قيد التحقق.'
        : 'The visitor noticed conflicting allergy documentation. Verification is required before relying on the information. Status: Pending Verification.';
    p.note = p.approvedObservation;
    p.discrepancy = true;
    p.safeDecision = false;
    p.request = null;
  }
  if (action.type === 'approve-note') {
    // Legacy reviewed-note flow remains available; Stage 3 no longer invokes it.
    if (!p.identityVerified || !p.procedureChecked || !allergyConflict())
      throw new RuleError('reviewFirst');
    const review = p.reviews.find((r) => r.id === action.reviewId);
    if (
      !review ||
      review.id !== p.reviews.at(-1)?.id ||
      review.status !== 'sufficient' ||
      !review.accurate ||
      !review.identifiesDiscrepancy ||
      review.unsupportedClaims.length
    )
      throw new RuleError('reviewRequired');
    if (
      action.text !== review.input &&
      !(review.suggestionVerified && action.text === review.suggestedNote)
    )
      throw new RuleError('editNeedsReview');
    p.approvedObservation = action.text;
    p.approvedReviewId = review.id;
    p.note = action.text;
    p.discrepancy = true;
    p.safeDecision = false;
    p.request = null;
  }
  if (action.type === 'decision') {
    if (!p.approvedObservation || !p.approvedReviewId) throw new RuleError('approveFirst');
    if (action.choice !== 'verify') throw new RuleError('unsafeDecision');
    p.safeDecision = true;
  }
  p.lastAction = action.type;
  p.version++;
  return p;
}
export function assertSubmission(p: Progress, requestId: string) {
  if (
    p.workflowVersion !== 2 ||
    !p.identityVerified ||
    !p.procedureChecked ||
    !p.discrepancy ||
    !p.approvedReviewId ||
    !p.approvedObservation ||
    !p.safeDecision ||
    !p.request ||
    p.request.id !== requestId ||
    p.request.observation !== p.approvedObservation ||
    p.request.status !== 'pending-verification' ||
    !allergyConflict()
  )
    throw new RuleError('requestNotReady');
}
export function completeProgress(p: Progress, requestId: string, submittedAt: string): Progress {
  assertSubmission(p, requestId);
  return {
    ...p,
    handoff: true,
    completed: true,
    recipient: 'anesthesia-team',
    request: { ...p.request!, submittedAt },
    lastAction: 'submitted',
    version: p.version + 1,
  };
}
export function currentTask(p: Progress): number {
  return !p.identityVerified ? 0 : !p.procedureChecked ? 1 : !p.approvedObservation ? 2 : 3;
}
export function readiness(p: Progress) {
  return {
    identity: p.identityVerified ? 'verified' : 'not-verified',
    procedure: p.procedureChecked ? 'reviewed' : 'not-reviewed',
    clinical: 'pending-verification',
    handoff: p.handoff ? 'documented' : 'not-documented',
    overall: 'pending-verification',
    completed: p.completed,
  };
}
export function summary(s: Pick<Session, 'name' | 'lang' | 'progress'>) {
  return (
    (s.lang === 'ar'
      ? 'محاكاة تعليمية — المريض الخيالي PG-2048. سجل الدخول: لا توجد حساسية دوائية معروفة. تقييم التخدير: حساسية للبنسلين مع طفح بحسب إفادة المريض. يلزم التحقق مع المريض والفريق السريري قبل المتابعة. الحالة: بانتظار التحقق. '
      : 'Educational simulation — fictional patient PG-2048. Admission: no known drug allergies. Anesthesia assessment: patient-reported penicillin rash. Verify with the patient and clinical team before proceeding. Status: Pending Verification. ') +
    (s.progress.approvedObservation || s.progress.note) +
    (s.lang === 'ar'
      ? ' هذا طلب تعليمي محاكى؛ لا تُرسل رسالة إلى فريق سريري حقيقي.'
      : ' This is an educational request; no message is sent to a real clinical team.')
  );
}
export function fallbackGuide(s: Session): string {
  const ar = s.lang === 'ar',
    p = s.progress;
  if (p.completed)
    return ar
      ? 'عمل جماعي رائع يا دكتور. تم حفظ طلب التحقق، وما زالت الحالة بانتظار التحقق.'
      : 'Great teamwork, Doctor. Your request was saved; the patient remains Pending Verification.';
  if (p.request)
    return ar
      ? 'طلب التحقق جاهز لمراجعتك. لن يُحفظ كطلب مُقدّم إلا بعد تأكيدك.'
      : 'The verification request is ready for your review. It is not submitted until you confirm.';
  if (p.approvedObservation)
    return ar
      ? 'يا دكتور، ما زال تعارض الحساسية غير محسوم. ما الإجراء المناسب قبل المتابعة؟'
      : 'Doctor, the allergy discrepancy is unresolved. What should we do before proceeding?';
  if (p.procedureChecked)
    return ar
      ? 'راجع معلومات الحساسية في السجلين واكتب ما لاحظته بكلماتك.'
      : 'Review the allergy information in both records and write what you noticed in your own words.';
  if (p.identityVerified)
    return ar
      ? 'لنراجع الإجراء المخطط والموافقة الموثقة.'
      : 'Let’s review the planned procedure and documented consent.';
  return ar
    ? 'مرحباً د. ' + s.name + '. لنراجع اسم المريض ورقم ملفه في المصدرين.'
    : 'Welcome, Dr. ' +
        s.name +
        '. Let’s compare the patient’s name and medical record number in both sources.';
}
