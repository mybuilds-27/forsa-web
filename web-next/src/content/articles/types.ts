export type ArticleCategory = "seekers" | "employers";

export type Article = {
  // بيطلع في الرابط /articles/{slug} — حروف إنجليزية صغيرة وأرقام وشرطات بس، وفريد لكل مقال.
  slug: string;
  title: string;
  // بتظهر في كارت القايمة وفي meta description، فخليها جملة أو اتنين.
  description: string;
  // YYYY-MM-DD
  date: string;
  // YYYY-MM-DD، اختياري: آخر تعديل حقيقي في المقال. لو موجود وأحدث من date بيظهر "آخر تحديث" تحت العنوان،
  // وبيتستخدم في dateModified (JSON-LD) والـsitemap. لو مش موجود، dateModified = date.
  updatedAt?: string;
  // لمين المقال: seekers (الباحثين عن عمل) أو employers (أصحاب الأعمال). بيستخدم في "مقالات ذات صلة"
  // (نفس التصنيف الأول) وفي "دليل الباحث عن عمل" في الرئيسية (seekers بس).
  category?: ArticleCategory;
  // Markdown مبسّط (شوف lib/articleMarkdown.tsx): ## عنوان، ### عنوان فرعي، - قايمة نقطية،
  // 1. قايمة مرقّمة، **غامق**، [نص](/رابط)، وسطر فاضي بين كل فقرة.
  body: string;
};
