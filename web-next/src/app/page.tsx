import Link from "next/link";
import BrowseByCombos from "@/components/BrowseByCombos";
import JobListItem from "./jobs/JobListItem";
import { getActivePublicJobs, getActiveJobsSeoData } from "@/lib/publicJobsQuery";
import { GOVERNORATES } from "@/lib/constants";
import { JOB_TYPE_LABELS } from "@/lib/jobCardStyles";

const COLORS = {
  ink: "#14213D",
  inkSoft: "#4A5568",
  paper: "#FAF6EC",
  stamp: "#B03A14",
  success: "#2F6F4E",
};

const LATEST_JOBS_COUNT = 4;
const EXAMPLE_COMBOS_COUNT = 6;

// الصفحة دي بتجيب أحدث الوظائف والـcombos لايف من Firestore، فلازم force-dynamic زي /jobs
// عشان منقعش في نفس مشكلة الـstatic prerender اللي كانت بتسيب الصفحة فاضلة بالبيانات القديمة
// لحد أول deploy جديد.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [jobs, seoData] = await Promise.all([getActivePublicJobs(), getActiveJobsSeoData()]);
  const latestJobs = jobs.slice(0, LATEST_JOBS_COUNT);
  const exampleCombos = seoData.combos.slice(0, EXAMPLE_COMBOS_COUNT);

  return (
    <div dir="rtl">
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 60px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 30, color: COLORS.ink, marginBottom: 12, fontFamily: "var(--font-cairo)" }}>
            الشغل - موقع توظيف مصري
          </h1>
          <span
            style={{
              display: "inline-block",
              background: "rgba(47,111,78,0.12)",
              color: COLORS.success,
              fontWeight: 700,
              fontSize: 13,
              padding: "7px 16px",
              borderRadius: 999,
            }}
          >
            🎉 مجاني بالكامل — لباحثين الشغل وأصحاب الأعمال
          </span>
        </div>

        <form
          action="/jobs"
          method="GET"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            maxWidth: 720,
            margin: "0 auto 48px",
            padding: 16,
            background: "#fff",
            border: "1px solid #14213D22",
            borderRadius: 14,
          }}
        >
          <input
            type="text"
            name="q"
            placeholder="دوّر عن وظيفة (مثال: محاسب، مبيعات...)"
            style={{ flex: "2 1 220px", padding: 10, border: "1px solid #ccc", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }}
          />
          <select
            name="governorate"
            defaultValue=""
            style={{ flex: "1 1 150px", padding: 10, border: "1px solid #ccc", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }}
          >
            <option value="">كل المحافظات</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            name="jobType"
            defaultValue=""
            style={{ flex: "1 1 150px", padding: 10, border: "1px solid #ccc", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }}
          >
            <option value="">كل أنواع الدوام</option>
            {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="submit"
            style={{
              flex: "1 1 100px",
              padding: 10,
              border: "none",
              borderRadius: 8,
              background: COLORS.ink,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🔍 بحث
          </button>
        </form>

        {latestJobs.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 19, color: COLORS.ink, marginBottom: 16 }}>أحدث الوظائف</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              {latestJobs.map((job) => (
                <JobListItem key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}

        {exampleCombos.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, color: COLORS.ink, marginBottom: 4 }}>
              تصفح حسب المحافظة والتخصص (أمثلة):
            </h3>
            <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 12 }}>
              دي أمثلة بس من أشهر التخصصات المتاحة — مش كل الاختيارات.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <BrowseByCombos combos={exampleCombos} variant="inline" />
              <Link href="/jobs" style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink, textDecoration: "none" }}>
                أو تصفح كل الوظائف ←
              </Link>
            </div>
          </div>
        )}

        <div
          style={{
            border: `1px solid ${COLORS.ink}22`,
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h3 style={{ fontSize: 18, color: COLORS.ink, marginBottom: 8 }}>صاحب عمل؟</h3>
          <p style={{ fontSize: 14, color: COLORS.inkSoft, marginBottom: 6, lineHeight: 1.7 }}>
            انشر لحد 5 وظايف شهريًا مجانًا، وابحث عن كوادر مباشرة — من غير أي مصاريف.
          </p>
          <p style={{ fontSize: 12, color: COLORS.inkSoft, opacity: 0.85, marginBottom: 18 }}>
            بدون بطاقة ائتمان • بدون التزام • انشر في أقل من دقيقتين
          </p>
          <Link
            href="/register?role=employer"
            style={{
              display: "inline-block",
              padding: "12px 26px",
              borderRadius: 8,
              border: "none",
              background: COLORS.ink,
              color: "#fff",
              fontSize: 14.5,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ابدأ دلوقتي
          </Link>
        </div>
      </main>
    </div>
  );
}
