import type { HrTemplate } from "./types";
import { parseHrTemplateBlocks } from "@/lib/hrTemplateBlocks";
import { hrTemplate as experienceCertificate } from "./experience-certificate";
import { hrTemplate as leaveRequest } from "./leave-request";
import { hrTemplate as violationNoticeInvestigation } from "./violation-notice-investigation";
import { hrTemplate as jobOfferLetter } from "./job-offer-letter";
import { hrTemplate as resignationAcceptance } from "./resignation-acceptance";
import { hrTemplate as employeeClearance } from "./employee-clearance";
import { hrTemplate as probationEvaluation } from "./probation-evaluation";
import { hrTemplate as salaryCertificate } from "./salary-certificate";
import { hrTemplate as salaryAdvanceRequest } from "./salary-advance-request";
import { hrTemplate as remoteWorkContractAnnex } from "./remote-work-contract-annex";
import { hrTemplate as missionExitPermit } from "./mission-exit-permit";
import { hrTemplate as leavePolicy } from "./leave-policy";
import { hrTemplate as jobApplicationForm } from "./job-application-form";

// إضافة نموذج جديد: اعمل ملف جديد في المجلد ده (انسخ experience-certificate.ts)، وضيف سطر import فوق
// وسطر في المصفوفة تحت. النماذج بتتعرض الأحدث الأول حسب date.
const allTemplates: HrTemplate[] = [experienceCertificate, leaveRequest, violationNoticeInvestigation, jobOfferLetter, resignationAcceptance, employeeClearance, probationEvaluation, salaryCertificate, salaryAdvanceRequest, remoteWorkContractAnnex, missionExitPermit, leavePolicy, jobApplicationForm];

const slugs = new Set<string>();
for (const t of allTemplates) {
  if (slugs.has(t.slug)) {
    throw new Error(`slug مكرر في content/hr-templates: ${t.slug}`);
  }
  slugs.add(t.slug);
  // جداول النموذج (سطور | |): أي جدول صفوفه عدد خاناتها مختلف بيرمي Error فيه الـslug ورقم السطر، فيوقّع الـbuild
  parseHrTemplateBlocks(t.template, t.slug);
}

export const hrTemplates: HrTemplate[] = [...allTemplates].sort((a, b) => b.date.localeCompare(a.date));

export function getHrTemplate(slug: string): HrTemplate | undefined {
  return hrTemplates.find((t) => t.slug === slug);
}

// آخر تعديل: updatedAt لو موجود وأحدث من تاريخ النشر، وإلا تاريخ النشر نفسه
export function templateModifiedDate(t: HrTemplate): string {
  return t.updatedAt && t.updatedAt > t.date ? t.updatedAt : t.date;
}

// النماذج المرتبطة بمقال (relatedArticles فيها slug المقال) — لقسم "نماذج ذات صلة" في صفحة المقال
export function getTemplatesForArticle(articleSlug: string): HrTemplate[] {
  return hrTemplates.filter((t) => t.relatedArticles?.includes(articleSlug));
}

// مقدمة صفحة /hr-templates (Markdown، بتتعرض بـArticleBody)
export const HR_TEMPLATES_INTRO = `
مجموعة من النماذج الجاهزة التي يحتاجها أصحاب الأعمال وموظفو الموارد البشرية في العمل اليومي، من شهادات الخبرة إلى طلبات الإجازة والإخطارات الكتابية. كل نموذج يأتي مع شرح لما يقوله قانون العمل رقم 14 لسنة 2025 عنه، وطريقة ملء بياناته، والأخطاء الشائعة التي يجب تجنبها.

يمكنك نسخ أي نموذج وتعديله بما يناسب منشأتك، أو طباعته مباشرة. وننصح دائمًا بمراجعة النموذج قبل استخدامه، والتأكد من أن بياناته صحيحة ومطابقة لملف الموظف، والرجوع إلى نص القانون أو مستشار قانوني في الحالات الخاصة.
`;
