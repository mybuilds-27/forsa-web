import type { Metadata } from "next";

// noindex مع follow: الصفحة تفضل شغالة للزوار وجوجل يتابع اللينكات اللي فيها، بس من غير ما تتفهرس
export const NOINDEX_FOLLOW = { index: false, follow: true } as const;

// canonical + og:url لصفحة عامة. openGraph وtwitter في Next.js مبيتدمجوش مع اللي في layout.tsx (الكائن
// كله بيتبدل)، فأي صفحة مكانتش بتعرّفهم كانت بترث og:url بتاع الرئيسية — هنا بنعرّفهم كاملين للصفحة نفسها.
// path نسبي (/jobs/...) وmetadataBase في layout.tsx بيكمّله للدومين.
export function pageSeo({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: "الشغل", locale: "ar_EG", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    ...(noindex ? { robots: NOINDEX_FOLLOW } : {}),
  };
}

// الصفحات الخاصة (لوحات الحسابات والتسجيل): ممنوعة في robots.ts أصلًا، وده بيضيف noindex,nofollow
// وعنوان خاص بيها بدل ما ترث عنوان الرئيسية ووصفها.
export function privatePageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
