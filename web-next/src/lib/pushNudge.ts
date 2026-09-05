import { isIOS, isPushSupported, isStandalone } from "./pushNotifications";

// نفس فلسفة SESSION_FLAG_PREFIX في lib/whatsappClicks.ts — إشارة مؤقتة لجلسة المتصفح
// الحالية بس (sessionStorage بيتصفّر تلقائيًا مع كل تاب/جلسة جديدة)، عكس localStorage
// الدائم. المستخدم اللي يقفل المودال (✕ أو الخلفية أو "لاحقًا") مش هيشوفه تاني في نفس
// التاب، لكن لو فتح الموقع من جديد (تاب جديد أو بعد إعادة تحميل) هيرجع يظهر تاني لو
// الشروط لسه بتتحقق.
const SESSION_DISMISSED_KEY = "elshoghl_push_nudge_dismissed";

export function isPushNudgeDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissPushNudgeForSession(): void {
  try {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
  } catch {
    // متجاهلينها زي أي فشل تاني في sessionStorage
  }
}

// بيتفحص قبل ما نعرض مودال تشجيع تفعيل التنبيهات — بيظهر لأي مستخدم مسجّل دخول طول ما
// الإذن لسه "default" (مفيش قرار نهائي)، بغض النظر عن أي حدث معيّن. بمجرد ما الإذن يتغيّر
// لـgranted أو denied (من هنا أو من زرار EnableNotificationsButton الدائم في الـNavbar)،
// الشرط ده بيرجع false تلقائيًا ومفيش داعي لأي متغيّر إضافي يوقف الظهور نهائيًا.
// آيفون مش مثبّت كـPWA متعمّد نتجاهله هنا: المودال ده مش المكان المناسب لطلب "ثبّت الموقع
// الأول" كخطوة إضافية — زرار EnableNotificationsButton الدائم بيغطي مستخدمي آيفون بمنطقه الخاص.
export function shouldShowPushNudge(): boolean {
  if (isPushNudgeDismissedThisSession()) return false;
  if (!isPushSupported()) return false;
  if (isIOS() && !isStandalone()) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "default") return false;
  return true;
}
