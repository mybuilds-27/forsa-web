import { JOB_TYPE_LABELS } from "./jobCardStyles";
import { EXPERIENCE_LEVELS } from "./constants";

// حقول الوظيفة اللي محتاجينها لتوليد نص فيسبوك — subset من JobPost (لوحة صاحب العمل) وposts
// (لوحة الأدمن)، فالكومبوننتين التلاتة (CompanyTab.tsx وadmin/page.tsx) يقدروا يبعتوا مستند
// الوظيفة زي ما هو من غير أي تحويل.
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
};

// "3 سنوات فأكتر" / "حتى 5 سنوات" / "3 - 5 سنوات" — بترجع null لو الاتنين مش محددين، عشان
// السطر كله يختفي من النص بدل ما يظهر "غير محدد" مش مفيدة في بوست فيسبوك.
function experienceRangeText(min?: number | null, max?: number | null): string | null {
  if (min != null && max != null) return `${min} - ${max} سنوات`;
  if (min != null) return `${min} سنوات فأكتر`;
  if (max != null) return `حتى ${max} سنوات`;
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

  if (job.keywords && job.keywords.length > 0) {
    text += `\n\nالمهارات المطلوبة\n${job.keywords.join("، ")}`;
  }

  text += `\n\nللتقديم من اللينك التالي:\n${jobUrl}`;

  return text;
}
