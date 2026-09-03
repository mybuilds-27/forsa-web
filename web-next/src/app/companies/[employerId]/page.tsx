import { notFound } from "next/navigation";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import JobListItem from "@/app/jobs/JobListItem";

async function getCompany(employerId: string): Promise<any> {
  const snap = await getDoc(doc(db, "employers", employerId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function getCompanyJobs(employerId: string) {
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
}

export async function generateMetadata({ params }: { params: Promise<{ employerId: string }> }) {
  const { employerId } = await params;
  const company = await getCompany(employerId);
  if (!company) {
    return { title: "شركة غير متاحة - الشغل" };
  }
  return {
    title: `${company.companyName} - وظائف على موقع الشغل`,
    description: company.industry || `تصفح كل الوظائف المفتوحة حاليًا لدى ${company.companyName} على موقع الشغل.`,
  };
}

export default async function CompanyProfilePage({ params }: { params: Promise<{ employerId: string }> }) {
  const { employerId } = await params;
  const company = await getCompany(employerId);

  if (!company) {
    notFound();
  }

  const jobs = await getCompanyJobs(employerId);

  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        {company.logoURL ? (
          <img src={company.logoURL} alt={company.companyName} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12 }} />
        ) : (
          <div
            style={{
              width: 72,
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

      {company.industry && (
        <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 24 }}>{company.industry}</p>
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
