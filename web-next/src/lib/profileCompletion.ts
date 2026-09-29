// حقول أساسية (نفس required الحالية) — وزن نقطة واحدة لكل واحد (زي الاختيارية بالظبط)،
// عشان التسجيل المصغّر (5 حقول) ميدّيش نسبة اكتمال عالية مقارنة بكمية البيانات الناقصة فعليًا
const ESSENTIAL_FIELDS = ["fullName", "phone", "governorate", "jobTitle"];
const ESSENTIAL_WEIGHT = 1;

// حقول اختيارية — وزن نقطة واحدة لكل واحد
const OPTIONAL_CHECKS: Array<(d: any) => boolean> = [
  (d) => !!d.email,
  (d) => !!d.photoURL,
  (d) => !!d.city,
  (d) => !!d.specialization,
  (d) => !!d.yearsOfExperience && Number(d.yearsOfExperience) > 0,
  (d) => !!d.educationLevel,
  (d) => !!d.jobType,
  (d) => Array.isArray(d.skills) && d.skills.length > 0,
  (d) => Array.isArray(d.languages) && d.languages.length > 0,
  (d) => !!d.bio && d.bio.trim().length > 0,
  (d) => !!d.cvFileURL,
  (d) => Array.isArray(d.workExperience) && d.workExperience.length > 0,
];

const TOTAL_POINTS = ESSENTIAL_FIELDS.length * ESSENTIAL_WEIGHT + OPTIONAL_CHECKS.length; // 4 + 12 = 16

export function calculateProfileCompletion(data: any): number {
  if (!data) return 0;
  const essentialEarned = ESSENTIAL_FIELDS.filter((f) => !!data[f] && String(data[f]).trim() !== "").length * ESSENTIAL_WEIGHT;
  const optionalEarned = OPTIONAL_CHECKS.filter((check) => {
    try {
      return check(data);
    } catch {
      return false;
    }
  }).length;
  return Math.round(((essentialEarned + optionalEarned) / TOTAL_POINTS) * 100);
}

// تاب الفورم (OnboardingForm.tsx) اللي كل حقل معروض فيه — نفس مفاتيح TabKey هناك بالحرف.
export type ProfileFieldTab = "personal" | "job" | "experience" | "skills" | "additional" | "privacy";

export type MissingProfileField = { key: string; label: string; tab: ProfileFieldTab };

// نسخة موازية من ESSENTIAL_FIELDS فوق بس بمعلومات عرض إضافية (تسمية + التاب اللي الحقل ده
// ظاهر فيه في OnboardingForm.tsx) — مقصود إنها منفصلة عن ESSENTIAL_FIELDS نفسها بدل ما نلمس
// حساب النسبة، فلو حقل جديد اتضاف هنا لازم يتضاف في ESSENTIAL_FIELDS/OPTIONAL_CHECKS فوق كمان
// (والعكس) عشان "ناقصك" يفضل متطابق مع نسبة الاكتمال المعروضة.
const ESSENTIAL_FIELD_META: MissingProfileField[] = [
  { key: "fullName", label: "الاسم بالكامل", tab: "personal" },
  { key: "phone", label: "رقم الموبايل", tab: "personal" },
  { key: "governorate", label: "المحافظة", tab: "personal" },
  { key: "jobTitle", label: "المسمى الوظيفي", tab: "job" },
];

// Record<string, unknown> بدل any هنا وفي getMissingProfileFields تحت — نفس تسامح ESSENTIAL_
// FIELDS/OPTIONAL_CHECKS فوق (data شكلها مش معروف مسبقًا، حقول Firestore حرة) من غير ما نضيف
// any جديدة (الاتنين الموجودين فوق قدام مش جزء من التعديل ده، متلمسناهمش).
type LooseProfileData = Record<string, unknown>;

const OPTIONAL_FIELD_META: Array<MissingProfileField & { check: (d: LooseProfileData) => boolean }> = [
  { key: "email", label: "البريد الإلكتروني", tab: "personal", check: (d) => !!d.email },
  { key: "photoURL", label: "الصورة الشخصية", tab: "personal", check: (d) => !!d.photoURL },
  { key: "city", label: "المدينة", tab: "personal", check: (d) => !!d.city },
  { key: "specialization", label: "التخصص", tab: "job", check: (d) => !!d.specialization },
  { key: "yearsOfExperience", label: "سنوات الخبرة", tab: "job", check: (d) => !!d.yearsOfExperience && Number(d.yearsOfExperience) > 0 },
  { key: "educationLevel", label: "المؤهل الدراسي", tab: "job", check: (d) => !!d.educationLevel },
  { key: "jobType", label: "نوع الدوام", tab: "job", check: (d) => !!d.jobType },
  { key: "skills", label: "المهارات", tab: "skills", check: (d) => Array.isArray(d.skills) && d.skills.length > 0 },
  { key: "languages", label: "اللغات", tab: "skills", check: (d) => Array.isArray(d.languages) && d.languages.length > 0 },
  { key: "bio", label: "نبذة عنك", tab: "skills", check: (d) => typeof d.bio === "string" && d.bio.trim().length > 0 },
  { key: "cvFileURL", label: "السيرة الذاتية", tab: "skills", check: (d) => !!d.cvFileURL },
  { key: "workExperience", label: "الخبرات السابقة", tab: "experience", check: (d) => Array.isArray(d.workExperience) && d.workExperience.length > 0 },
];

// قايمة الحقول الناقصة (لتنبيه "ناقصك:" وتظليل الخانات في OnboardingForm.tsx) — بنفس شروط
// الاكتمال بالظبط (essential: !!value، اختياري: نفس check بتاعتها في calculateProfileCompletion)،
// بس هنا بنرجّع أنهي حقول بالتحديد ناقصة مش نسبة مجمّعة.
export function getMissingProfileFields(data: LooseProfileData | null | undefined): MissingProfileField[] {
  if (!data) return [...ESSENTIAL_FIELD_META, ...OPTIONAL_FIELD_META.map((f) => ({ key: f.key, label: f.label, tab: f.tab }))];
  const missing: MissingProfileField[] = [];
  for (const f of ESSENTIAL_FIELD_META) {
    if (!data[f.key] || String(data[f.key]).trim() === "") missing.push(f);
  }
  for (const f of OPTIONAL_FIELD_META) {
    let ok: boolean;
    try {
      ok = f.check(data);
    } catch {
      ok = false;
    }
    if (!ok) missing.push({ key: f.key, label: f.label, tab: f.tab });
  }
  return missing;
}
