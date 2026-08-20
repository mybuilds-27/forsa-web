import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// عداد زيارات شهري بسيط للأدمن (يفيد في تحديد التوقيت المناسب لتفعيل Google AdSense) —
// مستند واحد لكل يوم (site_visits/{YYYY-MM-DD}) بحقل count بس بيتزوّد بـincrement. الكتابة
// fire-and-forget زي registrationFunnel.ts وerrorLog.ts: فشلها ميوقفش ولا يأثر على تجربة
// المستخدم خالص. قاعدة Firestore بتسمح بـcreate/update من غير تسجيل دخول بس بحقل count فقط
// (hasOnly)، بدون قراءة إلا للأدمن — فمينفعش نضيف أي حقل تاني هنا زي updatedAt من غير ما
// نعدّل القاعدة معاه.
const SESSION_FLAG_KEY = "elshoghl_visit_logged";

function todayDocId(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function logSiteVisit() {
  if (typeof window === "undefined") return;
  try {
    // مرة واحدة بس لكل جلسة تصفح (تاب/نافذة) — مش كل صفحة يفتحها نفس الزائر، عشان العدد
    // يعكس "زيارات" فعلية مش "مشاهدات صفحات".
    if (sessionStorage.getItem(SESSION_FLAG_KEY)) return;
    sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  } catch {
    // لو sessionStorage مش متاحة لأي سبب، الأسلم مانسجلش زيارة بدل ما نخاطر نعدّها في كل
    // تنقل بين الصفحات من غير أي فلاج يمنع التكرار.
    return;
  }

  setDoc(doc(db, "site_visits", todayDocId()), { count: increment(1) }, { merge: true }).catch((err) => {
    console.error("[siteVisits] فشل تسجيل الزيارة", err);
  });
}
