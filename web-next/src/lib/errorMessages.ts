// خريطة موحّدة لكل أكواد Firebase Auth المعروفة والمتكررة عبر مسارات التسجيل الثلاثة
// (إيميل، تليفون، جوجل) — مركزية في مكان واحد بدل ما تتكرر (وتختلف) في كل فورم، عشان أي
// كود جديد نضيفه مرة واحدة بس ويستفاد منه كل المسارات.
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // إيميل/باسورد
  "auth/email-already-in-use": 'الإيميل ده متسجل بالفعل — جرب "دخول" بدل "إنشاء حساب"',
  "auth/invalid-email": "صيغة الإيميل مش صحيحة",
  "auth/weak-password": "الباسورد لازم يكون 6 أحرف على الأقل",
  "auth/wrong-password": "الباسورد غلط",
  "auth/user-not-found": "مفيش حساب مسجل بالإيميل ده",
  "auth/invalid-credential": "الإيميل أو الباسورد غلط",
  "auth/missing-password": "اكتب الباسورد",
  // تليفون
  "auth/invalid-phone-number": "رقم التليفون مش صحيح",
  "auth/too-many-requests": "محاولات كتير جدًا — جرب تاني بعد شوية",
  "auth/invalid-verification-code": "الكود اللي دخلته غلط، تأكد منه وحاول تاني",
  "auth/code-expired": "الكود ده انتهت صلاحيته — اطلب كود جديد",
  "auth/quota-exceeded": "الخدمة مش متاحة دلوقتي — جرب تاني لاحقًا",
  "auth/operation-not-allowed": "تسجيل الدخول برقم التليفون لسه مش مفعّل على الموقع",
  // 503 من identitytoolkit.googleapis.com — حظر مؤقت متعمّد من Firebase نفسها لشبكة اتصال/منطقة
  // معدل توصيل الـSMS ليها ضعيف باستمرار (مش باج في كودنا، ومش نفس سبب "already been rendered"
  // — reCAPTCHA بتكون خلصت ونجحت قبل ما الخطأ ده يحصل خالص). أكّد ده مهندس دعم Firebase في حالة
  // مشابهة (أوزبكستان، بعض شبكات الاتصال شغالة وبعضها بيفشل باستمرار). مفيش إصلاح من ناحيتنا —
  // البديل العملي الوحيد المتاح إننا نوجّه المستخدم للتسجيل بالإيميل، زي WebView بالظبط.
  "auth/error-code:-39": "في مشكلة من شبكة الاتصال في استلام رسائل التحقق دلوقتي — جرب تسجّل بالإيميل بدل التليفون، هياخد نفس الوقت تقريبًا",
  // جوجل (popup/redirect)
  "auth/popup-closed-by-user": "يظهر إنك قفلت نافذة تسجيل الدخول بجوجل قبل ما تكمل، جرب تاني ومتقفلش النافذة لحد ما تخلص",
  "auth/cancelled-popup-request": "في أكتر من محاولة تسجيل دخول شغالة في نفس الوقت — جرب تاني",
  "auth/popup-blocked": "المتصفح منع فتح نافذة تسجيل الدخول — اسمح بالنوافذ المنبثقة (popups) لهذا الموقع وجرب تاني",
  "auth/account-exists-with-different-credential": "الإيميل ده متسجل بطريقة تسجيل تانية بالفعل — جرب تسجل دخول بيها",
  // مشتركة بين المسارات التلاتة
  "auth/network-request-failed": "يظهر إن في مشكلة في الاتصال بالإنترنت، تأكد من النت وحاول تاني",
  "auth/internal-error": "حصلت مشكلة تقنية مؤقتة — جرب تاني بعد شوية",
};

// خطأ "reCAPTCHA has already been rendered in this element" بيوصل كـJS Error عادي من مكتبة
// جوجل نفسها (مش FirebaseError له كود مخصص)، فبنكتشفه من نص الرسالة بدل الكود. السبب الجذري
// معروف ومتوثّق فعلًا: verifier قديم فاضل معلّق على نفس عنصر الـDOM من غير clear() قبل ما
// المودال يتقفل ويتفتح تاني — اتصلح فعليًا في clearRecaptchaVerifier()/getRecaptchaVerifier()
// في RegisterForm.tsx (commit 86c8e84، بعد ما لوحة الأدمن سجّلت 143 حالة في 7 أيام). لو
// الرسالة دي ظهرت تاني بعد تاريخ الإصلاح ده، محتاجة تحقيق منفصل (سبب جديد لسه مش معروف)
// بدل افتراض إنها نفس السبب القديم.
const RECAPTCHA_ALREADY_RENDERED = "has already been rendered";

// رسالة عربية محددة لكل خطأ معروف في مسارات تسجيل الدخول/التسجيل — بتقول للمستخدم المشكلة
// إيه بالظبط والحل المقترح، بدل رسالة عامة مهما كان نوع الخطأ. أي كود مش متعرّف في القايمة
// (حالة نادرة) بيرجع برسالة عامة **فيها كود الخطأ نفسه** عشان لو المستخدم بعتها لنا نعرف
// السبب من غير ما نحتاج نسأله أسئلة إضافية. كل استدعاء لازم يترافق بنداء logClientError في
// نفس catch block عشان أي خطأ (معروف أو لأ) يتسجل في error_logs للمراجعة من لوحة الأدمن.
export function authErrorMessage(err: any): string {
  const code: string = err?.code || "";
  if (AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];

  const message: string = String(err?.message || "");
  if (message.includes(RECAPTCHA_ALREADY_RENDERED)) {
    return "حصلت مشكلة تقنية مؤقتة في نظام التحقق — اقفل الصفحة وافتحها تاني وجرب من الأول";
  }

  return `حصلت مشكلة غير متوقعة (كود: ${code || "unknown"})، جرب تاني أو تواصل معانا لو استمرت`;
}

// رسالة عربية بسيطة للمستخدم العادي لأي خطأ تقني تاني برّه مسارات التسجيل (فهرس Firestore
// ناقص، صلاحيات، إلخ) — التفاصيل الحقيقية تتسجل بـconsole.error/logClientError بس، مش
// تتعرض في الواجهة. الكود بيتضاف لرسالة الفallback نفس منطق authErrorMessage فوق.
export function friendlyErrorMessage(err: any): string {
  const code: string = (err?.code || "").toLowerCase();
  const message: string = (err?.message || "").toLowerCase();
  const isNetworkIssue =
    code.includes("network") || code.includes("unavailable") || message.includes("network");

  if (isNetworkIssue) {
    return "يظهر إن في مشكلة في الاتصال بالإنترنت، تأكد من النت وحاول تاني";
  }
  return `حصلت مشكلة غير متوقعة (كود: ${err?.code || "unknown"})، جرب تاني أو تواصل معانا لو استمرت`;
}
