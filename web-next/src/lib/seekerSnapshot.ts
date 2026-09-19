import { normalizeEntries } from "@/lib/profileFields";

export function buildSeekerSnapshot(s: any) {
  return {
    fullName: s.fullName || "",
    phone: s.phone || "",
    email: s.email || "",
    jobTitle: s.jobTitle || "",
    specialization: s.specialization || "",
    city: s.city || "",
    governorate: s.governorate || "",
    yearsOfExperience: s.yearsOfExperience || 0,
    cvFileURL: s.cvFileURL || null,
    photoURL: s.photoURL || null,
    skills: normalizeEntries(s.skills),
    languages: normalizeEntries(s.languages),
    militaryStatus: s.gender === "male" ? s.militaryStatus || "" : "",
    // مضافين عشان حساب نسبة المطابقة (applicantMatch.ts) — تقديمات قديمة اتعملت قبل الإضافة
    // دي هتفضل من غيرهم، ومعيار المستوى/الكلمات المفتاحية هيتستبعد من حساب النسبة بتاعتها
    // (مش هيتحسب صفر) بدل ما نحتاج نصلّح الـsnapshots القديمة بأثر رجعي.
    jobLevel: s.jobLevel || "",
    keywords: Array.isArray(s.keywords) ? s.keywords : [],
    // المؤهل الدراسي — بيتعرض في ApplicantCard.tsx. تقديمات قديمة قبل الإضافة دي هتفضل من غيره
    // (الـtag بيختفي عندها، مفيش backfill).
    educationLevel: s.educationLevel || "",
  };
}
