import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";
import { app, db } from "./firebase";

// بيتفحص قبل أي استخدام لأي API خاص بالـPush — متصفحات قديمة أو WebViews معينة (زي WebView
// فيسبوك اللي شفناها قبل كده في RegisterForm.tsx) ممكن ميدعموش الـAPIs دي خالص.
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Safari بتاع iOS بيدعم Web Push بس لو الموقع متثبّت فعليًا (إضافة للشاشة الرئيسية)، مش من
// تاب عادي — الفحصين دول (matchMedia وnavigator.standalone القديمة بتاعة iOS) مع بعض
// بيغطوا كل حالات "مثبّت" الممكنة.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// الـtoken نفسه document id عشان تسجيل نفس الجهاز تاني (بعد مسح بيانات المتصفح مثلًا) يبقى
// idempotent (setDoc) من غير ما يتكرر نفس الجهاز أكتر من مرة في users/{uid}/fcmTokens.
async function saveTokenToFirestore(uid: string, token: string) {
  await setDoc(
    doc(db, "users", uid, "fcmTokens", token),
    {
      token,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export type EnablePushResult = {
  // القرار الحقيقي من المتصفح — لازم نرجّعه دايمًا بمجرد ما يتحدد، حتى لو حصل فشل فني
  // بعد كده (تسجيل الـService Worker أو الحصول على توكن). لو رجّعنا null في الحالة دي
  // (زي ما كان بيحصل قبل كده)، الكومبوننت بيفقد معرفته إن الإذن اتوافق عليه فعلًا (حاجة
  // مبترجعش تاني أبدًا)، وبيفضل يتصرف كإنه لسه معلّق — ده اللي كان بيخلي الزرار يفضل ظاهر
  // حتى بعد موافقة حقيقية.
  permission: NotificationPermission;
  // false يعني الإذن اتوافق عليه لكن تسجيل الجهاز فعليًا فشل (SW أو getToken أو Firestore) —
  // حالة مختلفة عن رفض الإذن نفسه، والكومبوننت بيقرر يوري رسالة خطأ بناءً عليها لوحدها.
  tokenSaved: boolean;
  // مؤقتة للتشخيص (زي مشكلة عدم تسجيل التوكن على الموبايل) — تفاصيل الخطأ الحقيقي عشان
  // تتعرض على الشاشة مباشرة، بما إن مفيش DevTools Console سهلة الوصول على الموبايل.
  // تتشال بعد ما نلاقي السبب ونصلحه.
  errorDetail?: string;
};

// بيستخرج نص مفيد من أي خطأ — FirebaseError عندها code (زي messaging/token-subscribe-failed)،
// DOMException عندها name (زي NotAllowedError)، وأي Error عادي عنده message بس.
function describeError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; name?: unknown; message?: unknown };
    const codeOrName = e.code ?? e.name;
    if (codeOrName && e.message) return `${codeOrName}: ${e.message}`;
    if (codeOrName) return String(codeOrName);
    if (e.message) return String(e.message);
  }
  return String(err);
}

const SW_READY_TIMEOUT_MS = 10000;

// navigator.serviceWorker.ready بترجع Promise ميتحلّش غير لما يبقى فيه Service Worker نشط
// فعليًا (activated) لنفس الـscope — register() لوحدها بترجع بمجرد قبول التسجيل، مش بالضرورة
// لما يبقى جاهز للاستخدام، وده كان بيسبب فشل getToken على أجهزة/شبكات أبطأ (خطأ حقيقي شفناه
// على الموبايل: "Subscription failed - no active Service Worker"). بنحط مهلة قصوى (10 ثواني)
// عشان الزرار ميفضلش "جاري التنفيذ..." للأبد لو حصل عطل نادر يمنع الـSW من الوصول لـactivated خالص.
async function waitForActiveServiceWorker(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("انتهت مهلة انتظار تفعيل Service Worker (10 ثواني)")), SW_READY_TIMEOUT_MS);
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

// بيتنادى فقط كرد فعل مباشر لدوسة زرار من المستخدم (مش تلقائي أبدًا) — إذن الإشعارات
// one-shot في المتصفح، فلازم نحافظ على الفرصة الوحيدة دي لتوقيت مقصود من المستخدم نفسه.
// بيرجّع null بس لو محتاجناش نطلب الإذن أصلًا (isPushSupported=false) أو الطلب نفسه فشل
// (نادر جدًا) — أي حالة تانية بترجّع الإذن الحقيقي مضمون، بغض النظر عن نجاح تسجيل التوكن.
export async function enablePushNotifications(uid: string): Promise<EnablePushResult | null> {
  if (!isPushSupported()) return null;

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (err) {
    console.error("[pushNotifications] فشل طلب إذن الإشعارات", err);
    return null;
  }

  if (permission !== "granted") return { permission, tokenSaved: false };

  try {
    await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const registration = await waitForActiveServiceWorker();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await saveTokenToFirestore(uid, token);
    }
    return { permission, tokenSaved: Boolean(token) };
  } catch (err) {
    console.error("[pushNotifications] فشل تسجيل التوكن", err);
    return { permission, tokenSaved: false, errorDetail: describeError(err) };
  }
}
