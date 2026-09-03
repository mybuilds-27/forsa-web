import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// عداد ضغطات زرار "تواصل عبر واتساب" لكل وظيفة (receiveMethod === "contact" وcontactMethod
// === "whatsapp") — نفس فلسفة lib/jobViews.ts بالظبط: مستند منفصل لكل وظيفة
// (whatsapp_clicks/{jobPostId}) بحقل count بس، كتابة fire-and-forget (فشلها ميوقفش ولا يأثر
// على فتح واتساب نفسه). القاعدة المطلوبة نفس نمط job_views: create/update من غير تسجيل دخول
// بحقل count بس (hasOnly)، قراءة لصاحب الوظيفة أو الأدمن بس.
const SESSION_FLAG_PREFIX = "elshoghl_whatsapp_clicked_";

export function logWhatsAppClick(jobPostId: string) {
  if (typeof window === "undefined" || !jobPostId) return;
  const flagKey = SESSION_FLAG_PREFIX + jobPostId;
  try {
    // مرة واحدة بس لكل وظيفة لكل جلسة — لو نفس الزائر دوس على الزرار أكتر من مرة (أو رجع
    // للصفحة تاني) منعدّهاش ضغطة تانية.
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, "1");
  } catch {
    return;
  }

  setDoc(doc(db, "whatsapp_clicks", jobPostId), { count: increment(1) }, { merge: true }).catch((err) => {
    console.error("[whatsappClicks] فشل تسجيل ضغطة واتساب", err);
  });
}
