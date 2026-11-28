import type { Metadata } from "next";
import Link from "next/link";
import { HR_TEMPLATES_INTRO, hrTemplates } from "@/content/hr-templates";
import ArticleBody from "@/lib/articleMarkdown";
import HrTemplateCard from "@/components/HrTemplateCard";
import { articleGridStyle } from "@/components/ArticleCard";

const SITE_URL = "https://www.elshoghl.com";
const TITLE = "نماذج الموارد البشرية - الشغل";
const DESCRIPTION = "نماذج موارد بشرية جاهزة للنسخ والطباعة لأصحاب الأعمال في مصر، مع شرح ما يقوله قانون العمل رقم 14 لسنة 2025 عن كل نموذج.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/hr-templates" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/hr-templates",
    siteName: "الشغل",
    locale: "ar_EG",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "الرئيسية", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "نماذج الموارد البشرية", item: `${SITE_URL}/hr-templates` },
  ],
};

export default function HrTemplatesPage() {
  return (
    <div dir="rtl" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#14213D", marginBottom: 8 }}>نماذج الموارد البشرية</h1>
      <div style={{ marginBottom: 24 }}>
        <ArticleBody markdown={HR_TEMPLATES_INTRO} />
      </div>

      {/* لينك الأوصاف الوظيفية الجاهزة: نفس شكل صندوق "قبل ما تقدّم" في صفحة الوظيفة (app/jobs/[id]/page.tsx) */}
      <div style={{ marginBottom: 20, padding: "14px 16px", background: "#F8F6F0", border: "1px solid #14213D1F", borderRadius: 10, color: "#14213D", lineHeight: 1.8 }}>
        تبحث عن وصف وظيفي مكتوب لوظيفة محددة؟ تصفح{" "}
        <Link href="/job-descriptions" style={{ color: "#14213D", fontWeight: 700 }}>نماذج الوصف الوظيفي الجاهزة</Link>{" "}
        للمحاسبين والمبيعات والموارد البشرية والمخازن.
      </div>

      {hrTemplates.length === 0 ? (
        <p style={{ color: "#4A5568" }}>مفيش نماذج لسه.</p>
      ) : (
        <div style={articleGridStyle}>
          {hrTemplates.map((t) => (
            <HrTemplateCard key={t.slug} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
