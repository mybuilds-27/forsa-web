export type Article = {
  // بيطلع في الرابط /articles/{slug} — حروف إنجليزية صغيرة وأرقام وشرطات بس، وفريد لكل مقال.
  slug: string;
  title: string;
  // بتظهر في كارت القايمة وفي meta description، فخليها جملة أو اتنين.
  description: string;
  // YYYY-MM-DD
  date: string;
  // Markdown مبسّط (شوف lib/articleMarkdown.tsx): ## عنوان، ### عنوان فرعي، - قايمة نقطية،
  // 1. قايمة مرقّمة، **غامق**، [نص](/رابط)، وسطر فاضي بين كل فقرة.
  body: string;
};
