import { cache } from "react";
import { notFound } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import JobListItem from "@/app/jobs/JobListItem";
import CompanyLogo from "@/components/CompanyLogo";

// cache() عشان generateMetadata والصفحة يشاركوا نفس القراءتين في نفس الطلب بدل ما كل واحد يقرا لوحده.
const getCompany = cache(async (employerId: string): Promise<any> => {
  const snap = await getDoc(doc(db, "employers", employerId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
});

// نفس شرط ظهور الشركة في /companies والرئيسية (aggregateCompanies في lib/companiesQuery.ts): وظيفة نشطة
// غير منتهية وفيها showCompanyName == true. الصفحة بتتفتح بس لو القايمة دي مش فاضية — غير كده
// الشركة يا إما مخفية الاسم يا إما معندهاش وظايف معلنة، فمينفعش اسمها ونبذتها يبانوا لأي حد معاه الرابط.
const getCompanyJobs = cache(async (employerId: string) => {
  const q = query(
    collection(db, "job_posts"),
    where("employerId", "==", employerId),
    where("isActive", "==", true),
    where("showCompanyName", "==", true)
  );
  const snap = await getDocs(q);
  const now = Date.now();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now)
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
});

async function getPublicCompany(employerId: string) {
  const [company, jobs] = await Promise.all([getCompany(employerId), getCompanyJobs(employerId)]);
  if (!company || jobs.length === 0) return null;
  return { company, jobs };
}

// industry نص حر من صاحب العمل، وبعضهم بيكتب فيه إعلان كامل بأرقام تليفون. ده تعقيم للعرض العام
// بس — البيانات نفسها متلمسش. أي تسلسل فيه 8 أرقام أو أكتر (إنجليزي أو عربي ٠-٩ أو فارسي ۰-۹)، ممكن
// يبدأ بـ+ وبين كل رقمين فاصل واحد بالكتير (مسافة أو نقطة أو -) زي 010 1234 5678 أو 010.1234.5678،
// بيتبدل بـ"[رقم مخفي]". أرقام مفصولة بكلام (زي "من 2020 إلى 2024") بتتحسب كل واحدة لوحدها.
const INDUSTRY_SHORT_MAX = 60;
const INDUSTRY_DISPLAY_MAX = 160;
const META_DESCRIPTION_MAX = 155;
const DIGIT_RUN = /\+?[0-9٠-٩۰-۹](?:[ \u00A0.-]?[0-9٠-٩۰-۹])*/g;

function maskPhoneNumbers(text: string): string {
  return text.replace(DIGIT_RUN, (run) => ((run.match(/[0-9٠-٩۰-۹]/g) || []).length >= 8 ? "[رقم مخفي]" : run));
}

function industryForDisplay(industry: string): string {
  const masked = maskPhoneNumbers(industry.trim());
  if (industry.trim().length <= INDUSTRY_SHORT_MAX) return masked;
  return masked.length > INDUSTRY_DISPLAY_MAX ? `${masked.slice(0, INDUSTRY_DISPLAY_MAX).trimEnd()}…` : masked;
}

export async function generateMetadata({ params }: { params: Promise<{ employerId: string }> }) {
  const { employerId } = await params;
  const result = await getPublicCompany(employerId);
  if (!result) {
    return { title: "شركة غير متاحة - الشغل" };
  }
  const { company } = result;
  const industry = typeof company.industry === "string" ? company.industry.trim() : "";
  const description =
    industry && industry.length <= INDUSTRY_SHORT_MAX
      ? maskPhoneNumbers(industry).slice(0, META_DESCRIPTION_MAX)
      : `تصفح كل الوظائف المفتوحة حاليًا لدى ${company.companyName} على موقع الشغل.`;
  return {
    title: `${company.companyName} - وظائف على موقع الشغل`,
    description,
  };
}

export default async function CompanyProfilePage({ params }: { params: Promise<{ employerId: string }> }) {
  const { employerId } = await params;
  const result = await getPublicCompany(employerId);

  if (!result) {
    notFound();
  }

  const { company, jobs } = result;

  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        {company.logoURL ? (
          <CompanyLogo src={company.logoURL} alt={company.companyName} width={104} height={72} />
        ) : (
          <div
            style={{
              width: 104,
              height: 72,
              borderRadius: 12,
              background: "#F0EDE3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            🏢
          </div>
        )}
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{company.companyName}</h1>
          {(company.city || company.governorate) && (
            <div style={{ color: "#4A5568", fontSize: 14, marginTop: 4 }}>
              {company.city} - {company.governorate}
            </div>
          )}
        </div>
      </div>

      {typeof company.industry === "string" && company.industry.trim() && (
        <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 24 }}>{industryForDisplay(company.industry)}</p>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 16 }}>الوظائف المفتوحة حاليًا ({jobs.length})</h2>

      {jobs.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
          مفيش وظائف معلنة من الشركة دي دلوقتي.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {jobs.map((job) => (
          <JobListItem key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
