import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// مصدر بيانات الاستخدام الفعلي للكلمات المفتاحية — مستند واحد (stats/keyword_usage)
// بيتحدّث يدويًا عبر functions/scripts/compute-keyword-usage.js، مش قراءة حية من
// job_seekers/job_posts (ده كان هيكلّف قراءة كل المستندات في كل مرة). ذاكرة مؤقتة على
// مستوى الموديول (مش state React) عشان أي عدد من KeywordsPicker في نفس الجلسة (بروفايل
// الباحث + فورم نشر الوظيفة) يشتركوا في نفس القراءة بدل ما كل واحد يعمل قراءة منفصلة.
let cachedPromise: Promise<Record<string, number>> | null = null;

async function fetchKeywordUsageCounts(): Promise<Record<string, number>> {
  try {
    const snap = await getDoc(doc(db, "stats", "keyword_usage"));
    const counts = snap.exists() ? snap.data().counts : null;
    return counts && typeof counts === "object" ? counts : {};
  } catch (err) {
    console.error("[keywordUsage] فشل جلب إحصائيات استخدام الكلمات المفتاحية", err);
    return {};
  }
}

// بيرجّع {} بأمان لو المستند لسه مش موجود (السكريبت ما اتشغّلش لسه) أو أي خطأ تاني —
// الكومبوننت المستهلك بيتعامل مع {} كـ"مفيش بيانات كفاية" ويرجع للترتيب الأصلي الثابت من
// غير أي مشكلة (كل الكلمات بتاخد عدد صفر، فالترتيب المستقر بيحافظ على الترتيب الأصلي).
export function getKeywordUsageCounts(): Promise<Record<string, number>> {
  if (!cachedPromise) {
    cachedPromise = fetchKeywordUsageCounts();
  }
  return cachedPromise;
}
