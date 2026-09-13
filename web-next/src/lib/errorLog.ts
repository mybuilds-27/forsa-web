import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

// شكل بسيط لأي خطأ ممكن يحمل .code و.message (FirebaseError أو Error عادي أو أي حاجة
// تانية اتعمللها throw) — بدل any، عشان نقرأ الحقلين دول بأمان من غير ما نحتاج نعرف
// النوع الحقيقي بالظبط.
type MaybeCodedError = { code?: string; message?: string };

function toCodedError(err: unknown): MaybeCodedError {
  return err && typeof err === "object" ? (err as MaybeCodedError) : {};
}

// نقطة نهائية بديلة (localStorage) لو الكتابة الأصلية لـerror_logs فشلت — مش محتاجة أي
// مصادقة ولا اتصال Firestore خالص، فهي آمنة حتى لو نفس السبب اللي منع الكتابة الأصلية
// (زي توكن مصادقة منتهي) بيمنع أي كتابة Firestore تانية في نفس اللحظة. حد أقصى 20 حالة
// عشان مانملّش localStorage لو المشكلة اتكررت كتير.
const FAILED_LOG_STORAGE_KEY = "elshoghl_failed_error_logs";
const MAX_FAILED_LOGS_STORED = 20;

function saveFailedLogLocally(payload: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(FAILED_LOG_STORAGE_KEY);
    const existing: unknown[] = raw ? JSON.parse(raw) : [];
    const updated = [...existing, payload].slice(-MAX_FAILED_LOGS_STORED);
    localStorage.setItem(FAILED_LOG_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage نفسها ممكن تفشل (وضع تصفح خاص، مساحة ممتلئة، إلخ) — مفيش حاجة تانية
    // نعملها هنا، الـconsole.error في الـcatch بره هو آخر خط دفاع في الحالة دي.
  }
}

// تسجيل أخطاء بسيط من جانب العميل — بيسجل تفاصيل تقنية (كود/رسالة الخطأ، الخطوة، الصفحة)
// من غير أي بيانات شخصية حساسة (اسم/إيميل/تليفون)، عشان نقدر نشخّص مشاكل زي فشل التسجيل
// من غير ما نحتاج نسأل المستخدم نفسه. الكتابة على error_logs محتاجة قاعدة Firestore منفصلة
// (write-only، بدون قراءة) — راجع الرسالة اللي فيها القاعدة قبل الاعتماد على اللوج ده.
export async function logClientError(step: string, err?: unknown, extra?: Record<string, unknown>) {
  const errInfo = toCodedError(err);
  const payload = {
    step,
    code: errInfo.code || null,
    message: err ? errInfo.message || String(err) : null,
    uid: auth.currentUser?.uid || null,
    page: typeof window !== "undefined" ? window.location.pathname : null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    ...extra,
  };
  try {
    await addDoc(collection(db, "error_logs"), { ...payload, createdAt: serverTimestamp() });
  } catch (logErr) {
    // نقطة عمياء اتكشفت فعليًا: لو نفس السبب اللي منع كتابة الخطأ الأصلي (مثلًا مشكلة توكن
    // مصادقة) بيمنع كتابة error_logs نفسها كمان، كان الفشل ده بيتبلع صامت تمامًا — مفيش أي
    // أثر خالص، لا للمستخدم ولا للأدمن. دلوقتي بنطبع بيانات الخطأ الأصلي كاملة (مش بس فشل
    // التسجيل) عشان أي حد يفتح console وقت الحادثة يلاقي السياق الكامل، وبنحفظ نسخة في
    // localStorage كملاذ أخير مستقل تمامًا عن Firestore/المصادقة.
    const logErrInfo = toCodedError(logErr);
    console.error(
      "[errorLog] فشل تسجيل الخطأ في error_logs — البيانات الأصلية اللي كانت هتضيع:",
      payload,
      "— سبب فشل التسجيل نفسه:",
      logErrInfo.code || logErrInfo.message || logErr
    );
    if (typeof window !== "undefined") {
      saveFailedLogLocally({
        ...payload,
        logErrorCode: logErrInfo.code || null,
        logErrorMessage: logErrInfo.message || String(logErr),
        failedAt: new Date().toISOString(),
      });
    }
  }
}
