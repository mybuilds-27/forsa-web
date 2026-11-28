import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobDescription, jobDescriptions } from "@/content/job-descriptions";
import type { JobDescription } from "@/content/job-descriptions/types";
import { templateModifiedDate } from "@/content/hr-templates";
import { formatArticleDate, getArticle } from "@/content/articles";
import type { Article } from "@/content/articles/types";
import ArticleBody from "@/lib/articleMarkdown";
import ArticleCard, { articleGridStyle } from "@/components/ArticleCard";
import HrTemplateCard from "@/components/HrTemplateCard";
import HrTemplateActions from "@/components/HrTemplateActions";
import HrTemplateBlocksView from "@/components/HrTemplateBlocksView";
import { parseHrTemplateBlocks } from "@/lib/hrTemplateBlocks";

// صفحة وصف وظيفي جاهز: نفس صفحة النموذج (app/hr-templates/[slug]/page.tsx) بنفس الكومبوننتس — الشرح، ومربع
// البطاقة بالجداول، والنسخ والطباعة والـWord (HrTemplateActions بمسار الصفحة دي ومعرّف استخدام jd-{slug}).

const SITE_URL = "https://www.elshoghl.com";

// Article + BreadcrumbList (schema.org): الرئيسية ← أوصاف وظيفية جاهزة ← العنوان
function jobDescriptionJsonLd(d: JobDescription) {
  const url = `${SITE_URL}/job-descriptions/${d.slug}`;
  const organization = {
    "@type": "Organization",
    name: "الشغل",
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
  };
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: d.title,
      description: d.description,
      datePublished: d.date,
      dateModified: templateModifiedDate(d),
      inLanguage: "ar",
      author: organization,
      publisher: organization,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "الرئيسية", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "أوصاف وظيفية جاهزة", item: `${SITE_URL}/job-descriptions` },
        { "@type": "ListItem", position: 3, name: d.title, item: url },
      ],
    },
  ];
}

// أي slug مش موجود في content/job-descriptions بيرجع 404 على طول (مفيش توليد وقت الطلب).
export const dynamicParams = false;

export function generateStaticParams() {
  return jobDescriptions.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = getJobDescription(slug);
  if (!d) {
    return { title: "وصف وظيفي غير متاح - الشغل" };
  }
  const title = `${d.title} - الشغل`;
  const url = `/job-descriptions/${d.slug}`;
  return {
    title,
    description: d.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: d.description,
      url,
      siteName: "الشغل",
      locale: "ar_EG",
      type: "article",
      publishedTime: d.date,
      modifiedTime: templateModifiedDate(d),
    },
    twitter: { card: "summary_large_image", title, description: d.description },
  };
}

export default async function JobDescriptionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = getJobDescription(slug);
  if (!d) notFound();
  const modified = templateModifiedDate(d);
  const relatedArticles = (d.relatedArticles || []).map(getArticle).filter((a): a is Article => !!a);
  const others = jobDescriptions.filter((x) => x.slug !== d.slug).slice(0, 3);

  return (
    <article dir="rtl" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobDescriptionJsonLd(d)).replace(/</g, "\\u003c") }}
      />
      <Link href="/job-descriptions" style={backButtonStyle}>
        → كل الأوصاف الوظيفية
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: "#14213D", margin: "16px 0 10px", lineHeight: 1.5 }}>{d.title}</h1>
      <time dateTime={d.date} style={{ fontSize: 13, color: "#4A5568" }}>
        {formatArticleDate(d.date)}
      </time>
      {modified !== d.date && (
        <div style={{ fontSize: 13, color: "#4A5568", marginTop: 4 }}>
          آخر تحديث: <time dateTime={modified}>{formatArticleDate(modified)}</time>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <ArticleBody markdown={d.body} />
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 12 }}>بطاقة الوصف الوظيفي</h2>
        {/* نفس مربع النموذج في /hr-templates/[slug]: نص عادي، والسطور اللي بين | | بتتعرض جداول */}
        <div
          data-testid="hr-template-box"
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: 2,
            fontSize: 15,
            color: "#1A202C",
            background: "#F8F6F0",
            border: "1px solid #14213D33",
            borderRadius: 10,
            padding: 20,
          }}
        >
          <HrTemplateBlocksView blocks={parseHrTemplateBlocks(d.template, d.slug)} />
        </div>
        <HrTemplateActions template={d.template} slug={d.slug} pagePath={`/job-descriptions/${d.slug}`} usageId={`jd-${d.slug}`} />
      </section>

      <div
        style={{
          marginTop: 36,
          padding: 20,
          background: "#F8F6F0",
          border: "1px solid #14213D1F",
          borderRadius: 10,
        }}
      >
        <p style={{ margin: "0 0 14px", fontWeight: 700, color: "#14213D", lineHeight: 1.8 }}>
          تبحث عن موظفين؟ انشر وظيفتك مجانًا على الشغل
        </p>
        <Link href="/register?role=employer" style={ctaPrimaryStyle}>انشر وظيفة مجانًا</Link>
      </div>

      {relatedArticles.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 14 }}>مقالات ذات صلة</h2>
          <div style={articleGridStyle}>
            {relatedArticles.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 14 }}>أوصاف وظيفية أخرى</h2>
          <div style={articleGridStyle}>
            {others.map((x) => (
              <HrTemplateCard key={x.slug} template={x} basePath="/job-descriptions" />
            ))}
          </div>
        </section>
      )}

      <div style={{ marginTop: 36 }}>
        <Link href="/job-descriptions" style={backButtonStyle}>
          → كل الأوصاف الوظيفية
        </Link>
      </div>
    </article>
  );
}

// نفس ستايلات app/hr-templates/[slug]/page.tsx (ملفات الصفحات مينفعش تصدّر حاجات غير بتاعة Next، فمتكررة هنا)
const backButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 16px",
  border: "1px solid #14213D",
  borderRadius: 8,
  color: "#14213D",
  fontWeight: 700,
  fontSize: 14,
  background: "#F8F6F0",
  textDecoration: "none",
};

const ctaPrimaryStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 24px",
  background: "#14213D",
  color: "#fff",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
};
