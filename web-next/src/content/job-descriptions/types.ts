// الأقسام (department) بالترتيب اللي بتتعرض بيه في /job-descriptions — القسم اللي مفيهوش أوصاف مبيظهرش.
export const JOB_DESCRIPTION_DEPARTMENTS = [
  "الحسابات والمالية",
  "المبيعات وخدمة العملاء",
  "الموارد البشرية",
  "المخازن والمشتريات",
  "الإنتاج والتشغيل",
  "الإدارة والسكرتارية",
] as const;

export type JobDescriptionDepartment = (typeof JOB_DESCRIPTION_DEPARTMENTS)[number];

// وصف وظيفي جاهز لوظيفة محددة (/job-descriptions/{slug}) — نفس حقول HrTemplate (content/hr-templates/types.ts)
// ونفس طريقة العرض (الشرح Markdown، والـtemplate نص عادي فيه جداول | |)، + department للتقسيم في صفحة القايمة.
export type JobDescription = {
  // بيطلع في الرابط /job-descriptions/{slug} — حروف إنجليزية صغيرة وأرقام وشرطات بس، وفريد لكل وصف.
  slug: string;
  title: string;
  // بتظهر في الكارت وفي meta description.
  description: string;
  department: JobDescriptionDepartment;
  // YYYY-MM-DD
  date: string;
  // YYYY-MM-DD، اختياري: آخر تعديل حقيقي (dateModified في JSON-LD والـsitemap).
  updatedAt?: string;
  // الشرح: نفس Markdown المقالات (lib/articleMarkdown.tsx).
  body: string;
  // بطاقة الوصف الوظيفي: نص عادي فيه جداول | | (lib/hrTemplateBlocks.ts)، وهو اللي بيتنسخ وبيتطبع وبيتحمّل Word.
  template: string;
  // slugs مقالات مرتبطة (content/articles): بتظهر في "مقالات ذات صلة".
  relatedArticles?: string[];
};
