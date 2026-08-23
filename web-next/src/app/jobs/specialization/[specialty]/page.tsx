import Link from "next/link";
import { notFound } from "next/navigation";
import { findSpecialtyBySlug, slugify } from "@/lib/constants";
import { getActivePublicJobs, getActiveJobsSeoData } from "@/lib/publicJobsQuery";
import BrowseSidebar from "@/components/BrowseSidebar";
import PublicJobsList from "@/components/PublicJobsList";

// نفس مشكلة الـstatic prerender اللي لقيناها في companies/page.tsx وjobs/page.tsx —
// من غيرها، صفحة التخصص لوحده ممكن تفضل بالبيانات القديمة لحد أول deploy جديد.
// force-dynamic بيضمن قراءة فريش من Firestore في كل طلب.
export const dynamic = "force-dynamic";

const POPULAR_COMBOS_COUNT = 8;

export async function generateMetadata({ params }: { params: Promise<{ specialty: string }> }) {
  const { specialty: specSlug } = await params;
  const specialization = findSpecialtyBySlug(decodeURIComponent(specSlug));
  if (!specialization) return { title: "صفحة غير موجودة - الشغل" };

  const jobs = await getActivePublicJobs({ specialization });
  const title = `وظايف شغل ${specialization} في مصر | الشغل`;
  const description =
    jobs.length > 0
      ? `${jobs.length} وظيفة ${specialization} متاحة حاليًا في كل محافظات مصر على موقع الشغل — تصفح وقدّم دلوقتي.`
      : `دوّر على وظايف ${specialization} في كل محافظات مصر على موقع الشغل.`;

  return {
    title,
    description,
    ...(jobs.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SpecializationJobsPage({
  params,
}: {
  params: Promise<{ specialty: string }>;
}) {
  const { specialty: specSlug } = await params;
  const specialization = findSpecialtyBySlug(decodeURIComponent(specSlug));
  if (!specialization) notFound();

  const [jobs, seoData] = await Promise.all([
    getActivePublicJobs({ specialization }),
    getActiveJobsSeoData(),
  ]);
  const popularCombos = seoData.combos.slice(0, POPULAR_COMBOS_COUNT);
  const governoratesForSpecialty = seoData.combos
    .filter((c) => c.specialization === specialization)
    .sort((a, b) => b.count - a.count);

  return (
    <div dir="rtl" style={{ width: "100%", maxWidth: 1120, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>وظائف {specialization} في مصر</h1>
      <p style={{ color: "#4A5568", marginBottom: 24 }}>
        {jobs.length > 0
          ? `${jobs.length} وظيفة ${specialization} متاحة حاليًا في كل محافظات مصر`
          : `مفيش وظائف ${specialization} نشطة دلوقتي`}
      </p>

      <div className="browse-layout">
        <div className="browse-main">
          {jobs.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
              مفيش وظائف {specialization} متاحة دلوقتي —{" "}
              <Link href="/jobs" style={{ color: "#14213D" }}>
                تصفح كل الوظائف
              </Link>
            </div>
          )}

          <PublicJobsList jobs={jobs} />

          {governoratesForSpecialty.length > 0 && (
            <div style={{ marginTop: 30, paddingTop: 20, borderTop: "1px solid #DED2B5" }}>
              <h2 style={{ fontSize: 16, marginBottom: 12 }}>وظائف {specialization} حسب المحافظة</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {governoratesForSpecialty.map((c) => (
                  <Link
                    key={c.governorate}
                    href={`/jobs/${slugify(c.governorate)}/${slugify(c.specialization)}`}
                    style={{
                      fontSize: 13,
                      background: "#F0EDE3",
                      padding: "6px 14px",
                      borderRadius: 999,
                      color: "#14213D",
                      textDecoration: "none",
                    }}
                  >
                    {c.governorate} ({c.count})
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <BrowseSidebar combos={popularCombos} />
      </div>
    </div>
  );
}
