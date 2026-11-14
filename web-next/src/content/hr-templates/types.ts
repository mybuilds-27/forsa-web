export type HrTemplate = {
  // بيطلع في الرابط /hr-templates/{slug} — حروف إنجليزية صغيرة وأرقام وشرطات بس، وفريد لكل نموذج.
  slug: string;
  title: string;
  // بتظهر في كارت القايمة وفي meta description، فخليها جملة أو اتنين.
  description: string;
  // YYYY-MM-DD
  date: string;
  // YYYY-MM-DD، اختياري: آخر تعديل حقيقي. بيتستخدم في dateModified (JSON-LD) والـsitemap.
  updatedAt?: string;
  // الشرح: نفس Markdown المقالات (شوف lib/articleMarkdown.tsx).
  body: string;
  // النموذج نفسه: نص عادي فيه خانات زي [اسم الموظف]، بيتعرض زي ما هو (pre-wrap، مش Markdown)،
  // وهو اللي بيتنسخ وبيتطبع.
  template: string;
  // slugs مقالات مرتبطة (content/articles): بتظهر في "مقالات ذات صلة" هنا، والنموذج بيظهر في
  // "نماذج ذات صلة" في صفحة كل مقال منهم.
  relatedArticles?: string[];
};
