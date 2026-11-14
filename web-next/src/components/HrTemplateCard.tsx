import Link from "next/link";
import { formatArticleDate } from "@/content/articles";
import type { HrTemplate } from "@/content/hr-templates/types";

// كارت نموذج (قايمة /hr-templates، ونماذج أخرى، ونماذج ذات صلة في صفحة المقال) — نفس شكل ArticleCard،
// والشبكة نفسها articleGridStyle.
export default function HrTemplateCard({ template }: { template: HrTemplate }) {
  return (
    <Link
      href={`/hr-templates/${template.slug}`}
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
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#14213D", margin: 0, lineHeight: 1.6 }}>{template.title}</h3>
      <p style={{ fontSize: 13.5, color: "#4A5568", lineHeight: 1.8, margin: 0 }}>{template.description}</p>
      <time dateTime={template.date} style={{ fontSize: 12, color: "#4A5568", marginTop: "auto" }}>
        {formatArticleDate(template.date)}
      </time>
    </Link>
  );
}
