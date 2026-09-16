// مُستخرجة من PostJobTab.tsx (كانت محلية غير مُصدّرة هناك) عشان تُستخدم كمان في
// EmployerOnboardingForm.tsx — بدل ما نكرر نفس المنطق (مش مجرد ثابت بسيط) في مكانين ممكن
// يتفرّقوا بمرور الوقت.

// حفظ Firestore (addDoc/setDoc/updateDoc) بيفضل معلّق أحيانًا لفترة أطول من الطبيعي (شبكة
// عابرة، إلخ) — الرقمين دول بيحكموا مهلتين متدرّجتين بدل خط نهاية واحد قاطع (شوف
// withGracePeriod تحت): SAVE_TIMEOUT_MS نقطة "خلي بالك، بياخد وقت أطول من المعتاد" بس، مش
// فشل — لسه مستنيين نفس العملية في الخلفية. HARD_FAIL_TIMEOUT_MS هي المهلة القصوى المطلقة
// اللي بعدها بس بنعتبرها فشل حقيقي (مش مجرد بطء عابر) ونوقف الانتظار.
export const SAVE_TIMEOUT_MS = 25000;
export const HARD_FAIL_TIMEOUT_MS = 60000;

// بتستنى promise (addDoc/setDoc/updateDoc) بمهلتين متدرّجتين بدل timeout واحد قاطع: لو معدّاش
// SAVE_TIMEOUT_MS لسه شغال، بننادي onSlow() (لعرض تنبيه غير blocking "بياخد وقت أطول من
// المعتاد") من غير ما نوقف الانتظار — لو العملية نجحت فعلاً بعد كده (بطء شبكة عابر، مش فشل
// حقيقي)، بترجع نتيجتها عادي وكأن حاجة محصلتش. لو وصلنا HARD_FAIL_TIMEOUT_MS من غير ما تخلص،
// ساعتها بس بنعتبرها فشلت فعلاً ونرفض بـ"HARD_FAIL_TIMEOUT". أي خطأ حقيقي من العملية نفسها
// (مش مجرد بطء) بيتنشر فورًا من غير أي انتظار إضافي.
export function withGracePeriod<T>(promise: Promise<T>, onSlow: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const slowTimer = setTimeout(() => {
      if (!settled) onSlow();
    }, SAVE_TIMEOUT_MS);
    const hardTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("HARD_FAIL_TIMEOUT"));
    }, HARD_FAIL_TIMEOUT_MS);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(slowTimer);
        clearTimeout(hardTimer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(slowTimer);
        clearTimeout(hardTimer);
        reject(err);
      }
    );
  });
}

// navigator.connection (Network Information API) مش موجود في TypeScript's lib.dom.d.ts
// الافتراضية (ولا في متصفحات زي Safari/Firefox أصلاً) — النوع ده بيوصف بس الحقول اللي
// محتاجينها منه لو موجود، وبيرجع undefined بأمان لو مش مدعوم بدل ما يكسر.
type NetworkInformation = { effectiveType?: string; downlink?: number; rtt?: number };

// معلومات تشخيصية عن حالة الاتصال وقت HARD_FAIL_TIMEOUT بس (شوف withGracePeriod فوق) —
// عشان نقدر نفرّق في لوحة الأدمن بين "النت اتقطع فعليًا وقت الحفظ" و"مشكلة تانية غير متوقعة"،
// من غير ما نغيّر سلوك المهلة نفسها.
export function getConnectionDiagnostics(): Record<string, unknown> {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return {
    online: navigator.onLine,
    connectionEffectiveType: connection?.effectiveType ?? null,
    connectionDownlinkMbps: connection?.downlink ?? null,
    connectionRttMs: connection?.rtt ?? null,
  };
}
