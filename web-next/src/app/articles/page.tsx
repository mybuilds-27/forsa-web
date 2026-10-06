import type { Metadata } from "next";
import Link from "next/link";
import { articles, formatArticleDate } from "@/content/articles";

const TITLE = "مقالات - الشغل";
const DESCRIPTION = "مقالات ونصايح عن التوظيف والبحث عن شغل في مصر: كتابة السيرة الذاتية، المقابلات الشخصية، واختيار الوظيفة المناسبة.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/articles" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/articles",
    siteName: "الشغل",
    locale: "ar_EG",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ArticlesPage() {
  return (
    <div dir="rtl" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#14213D", marginBottom: 8 }}>مقالات</h1>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 24 }}>
        نصايح وإرشادات تساعدك في رحلة البحث عن شغل أو التوظيف.
      </p>

      {articles.length === 0 ? (
        <p style={{ color: "#4A5568" }}>مفيش مقالات لسه.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/articles/${a.slug}`}
              style={{
                display: "block",
                border: "1px solid #14213D22",
                borderRadius: 10,
                padding: 18,
                textDecoration: "none",
                background: "#fff",
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#14213D", margin: "0 0 8px", lineHeight: 1.6 }}>{a.title}</h2>
              <p style={{ fontSize: 14.5, color: "#4A5568", lineHeight: 1.8, margin: "0 0 10px" }}>{a.description}</p>
              <time dateTime={a.date} style={{ fontSize: 12.5, color: "#4A5568" }}>
                {formatArticleDate(a.date)}
              </time>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
