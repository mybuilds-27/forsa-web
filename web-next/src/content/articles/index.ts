import type { Article } from "./types";
import { article as cvArticle } from "./cv-article";

// إضافة مقال جديد: اعمل ملف جديد في المجلد ده (انسخ cv-article.ts)، وضيف سطر import فوق
// وسطر في المصفوفة تحت. الترتيب هنا مش مهم، المقالات بتتعرض الأحدث الأول حسب date.
const allArticles: Article[] = [cvArticle];

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

// UTC صريح عشان التاريخ ميتزحزحش يوم حسب منطقة السيرفر وقت الـbuild.
export function formatArticleDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
