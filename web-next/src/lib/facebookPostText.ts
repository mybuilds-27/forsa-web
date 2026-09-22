import { JOB_TYPE_LABELS, sanitizeJobDescription } from "./jobCardStyles";
import { EXPERIENCE_LEVELS } from "./constants";

// حقول الوظيفة اللي محتاجينها لتوليد نص فيسبوك — subset من JobPost (لوحة صاحب العمل) وposts
// (لوحة الأدمن)، فالكومبوننتين التلاتة (CompanyTab.tsx وadmin/page.tsx) يقدروا يبعتوا مستند
// الوظيفة زي ما هو من غير أي تحويل. حقول قسم "وصف الوظيفة" (description لحد additionalBenefits)
// نفس أسماء وترتيب الحقول المعروضة في jobs/[id]/page.tsx بالظبط — عدا الراتب (شوف salaryLine)
// وprivateHealthInsurance (مش معروض في الصفحة العامة أصلًا، فمش جزء من القالب هنا برضه).
export type FacebookPostJob = {
  id: string;
  title: string;
  companyName?: string;
  governorate?: string;
  city?: string;
  jobType?: string;
  jobLevel?: string;
  minExperience?: number | null;
  maxExperience?: number | null;
  specialization?: string;
  keywords?: string[];
  description?: string;
  showSalary?: boolean;
  salaryNegotiable?: boolean;
  salaryFrom?: number | null;
  salaryTo?: number | null;
  vacancies?: number;
  ageFrom?: number | null;
  ageTo?: number | null;
  needsCar?: string;
  hoursPerDay?: number;
  socialInsurance?: string;
  transportationAvailable?: string;
  housingForExpats?: string;
  requirements?: string;
  additionalBenefits?: string;
};

// "3 سنوات فأكتر" / "حتى 5 سنوات" / "3 - 5 سنوات" — بترجع null لو الاتنين مش محددين، عشان
// السطر كله يختفي من النص بدل ما يظهر "غير محدد" مش مفيدة في بوست فيسبوك.
function experienceRangeText(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${min} - ${max} سنوات`;
  if (min != null) return `${min} سنوات فأكتر`;
  if (max != null) return `حتى ${max} سنوات`;
  return null;
}

// "من X سنة" / "لحد Y سنة" / "X - Y سنة" — نفس صيغة السن المطلوب في jobs/[id]/page.tsx بالظبط.
function ageRangeText(from?: number | null, to?: number | null): string | null {
  if (from != null && to != null) return `${from} - ${to} سنة`;
  if (from != null) return `من ${from} سنة`;
  if (to != null) return `لحد ${to} سنة`;
  return null;
}

// حقول needsCar/socialInsurance/transportationAvailable/housingForExpats كلها "yes"/"no"/
// undefined بنفس الشكل — null لو مش "yes" ولا "no" (يعني السطر بيختفي). من غير علامة "✓" اللي
// موجودة في الصفحة العامة، مالهاش معنى في نص فيسبوك.
function yesNoText(value: string | undefined, yesLabel: string, noLabel: string): string | null {
  if (value === "yes") return yesLabel;
  if (value === "no") return noLabel;
  return null;
}

// استثناء متعمد عن salaryText() في jobCardStyles.ts (المستخدمة في الصفحة العامة): هناك السطر
// بيفضل ظاهر بقيمة "غير محدد" لو showSalary === false أو مفيش بيانات راتب خالص. هنا قرار صريح
// من صاحب الموقع: السطر يختفي بالكامل في الحالتين، بدل ما يلمّح لصاحب العمل إن الراتب "غير
// محدد" في نص هيتنشر فعليًا لو أصلًا مختار يخفيه أو لسه مادخلش بيانات راتب.
function salaryLine(job: FacebookPostJob): string | null {
  if (job.showSalary === false) return null;
  if (job.salaryNegotiable) return "قابل للتفاوض / حسب الخبرة";
  if (job.salaryFrom && job.salaryTo) return `${job.salaryFrom} - ${job.salaryTo} جنيه`;
  if (job.salaryFrom) return `يبدأ من ${job.salaryFrom} جنيه`;
  return null;
}

// نص جاهز للنشر على فيسبوك، مبني على قالب ثابت اتفق عليه الأدمن. أي حقل فاضي (النوع، المستوى،
// التخصص، إلخ) بيختفي سطره بالكامل بدل ما يظهر فاضي أو "غير محدد" — النص لازم يبان جاهز للنشر
// من غير تعديل، حتى لو الوظيفة ناقصة بعض الحقول. الراتب/التأمين/المواصلات مش جزء من القالب
// عمدًا (شوف تعليق الاتفاق في CompanyTab.tsx/admin/page.tsx) — الأدمن يضيفهم يدويًا في الـtextarea
// لو حابب، لأنهم مش دايمًا معروضين للعامة (showSalary ممكن يكون false).
export function buildFacebookPostText(job: FacebookPostJob, jobUrl: string): string {
  const lines: string[] = ["وظيفة جديدة علي موقع الشغل", `المسمى الوظيفي: ${job.title}`];

  if (job.companyName) lines.push(job.companyName);

  const location = [job.governorate, job.city].filter(Boolean).join(" - ");
  if (location) lines.push(`📍 الموقع: ${location}`);

  if (job.jobType) lines.push(`🕐 نوع الدوام: ${JOB_TYPE_LABELS[job.jobType] || job.jobType}`);
  if (job.jobLevel) lines.push(`📊 المستوى: ${EXPERIENCE_LEVELS[job.jobLevel] || job.jobLevel}`);

  const experience = experienceRangeText(job.minExperience, job.maxExperience);
  if (experience) lines.push(`🧭 الخبرة المطلوبة: ${experience}`);

  if (job.specialization) lines.push(`🏷️ التخصص: ${job.specialization}`);

  let text = lines.join("\n");

  // قسم "وصف الوظيفة" — نفس ترتيب jobs/[id]/page.tsx: النص الحر، وبعده الراتب/عدد الفرص/السن/
  // العربية/ساعات العمل/التأمين الاجتماعي/المواصلات/سكن المغتربين، وأخيرًا الشروط ومزايا إضافية.
  // القسم كله بيختفي لو مفيش وصف ولا أي حقل من دول متاح.
  const description = sanitizeJobDescription(job.description || "");
  const detailLines: string[] = [];
  const salary = salaryLine(job);
  if (salary) detailLines.push(`الراتب: ${salary}`);
  if (job.vacancies) detailLines.push(`عدد الفرص المتاحة: ${job.vacancies} فرصة`);
  const age = ageRangeText(job.ageFrom, job.ageTo);
  if (age) detailLines.push(`السن المطلوب: ${age}`);
  const car = yesNoText(job.needsCar, "أيوة", "لأ");
  if (car) detailLines.push(`محتاج عربية: ${car}`);
  if (job.hoursPerDay) detailLines.push(`ساعات العمل يوميًا: ${job.hoursPerDay} ساعات`);
  const insurance = yesNoText(job.socialInsurance, "متوفر", "غير متوفر");
  if (insurance) detailLines.push(`التأمين الاجتماعي: ${insurance}`);
  const transportation = yesNoText(job.transportationAvailable, "متوفرة", "غير متوفرة");
  if (transportation) detailLines.push(`المواصلات: ${transportation}`);
  const housing = yesNoText(job.housingForExpats, "متوفر", "غير متوفر");
  if (housing) detailLines.push(`سكن المغتربين: ${housing}`);
  const requirements = sanitizeJobDescription(job.requirements || "");
  if (requirements) detailLines.push(`الشروط: ${requirements}`);
  const additionalBenefits = sanitizeJobDescription(job.additionalBenefits || "");
  if (additionalBenefits) detailLines.push(`مزايا إضافية: ${additionalBenefits}`);

  if (description || detailLines.length > 0) {
    text += "\n\nوصف الوظيفة";
    if (description) text += `\n${description}`;
    if (detailLines.length > 0) {
      // سطر فاضي بين الوصف والتفاصيل لو الاتنين موجودين (فصل فقرة عن قايمة) — لو مفيش وصف
      // خالص، التفاصيل تلزق بالعنوان على طول من غير سطر فاضي بينهم.
      text += `${description ? "\n\n" : "\n"}${detailLines.join("\n")}`;
    }
  }

  if (job.keywords && job.keywords.length > 0) {
    text += `\n\nالمهارات المطلوبة\n${job.keywords.join("، ")}`;
  }

  text += `\n\nللتقديم من اللينك التالي:\n${jobUrl}`;

  return text;
}
