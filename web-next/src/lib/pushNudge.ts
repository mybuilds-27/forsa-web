import { isIOS, isPushSupported, isStandalone } from "./pushNotifications";

// عكس profileNudge.ts (بيتصفّر كل يوم) — العلامة دي دائمة: بمجرد ما المودال يتشاف يفضل
// متسجل للأبد على نفس الجهاز/المتصفح، بغض النظر عن نتيجة التفاعل (وافق/رفض/قفل المودال).
const STORAGE_KEY = "elshoghl_push_nudge_seen";

export function hasSeenPushNudge(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPushNudgeSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // متجاهلينها زي أي فشل تاني في localStorage
  }
}

// بيتفحص قبل ما نعرض مودال تشجيع تفعيل التنبيهات (بعد أول تقديم/أول نشر وظيفة ناجح) —
// آيفون مش مثبّت كـPWA متعمّد نتجاهله هنا (مش بس نعرض بديل): المودال ده لحظة احتفالية
// سريعة، مش المكان المناسب لطلب "ثبّت الموقع الأول" كخطوة إضافية. زرار EnableNotificationsButton
// الدائم في الـNavbar أصلًا بيغطي مستخدمي آيفون بمنطقه الخاص (تلميح التثبيت).
export function shouldShowPushNudge(): boolean {
  if (hasSeenPushNudge()) return false;
  if (!isPushSupported()) return false;
  if (isIOS() && !isStandalone()) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "default") return false;
  return true;
}
