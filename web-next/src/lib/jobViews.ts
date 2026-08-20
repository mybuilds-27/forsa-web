import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// عداد مشاهدات لكل وظيفة (يتقارن بعدد التقديمات في لوحة الأدمن لحساب نسبة التحويل) —
// مستند منفصل لكل وظيفة (job_views/{jobPostId}) بحقل count بس، بدل ما نلمس job_posts
// نفسها وقواعد الأمان المعقدة الموجودة عليها. نفس فلسفة lib/siteVisits.ts بالظبط: كتابة
// fire-and-forget، فشلها ميوقفش ولا يأثر على تجربة المستخدم خالص. القاعدة المطلوبة نفس
// نمط site_visits: create/update من غير تسجيل دخول بحقل count بس (hasOnly)، قراءة للأدمن بس.
const SESSION_FLAG_PREFIX = "elshoghl_job_viewed_";

export function logJobView(jobPostId: string) {
  if (typeof window === "undefined" || !jobPostId) return;
  const flagKey = SESSION_FLAG_PREFIX + jobPostId;
  try {
    // مرة واحدة بس لكل وظيفة لكل جلسة — لو نفس الزائر رجع لنفس صفحة الوظيفة تاني في نفس
    // الجلسة (تحديث الصفحة مثلًا) منعدّهاش مشاهدة تانية.
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, "1");
  } catch {
    return;
  }

  setDoc(doc(db, "job_views", jobPostId), { count: increment(1) }, { merge: true }).catch((err) => {
    console.error("[jobViews] فشل تسجيل مشاهدة الوظيفة", err);
  });
}
