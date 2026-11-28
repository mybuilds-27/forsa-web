import type { Metadata } from "next";
import { jobDescriptions, MIN_JOB_DESCRIPTIONS_FOR_INDEX } from "@/content/job-descriptions";
import { JOB_DESCRIPTION_DEPARTMENTS } from "@/content/job-descriptions/types";
import ArticleBody from "@/lib/articleMarkdown";
import HrTemplateCard from "@/components/HrTemplateCard";
import { articleGridStyle } from "@/components/ArticleCard";
import { NOINDEX_FOLLOW } from "@/lib/seoMetadata";

const SITE_URL = "https://www.elshoghl.com";
const TITLE = "أوصاف وظيفية جاهزة لأهم الوظائف (Word) - الشغل";
const DESCRIPTION =
  "أوصاف وظيفية جاهزة للمحاسبين والمبيعات والموارد البشرية والمخازن وغيرها، بالمهام ومؤشرات الأداء والمؤهلات، جاهزة للنسخ والتعديل والتحميل كملف Word.";
const INTRO =
  "أوصاف وظيفية مكتوبة لوظائف محددة، تشمل الهدف من الوظيفة والمهام بنسب الوقت ومؤشرات الأداء والمؤهلات والجدارات. يمكنك نسخ أي وصف وتعديله بما يناسب منشأتك، أو تحميله كملف Word. وإذا أردت كتابة وصف لوظيفة غير موجودة هنا، فاستخدم [نموذج الوصف الوظيفي وطريقة كتابته](/hr-templates/job-description).";

// الصفحة دي noindex,follow (ومش في الـsitemap) طول ما عدد الأوصاف أقل من MIN_JOB_DESCRIPTIONS_FOR_INDEX — صفحات الأوصاف نفسها بتتفهرس عادي.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/job-descriptions" },
  ...(jobDescriptions.length < MIN_JOB_DESCRIPTIONS_FOR_INDEX ? { robots: NOINDEX_FOLLOW } : {}),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/job-descriptions",
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
    { "@type": "ListItem", position: 2, name: "أوصاف وظيفية جاهزة", item: `${SITE_URL}/job-descriptions` },
  ],
};

export default function JobDescriptionsPage() {
  // الأقسام بترتيب JOB_DESCRIPTION_DEPARTMENTS، والقسم اللي مفيهوش أوصاف مبيظهرش
  const groups = JOB_DESCRIPTION_DEPARTMENTS.map((department) => ({
    department,
    items: jobDescriptions.filter((d) => d.department === department),
  })).filter((g) => g.items.length > 0);

  return (
    <div dir="rtl" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#14213D", marginBottom: 8 }}>أوصاف وظيفية جاهزة</h1>
      <div style={{ marginBottom: 24 }}>
        <ArticleBody markdown={INTRO} />
      </div>

      {groups.map((g) => (
        <section key={g.department} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 14 }}>{g.department}</h2>
          <div style={articleGridStyle}>
            {g.items.map((d) => (
              <HrTemplateCard key={d.slug} template={d} basePath="/job-descriptions" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
