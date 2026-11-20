import type { Metadata } from "next";
import Link from "next/link";
import ArticleBody from "@/lib/articleMarkdown";
import { salaryCalculatorContent } from "@/content/tools/salary-calculator";
import { getArticle } from "@/content/articles";
import { getHrTemplate } from "@/content/hr-templates";
import TrackedDownloadLink from "@/components/TrackedDownloadLink";
import SalaryCalculator from "./SalaryCalculator";

const SITE_URL = "https://www.elshoghl.com";
const PATH = "/tools/salary-calculator";
const { title, description, intro, body } = salaryCalculatorContent;
const pageTitle = `${title} - الشغل`;

export const metadata: Metadata = {
  title: pageTitle,
  description,
  alternates: { canonical: PATH },
  openGraph: { title: pageTitle, description, url: PATH, siteName: "الشغل", locale: "ar_EG", type: "website" },
  twitter: { card: "summary_large_image", title: pageTitle, description },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    description,
    url: `${SITE_URL}${PATH}`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "All",
    inLanguage: "ar",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EGP" },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}${PATH}` },
    ],
  },
];

// روابط مفيدة بعناوينها الحقيقية من المحتوى (لو أي واحد اتشال بيختفي من القايمة بدل رابط مكسور)
const usefulLinks = [
  { href: "/articles/minimum-wage-private-sector-egypt", title: getArticle("minimum-wage-private-sector-egypt")?.title },
  { href: "/hr-templates/salary-certificate", title: getHrTemplate("salary-certificate")?.title },
  { href: "/articles/how-to-set-fair-salary-small-business", title: getArticle("how-to-set-fair-salary-small-business")?.title },
].filter((l): l is { href: string; title: string } => !!l.title);

// ملف كشف المرتبات والحضور (public/tools) تحت الحاسبة مباشرة، وعداده في file_downloads (TrackedDownloadLink).
// منفصل عن لينك Excel الحاسبة نفسها (جوه SalaryCalculator.tsx وعداده في tool_usage).
const payrollFile = {
  href: "/tools/payroll-attendance.xlsx",
  label: "تحميل كشف المرتبات والحضور (Excel)",
  note: "إذا كنت تحسب مرتبات عدد من الموظفين كل شهر: ملف Excel يضم كشف حضور يوميًا، وكشف مرتبات يسحب منه الإضافي والغياب والجزاءات، ويحسب التأمينات والضريبة والصافي وتكلفة صاحب العمل لما يصل إلى 100 موظف.",
};

export default function SalaryCalculatorPage() {
  return (
    <article dir="rtl" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", boxSizing: "border-box", width: "100%" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <h1 style={{ fontSize: 28, fontWeight: 900, color: "#14213D", margin: "0 0 12px", lineHeight: 1.5 }}>{title}</h1>
      <p style={{ color: "#4A5568", lineHeight: 1.9, margin: "0 0 20px", fontSize: 15.5 }}>{intro}</p>

      <SalaryCalculator />

      <div style={payrollBoxStyle}>
        <p style={{ margin: 0, fontSize: 14, color: "#4A5568", lineHeight: 1.9 }}>{payrollFile.note}</p>
        <TrackedDownloadLink href={payrollFile.href} style={downloadStyle}>
          {payrollFile.label}
        </TrackedDownloadLink>
      </div>

      <div style={{ marginTop: 32 }}>
        <ArticleBody markdown={body} />
      </div>

      {usefulLinks.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 12 }}>روابط مفيدة</h2>
          <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 2 }}>
            {usefulLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} style={{ color: "#14213D", fontWeight: 700 }}>{l.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

// نفس شكل صناديق extraDownloads في hr-templates/[slug]/page.tsx (padding وborder وradius وbackground)، ومسافة 16 فوق
const payrollBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  border: "1px solid #14213D22",
  borderRadius: 10,
  background: "#fff",
};

// نفس ستايل لينك "تحميل الحاسبة كملف Excel" جوه SalaryCalculator.tsx
const downloadStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 18,
  padding: "10px 20px",
  border: "1px solid #14213D",
  borderRadius: 8,
  color: "#14213D",
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  background: "#F8F6F0",
};
