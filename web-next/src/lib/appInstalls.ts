import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// عداد تراكمي بسيط لتثبيتات الـPWA — مستند واحد بس (app_installs/total) بحقل count، عكس
// job_views/site_visits (مستندات متعددة بمعرّف لكل وظيفة/يوم) لأن العدّ هنا إجمالي بس،
// مفيش داعي لتفصيل زمني. من غير فلاج جلسة (sessionStorage) زي jobViews.ts/siteVisits.ts:
// حدث appinstalled نادر وبيتفعّل مرة واحدة فعلية لكل تثبيت حقيقي من المتصفح نفسه، مش بيتكرر
// مع كل صفحة/تنقّل زي المشاهدات والزيارات. القاعدة المطلوبة نفس نمط site_visits: create/update
// من غير تسجيل دخول بحقل count بس (hasOnly)، قراءة للأدمن بس.
export function logAppInstall() {
  if (typeof window === "undefined") return;
  setDoc(doc(db, "app_installs", "total"), { count: increment(1) }, { merge: true }).catch((err) => {
    console.error("[appInstalls] فشل تسجيل تثبيت التطبيق", err);
  });
}
