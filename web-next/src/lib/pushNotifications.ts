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

// بيتنادى فقط كرد فعل مباشر لدوسة زرار من المستخدم (مش تلقائي أبدًا) — إذن الإشعارات
// one-shot في المتصفح، فلازم نحافظ على الفرصة الوحيدة دي لتوقيت مقصود من المستخدم نفسه.
// بيرجّع نتيجة Notification.requestPermission() لو اتنفذت، أو null لو حصلت مشكلة تقنية
// (فشل تسجيل الـService Worker أو الحصول على توكن مثلًا).
export async function enablePushNotifications(uid: string): Promise<NotificationPermission | null> {
  if (!isPushSupported()) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return permission;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await saveTokenToFirestore(uid, token);
    }
    return permission;
  } catch (err) {
    console.error("[pushNotifications] فشل تفعيل التنبيهات", err);
    return null;
  }
}
