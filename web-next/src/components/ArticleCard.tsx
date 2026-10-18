import Link from "next/link";
import { formatArticleDate } from "@/content/articles";
import type { Article } from "@/content/articles/types";

// كارت مقال صغير (مقالات ذات صلة، ودليل الباحث عن عمل في الرئيسية) — نفس ألوان وحدود كروت /articles،
// بس أصغر شوية عشان تتحط في شبكة.
export default function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
        boxSizing: "border-box",
        border: "1px solid #14213D22",
        borderRadius: 10,
        padding: 16,
        textDecoration: "none",
        background: "#fff",
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#14213D", margin: 0, lineHeight: 1.6 }}>{article.title}</h3>
      <p style={{ fontSize: 13.5, color: "#4A5568", lineHeight: 1.8, margin: 0 }}>{article.description}</p>
      <time dateTime={article.date} style={{ fontSize: 12, color: "#4A5568", marginTop: "auto" }}>
        {formatArticleDate(article.date)}
      </time>
    </Link>
  );
}

export const articleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};
