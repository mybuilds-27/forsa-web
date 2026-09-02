// تنبيه اكتمال البروفايل بعد التقديم على وظيفة بنجاح — منطق منع الإزعاج المتكرر بس
// (حساب النسبة نفسه في profileCompletion.ts، مش هنا). مفتاح localStorage واحد مشترك بين
// كل نقط التقديم (ApplyButton.tsx وJobsTab.tsx) عشان قفل الرسالة من مكان يمنعها من التاني
// كمان في نفس اليوم.
const STORAGE_KEY = "elshoghl_profile_nudge_dismissed_date";

// أقل نسبة اكتمال بتخلي التنبيه يظهر خالص — 80% فيما فوق يبقى البروفايل كويس بما يكفي.
const NUDGE_THRESHOLD = 80;

export function shouldShowProfileNudge(percent: number): boolean {
  if (percent >= NUDGE_THRESHOLD) return false;
  try {
    if (localStorage.getItem(STORAGE_KEY) === new Date().toDateString()) return false;
  } catch {
    // localStorage ممكن يكون مش متاح (وضع تصفح خاص) — نتعامل معاها كأنها لسه ما اتقفلتش
  }
  return true;
}

// بتتنادى لما المستخدم يقفل الرسالة (X/"لاحقًا") أو يدوس "كمّل بروفايلك" — الاتنين بيعتبروا
// "شافها وتعامل معاها" لغرض منع التكرار.
export function markProfileNudgeSeenToday(): void {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toDateString());
  } catch {
    // متجاهلينها زي أي فشل تاني في localStorage
  }
}
