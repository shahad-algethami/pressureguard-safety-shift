import type { Lang } from './simulation';
const errors: Record<string, [string, string]> = {
  DATABASE_NOT_CONFIGURED: [
    'Session storage is not connected. Ask the exhibition operator to connect Supabase.',
    'تخزين الجلسات غير متصل. اطلب من مسؤول المعرض إعداد Supabase.',
  ],
  identityRetry: [
    'Take another look at the patient’s name and medical record number.',
    'راجع اسم المريض ورقم ملفه في المصدرين مرة أخرى.',
  ],
  procedureRetry: [
    'Compare the planned procedure with the documented consent again.',
    'قارن الإجراء المخطط بما هو موثق في الموافقة مرة أخرى.',
  ],
  unsafeDecision: [
    'The allergy information remains unverified. Please reconsider the appropriate next step.',
    'معلومات الحساسية ما زالت غير متحقق منها. أعد النظر في الخطوة المناسبة.',
  ],
  verifyIdentity: ['Complete the identity check first.', 'أكمل مراجعة الهوية أولاً.'],
  procedureFirst: ['Complete the procedure comparison first.', 'أكمل مقارنة الإجراء أولاً.'],
  reviewFirst: ['Complete the preceding checks first.', 'أكمل الخطوات السابقة أولاً.'],
  reviewRequired: [
    'Review the observation with AI before approving it.',
    'راجع الملاحظة مع الذكاء الاصطناعي قبل اعتمادها.',
  ],
  editNeedsReview: [
    'The wording changed. Review this version with AI before approving it.',
    'تغير النص. راجع هذه النسخة مع الذكاء الاصطناعي قبل اعتمادها.',
  ],
  approveFirst: [
    'Approve your reviewed observation first.',
    'اعتمد الملاحظة التي تمت مراجعتها أولاً.',
  ],
  requestNotReady: [
    'The request is not ready. Complete the observation and safety decision.',
    'الطلب غير جاهز. أكمل اعتماد الملاحظة وقرار السلامة.',
  ],
  AI_NOT_CONFIGURED: [
    'Live AI review is not connected. Your writing is preserved; retry after the connection is configured.',
    'مراجعة الذكاء الاصطناعي المباشرة غير متصلة. كتابتك محفوظة؛ أعد المحاولة بعد إعداد الاتصال.',
  ],
  AI_AUTH_ERROR: [
    'The AI connection could not authenticate. Your writing is preserved. Ask the exhibition operator to check the key.',
    'تعذر توثيق اتصال الذكاء الاصطناعي. كتابتك محفوظة. اطلب من مسؤول المعرض فحص المفتاح.',
  ],
  AI_RATE_LIMIT: [
    'The AI service is temporarily at its limit. Your note is preserved; please retry shortly.',
    'وصلت خدمة الذكاء الاصطناعي إلى حدها مؤقتاً. ملاحظتك محفوظة؛ حاول بعد قليل.',
  ],
  AI_INVALID_RESPONSE: [
    'The AI response did not pass safety checks. No wording was approved. Please retry.',
    'لم تجتز إجابة الذكاء الاصطناعي فحص السلامة. لم يتم اعتماد أي نص. حاول مجدداً.',
  ],
  AI_UNAVAILABLE: [
    'AI review is temporarily unavailable. Your writing is preserved. Please retry.',
    'مراجعة الذكاء الاصطناعي غير متاحة مؤقتاً. كتابتك محفوظة. حاول مجدداً.',
  ],
  RATE_LIMIT: ['Please wait a moment and try again.', 'انتظر قليلاً ثم حاول مجدداً.'],
  UNAUTHORIZED: [
    'Your session expired. Please start a new shift.',
    'انتهت صلاحية جلستك. ابدأ مناوبة جديدة.',
  ],
  CONFLICT: [
    'Your session changed in another request. Progress was refreshed; please retry.',
    'تغيرت الجلسة في طلب آخر. تم تحديث التقدم؛ حاول مجدداً.',
  ],
  INVALID_INPUT: [
    'Please check the entered text. Use a display name of 2–40 letters.',
    'تحقق من النص المدخل. استخدم اسم عرض من حرفين إلى ٤٠ حرفاً.',
  ],
  legacySession: [
    'This earlier session is preserved. Start a new shift to use the updated experience.',
    'هذه الجلسة السابقة محفوظة. ابدأ مناوبة جديدة لاستخدام التجربة المحدّثة.',
  ],
  noteLocked: [
    'This observation is already approved. Continue to the safety decision.',
    'تم اعتماد هذه الملاحظة. تابع إلى قرار السلامة.',
  ],
  completed: ['This shift is already completed.', 'اكتملت هذه المناوبة مسبقاً.'],
  REQUEST_FAILED: [
    'The action could not be saved. Your progress is preserved; please retry.',
    'تعذر حفظ الإجراء. تقدمك محفوظ؛ حاول مجدداً.',
  ],
};
export function errorMessage(code: string, lang: Lang) {
  return (errors[code] || errors.REQUEST_FAILED)[lang === 'ar' ? 1 : 0];
}
