import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articles, formatArticleDate, getArticle } from "@/content/articles";
import ArticleBody from "@/lib/articleMarkdown";

// أي slug مش موجود في content/articles بيرجع 404 على طول (مفيش توليد وقت الطلب).
export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    return { title: "مقال غير متاح - الشغل" };
  }
  const title = `${article.title} - الشغل`;
  const url = `/articles/${article.slug}`;
  return {
    title,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: article.description,
      url,
      siteName: "الشغل",
      locale: "ar_EG",
      type: "article",
      publishedTime: article.date,
    },
    twitter: { card: "summary_large_image", title, description: article.description },
  };
}

const ctaPrimaryStyle: React.CSSProperties = {
  padding: "12px 24px",
  background: "#14213D",
  color: "#fff",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
};

const ctaGhostStyle: React.CSSProperties = {
  padding: "12px 24px",
  border: "1px solid #14213D",
  color: "#14213D",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
};

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <article dir="rtl" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <Link href="/articles" style={{ fontSize: 14, color: "#4A5568", textDecoration: "none" }}>
        → كل المقالات
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 900, color: "#14213D", margin: "16px 0 10px", lineHeight: 1.5 }}>{article.title}</h1>
      <time dateTime={article.date} style={{ fontSize: 13, color: "#4A5568" }}>
        {formatArticleDate(article.date)}
      </time>

      <div style={{ marginTop: 24 }}>
        <ArticleBody markdown={article.body} />
      </div>

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
          دوّر على وظيفتك الجاية دلوقتي — التسجيل والتقديم مجاني للباحثين عن عمل.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/jobs" style={ctaPrimaryStyle}>تصفّح الوظائف</Link>
          <Link href="/register" style={ctaGhostStyle}>سجّل مجانًا</Link>
        </div>
      </div>
    </article>
  );
}
