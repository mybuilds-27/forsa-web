import type { Article } from "./types";
import { article as cvArticle } from "./cv-article";
import { article as interviewArticle } from "./interview-questions";
import { article as fakeJobsArticle } from "./avoid-fake-jobs";
import { article as jobSearchArticle } from "./how-to-search-for-a-job";
import { article as salaryArticle } from "./salary-negotiation";
import { article as jobAdArticle } from "./how-to-write-a-job-ad";
import { article as first90DaysArticle } from "./first-90-days-at-a-new-job";
import { article as laborLawArticle } from "./labor-law-worker-rights";
import { article as freshGraduatesArticle } from "./jobs-for-fresh-graduates";
import { article as socialInsuranceArticle } from "./social-insurance-rights";
import { article as employmentContractArticle } from "./employment-contract-checklist";
import { article as careerChangeArticle } from "./changing-career-field";
import { article as terminationRightsArticle } from "./probation-and-termination-rights";

// إضافة مقال جديد: اعمل ملف جديد في المجلد ده (انسخ cv-article.ts)، وضيف سطر import فوق
// وسطر في المصفوفة تحت. الترتيب هنا مش مهم، المقالات بتتعرض الأحدث الأول حسب date.
const allArticles: Article[] = [cvArticle, interviewArticle, fakeJobsArticle, jobSearchArticle, salaryArticle, jobAdArticle, first90DaysArticle, laborLawArticle, freshGraduatesArticle, socialInsuranceArticle, employmentContractArticle, careerChangeArticle, terminationRightsArticle];

const slugs = new Set<string>();
for (const a of allArticles) {
  if (slugs.has(a.slug)) {
    throw new Error(`slug مكرر في content/articles: ${a.slug}`);
  }
  slugs.add(a.slug);
}

export const articles: Article[] = [...allArticles].sort((a, b) => b.date.localeCompare(a.date));

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

// آخر تعديل: updatedAt لو موجود وأحدث من تاريخ النشر، وإلا تاريخ النشر نفسه
export function articleModifiedDate(a: Article): string {
  return a.updatedAt && a.updatedAt > a.date ? a.updatedAt : a.date;
}

// مقالات ذات صلة: نفس التصنيف الأول (من الأحدث)، وبعدين الأحدث من الباقي، من غير المقال نفسه
export function getRelatedArticles(slug: string, count = 3): Article[] {
  const current = getArticle(slug);
  const others = articles.filter((a) => a.slug !== slug);
  const sameCategory = current?.category ? others.filter((a) => a.category === current.category) : [];
  const rest = others.filter((a) => !sameCategory.includes(a));
  return [...sameCategory, ...rest].slice(0, count);
}

// أحدث المقالات (اختياري: تصنيف معيّن) — articles مترتبة من الأحدث أصلًا
export function getLatestArticles(count: number, category?: Article["category"]): Article[] {
  return (category ? articles.filter((a) => a.category === category) : articles).slice(0, count);
}

// UTC صريح عشان التاريخ ميتزحزحش يوم حسب منطقة السيرفر وقت الـbuild.
export function formatArticleDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
