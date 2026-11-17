import {
  compareIdentity,
  compareProcedure,
  allergyConflict,
  patient,
  type Lang,
} from './simulation';
export const evidence = {
  'admission-no-known-allergies': { source: 'admission', text: patient.admissionAllergy },
  'anesthesia-penicillin-rash': { source: 'anesthesia', text: patient.anesthesiaAllergy },
  'allergy-records-conflict': {
    source: 'comparison',
    text: {
      en: 'The allergy records conflict; neither is established as correct.',
      ar: 'معلومات الحساسية متعارضة؛ لم يتم تأكيد صحة أي من السجلين.',
    },
  },
  'verification-required': {
    source: 'comparison',
    text: {
      en: 'Verify the allergy history with the patient when possible and/or the appropriate clinical team before proceeding.',
      ar: 'تحقق من تاريخ الحساسية مع المريض متى أمكن و/أو الفريق السريري المختص قبل المتابعة.',
    },
  },
} as const;
export interface RecordCard {
  id: string;
  title: string;
  fields: { label: string; value: string; code?: boolean }[];
  kind: 'identity' | 'procedure' | 'allergy';
}
export function recordContext(stage: number, lang: Lang) {
  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const name = { label: t('Patient full name', 'اسم المريض الكامل'), value: patient.name[lang] };
  const mrn = {
    label: t('Medical record number', 'رقم الملف الطبي'),
    value: patient.mrn,
    code: true,
  };
  let cards: RecordCard[] = [];
  if (stage === 0)
    cards = [
      {
        id: 'wristband',
        title: t('Patient Wristband', 'سوار المريض'),
        kind: 'identity',
        fields: [name, mrn],
      },
      {
        id: 'medical',
        title: t('Medical Record', 'السجل الطبي'),
        kind: 'identity',
        fields: [name, mrn],
      },
    ];
  if (stage === 1)
    cards = [
      {
        id: 'schedule',
        title: t('Surgical Schedule', 'جدول العمليات'),
        kind: 'procedure',
        fields: [
          name,
          { label: t('Planned procedure', 'الإجراء المخطط'), value: patient.procedure[lang] },
        ],
      },
      {
        id: 'consent',
        title: t('Surgical Consent Form', 'نموذج الموافقة الجراحية'),
        kind: 'procedure',
        fields: [
          {
            label: t('Consented procedure', 'الإجراء الموثق في الموافقة'),
            value: patient.procedure[lang],
          },
          {
            label: t('Documentation status', 'حالة التوثيق'),
            value: t('Signed in this fictional record', 'موقّعة في هذا السجل الخيالي'),
          },
          name,
        ],
      },
    ];
  if (stage >= 2)
    cards = [
      {
        id: 'admission',
        title: t('Admission Medical Record', 'السجل الطبي عند الدخول'),
        kind: 'allergy',
        fields: [
          {
            label: t('Documented allergy information', 'معلومات الحساسية الموثقة'),
            value: patient.admissionAllergy[lang],
          },
        ],
      },
      {
        id: 'anesthesia',
        title: t('Pre-Anesthesia Assessment', 'تقييم ما قبل التخدير'),
        kind: 'allergy',
        fields: [
          {
            label: t('Documented allergy', 'الحساسية الموثقة'),
            value: t('Penicillin', 'البنسلين'),
          },
          {
            label: t('Reported reaction', 'التفاعل المبلغ عنه'),
            value: t('Skin rash — reported by patient', 'طفح جلدي — بحسب إفادة المريض'),
          },
        ],
      },
    ];
  return {
    cards,
    operations:
      stage === 0
        ? ['read_patient_records', 'compare_identifiers']
        : stage === 1
          ? ['read_procedure_records', 'compare_procedure']
          : ['read_allergy_records', 'compare_allergy_records'],
    comparison:
      stage === 0 ? compareIdentity() : stage === 1 ? compareProcedure() : allergyConflict(),
  };
}
