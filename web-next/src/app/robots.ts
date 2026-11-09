import type { MetadataRoute } from "next";

// نفس الدومين المستخدم في sitemap.ts. بنمنع بس المسارات الخاصة اللي مالهاش لازمة في نتايج البحث
// (لوحة الأدمن، ولوحتا الباحث وصاحب العمل)؛ كل الصفحات العامة (/jobs و/articles و/companies
// و/faq... إلخ) مسموحة. /register مش هنا عن قصد: لو اتمنعت جوجل مبيقدرش يشوف الـnoindex بتاعها
// (في register/layout.tsx) وبيفهرسها من اللينكات ("تمت فهرستها رغم حظرها بواسطة robots.txt").
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seeker", "/employer"],
    },
    sitemap: "https://www.elshoghl.com/sitemap.xml",
  };
}
