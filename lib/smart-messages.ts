import type { Lang } from './simulation';
export const smartMessages = {
  en: [
    'Ready for your mission, Doctor? 🩺 Patient safety starts with the details! Review the identity information carefully and make your decision.',
    'First mission complete! 👏 A new challenge awaits: Does the surgical procedure match across both documents? Stay focused—every detail matters!',
    'This is the critical moment, Doctor! 🔍 Examine both records carefully. Sometimes a small discrepancy can reveal a major safety risk!',
  ],
  ar: [
    'جاهز للمهمة يا دكتور/ة؟ 🩺 سلامة المريض تبدأ من التفاصيل! راجع بيانات الهوية بعناية واتخذ قرارك بثقة.',
    'مهمة أولى اكتملت! 👏 الآن أمامك تحدٍ جديد: هل الإجراء الجراحي متطابق في الوثيقتين؟ ركّز، فكل تفصيل مهم!',
    'وصلنا للحظة الحاسمة يا دكتور/ة! 🔍 راجع السجلين بعين الخبير. أحيانًا اختلاف صغير يكشف خطرًا كبيرًا!',
  ],
} as const;
export const discrepancyHint: Record<Lang, string> = {
  ar: 'خلينا نراجع مرة ثانية يا دكتور/ة! 🔍 ركّز على معلومات الحساسية في السجلين. هل المعلومات متطابقة؟',
  en: 'Let’s take another look, Doctor! 🔍 Focus on the allergy information in both records. Do they match?',
};
export const documentationFallback: Record<Lang, string> = {
  ar: 'ممتاز يا دكتور/ة! 👏 انتباهك للتفاصيل مهم لسلامة المريض. الخطوة التالية هي توثيق الملاحظة وطلب التحقق من المعلومات.',
  en: 'Great work, Doctor! 👏 Attention to detail is essential for patient safety. The next step is to document the observation and request verification.',
};
