import type { MetadataRoute } from "next";

// نفس الدومين المستخدم في sitemap.ts. بنمنع بس المسارات الخاصة اللي مالهاش لازمة في نتايج البحث
// (لوحة الأدمن، لوحتا الباحث وصاحب العمل، وصفحة التسجيل/الدخول)؛ كل الصفحات العامة
// (/jobs و/articles و/companies و/faq... إلخ) مسموحة.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seeker", "/employer", "/register"],
    },
    sitemap: "https://www.elshoghl.com/sitemap.xml",
  };
}
