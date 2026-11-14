import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHrTemplate, hrTemplates, templateModifiedDate } from "@/content/hr-templates";
import type { HrTemplate } from "@/content/hr-templates/types";
import { formatArticleDate, getArticle } from "@/content/articles";
import type { Article } from "@/content/articles/types";
import ArticleBody from "@/lib/articleMarkdown";
import ArticleCard, { articleGridStyle } from "@/components/ArticleCard";
import HrTemplateCard from "@/components/HrTemplateCard";
import HrTemplateActions from "@/components/HrTemplateActions";

const SITE_URL = "https://www.elshoghl.com";

// Article + BreadcrumbList (schema.org)، بنفس شكل صفحة المقال: datePublished = date، وdateModified = updatedAt لو أحدث.
function templateJsonLd(t: HrTemplate) {
  const url = `${SITE_URL}/hr-templates/${t.slug}`;
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
      headline: t.title,
      description: t.description,
      datePublished: t.date,
      dateModified: templateModifiedDate(t),
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
        { "@type": "ListItem", position: 2, name: "نماذج الموارد البشرية", item: `${SITE_URL}/hr-templates` },
        { "@type": "ListItem", position: 3, name: t.title, item: url },
      ],
    },
  ];
}

// أي slug مش موجود في content/hr-templates بيرجع 404 على طول (مفيش توليد وقت الطلب).
export const dynamicParams = false;

export function generateStaticParams() {
  return hrTemplates.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = getHrTemplate(slug);
  if (!t) {
    return { title: "نموذج غير متاح - الشغل" };
  }
  const title = `${t.title} - الشغل`;
  const url = `/hr-templates/${t.slug}`;
  return {
    title,
    description: t.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: t.description,
      url,
      siteName: "الشغل",
      locale: "ar_EG",
      type: "article",
      publishedTime: t.date,
      modifiedTime: templateModifiedDate(t),
    },
    twitter: { card: "summary_large_image", title, description: t.description },
  };
}

export default async function HrTemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getHrTemplate(slug);
  if (!t) notFound();
  const modified = templateModifiedDate(t);
  const relatedArticles = (t.relatedArticles || []).map(getArticle).filter((a): a is Article => !!a);
  const otherTemplates = hrTemplates.filter((x) => x.slug !== t.slug).slice(0, 3);

  return (
    <article dir="rtl" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(templateJsonLd(t)).replace(/</g, "\\u003c") }}
      />
      <Link href="/hr-templates" style={backButtonStyle}>
        → كل نماذج الموارد البشرية
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: "#14213D", margin: "16px 0 10px", lineHeight: 1.5 }}>{t.title}</h1>
      <time dateTime={t.date} style={{ fontSize: 13, color: "#4A5568" }}>
        {formatArticleDate(t.date)}
      </time>
      {modified !== t.date && (
        <div style={{ fontSize: 13, color: "#4A5568", marginTop: 4 }}>
          آخر تحديث: <time dateTime={modified}>{formatArticleDate(modified)}</time>
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <ArticleBody markdown={t.body} />
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 12 }}>النموذج</h2>
        {/* نص عادي (مش Markdown) عشان الخانات والسطور تفضل زي ما هي */}
        <div
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
          {t.template}
        </div>
        <HrTemplateActions template={t.template} />
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

      {otherTemplates.length > 0 && (
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 14 }}>نماذج أخرى</h2>
          <div style={articleGridStyle}>
            {otherTemplates.map((x) => (
              <HrTemplateCard key={x.slug} template={x} />
            ))}
          </div>
        </section>
      )}

      <div style={{ marginTop: 36 }}>
        <Link href="/hr-templates" style={backButtonStyle}>
          → كل نماذج الموارد البشرية
        </Link>
      </div>
    </article>
  );
}

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
