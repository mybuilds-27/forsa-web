import type { JobDescription } from "./types";
import { parseHrTemplateBlocks } from "@/lib/hrTemplateBlocks";
import { jobDescription as accountsReceivableAccountant } from "./accounts-receivable-accountant";
import { jobDescription as accountsPayableAccountant } from "./accounts-payable-accountant";
import { jobDescription as chiefAccountant } from "./chief-accountant";

// إضافة وصف جديد: اعمل ملف جديد في المجلد ده (انسخ accounts-receivable-accountant.ts)، وضيف سطر import فوق
// وسطر في المصفوفة تحت. الأوصاف بتتعرض الأحدث الأول حسب date، ومتقسمة حسب department في /job-descriptions.
const allJobDescriptions: JobDescription[] = [accountsReceivableAccountant, accountsPayableAccountant, chiefAccountant];

const slugs = new Set<string>();
for (const d of allJobDescriptions) {
  if (slugs.has(d.slug)) {
    throw new Error(`slug مكرر في content/job-descriptions: ${d.slug}`);
  }
  slugs.add(d.slug);
  // نفس فحص الجداول بتاع content/hr-templates: أي جدول صفوفه عدد خاناتها مختلف بيرمي Error فيه الـslug ورقم السطر، فيوقّع الـbuild
  parseHrTemplateBlocks(d.template, d.slug);
}

export const jobDescriptions: JobDescription[] = [...allJobDescriptions].sort((a, b) => b.date.localeCompare(a.date));

// صفحة /job-descriptions نفسها noindex,follow ومش في الـsitemap طول ما عدد الأوصاف أقل من كده (صفحات الأوصاف نفسها بتتفهرس عادي).
export const MIN_JOB_DESCRIPTIONS_FOR_INDEX = 3;

export function getJobDescription(slug: string): JobDescription | undefined {
  return jobDescriptions.find((d) => d.slug === slug);
}
