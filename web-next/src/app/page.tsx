import Link from "next/link";
import BrowseByCombos from "@/components/BrowseByCombos";
import PublicJobsList from "@/components/PublicJobsList";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
import { getActivePublicJobs, getActiveJobsSeoData } from "@/lib/publicJobsQuery";
import { getCompanies } from "@/lib/companiesQuery";
import { GOVERNORATES, SPECIALIZATION_OPTIONS } from "@/lib/constants";
import { JOB_TYPE_LABELS, tagStyle } from "@/lib/jobCardStyles";

const COLORS = {
  ink: "#14213D",
  inkSoft: "#4A5568",
  paper: "#FAF6EC",
  stamp: "#B03A14",
  success: "#2F6F4E",
};

const LATEST_JOBS_COUNT = 6;
const EXAMPLE_COMBOS_COUNT = 40;
const HOME_COMPANIES_COUNT = 12;

// الصفحة دي بتجيب أحدث الوظائف والـcombos لايف من Firestore، فلازم force-dynamic زي /jobs
// عشان منقعش في نفس مشكلة الـstatic prerender اللي كانت بتسيب الصفحة فاضلة بالبيانات القديمة
// لحد أول deploy جديد.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [jobs, seoData, companies] = await Promise.all([getActivePublicJobs(), getActiveJobsSeoData(), getCompanies()]);
  // getActivePublicJobs() بترجع الوظايف المميزة الأول دايمًا (حق مدفوع فعلي، ومطلوب يفضل
  // كده في /jobs وباقي الصفحات) — بس قسم "أحدث الوظائف" هنا لازم يبقى بالمعنى الحرفي
  // للأحدث، فبنعمل نسخة منفصلة مرتبة بالتاريخ بس قبل الاقتطاع، من غير ما نلمس الأراي الأصلي.
  const latestJobs = [...jobs]
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    .slice(0, LATEST_JOBS_COUNT);
  const exampleCombos = seoData.combos.slice(0, EXAMPLE_COMBOS_COUNT);
  // getCompanies() بترجع الشركات مرتبة بعدد الوظائف النشطة (الأكتر الأول) بالفعل.
  const topCompanies = companies.slice(0, HOME_COMPANIES_COUNT);

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

        <div className="role-options-row" style={{ display: "flex", gap: 16, maxWidth: 820, margin: "0 auto 48px" }}>
          <div
            style={{
              flex: "1 1 0",
              minWidth: 0,
              border: `2px solid ${COLORS.success}`,
              borderRadius: 14,
              padding: 24,
              background: "#fff",
            }}
          >
            <h3 style={{ fontSize: 18, color: COLORS.ink, marginBottom: 14 }}>دوّر على شغلك دلوقتي</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <li style={{ fontSize: 14, color: COLORS.inkSoft }}>✅ تصفح آلاف الوظائف مجانًا</li>
              <li style={{ fontSize: 14, color: COLORS.inkSoft }}>✅ قدّم بضغطة واحدة</li>
              <li style={{ fontSize: 14, color: COLORS.inkSoft }}>✅ سيرة ذاتية تلقائية من بروفايلك</li>
            </ul>
            <Link
              href="/register?role=job_seeker"
              style={{
                display: "block",
                textAlign: "center",
                padding: "13px 20px",
                borderRadius: 8,
                background: COLORS.success,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              سجّل كباحث عن عمل ←
            </Link>
          </div>

          <div
            style={{
              flex: "1 1 0",
              minWidth: 0,
              border: `2px solid ${COLORS.ink}`,
              borderRadius: 14,
              padding: 24,
              background: "#fff",
            }}
          >
            <h3 style={{ fontSize: 18, color: COLORS.ink, marginBottom: 14 }}>وظّف الكوادر اللي محتاجها</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <li style={{ fontSize: 14, color: COLORS.inkSoft }}>✅ 5 إعلانات وظايف مجانًا كل شهر</li>
              <li style={{ fontSize: 14, color: COLORS.inkSoft }}>✅ دعوة كوادر مباشرة</li>
              <li style={{ fontSize: 14, color: COLORS.inkSoft }}>✅ من غير أي مستندات أو رسوم</li>
            </ul>
            <Link
              href="/register?role=employer"
              style={{
                display: "block",
                textAlign: "center",
                padding: "13px 20px",
                borderRadius: 8,
                background: COLORS.ink,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              سجّل كصاحب عمل ←
            </Link>
          </div>
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

        {topCompanies.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 19, color: COLORS.ink, marginBottom: 4 }}>شركات بتوظف عندنا دلوقتي</h2>
            <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 16 }}>
              أحدث الشركات اللي بتوظف عندنا
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", alignItems: "center" }}>
              {topCompanies.map((c) => (
                <Link
                  key={c.employerId}
                  href={`/companies/${c.employerId}`}
                  title={c.companyName}
                  style={{ display: "flex", textDecoration: "none" }}
                >
                  {c.logoURL ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 92 }}>
                      <img
                        src={c.logoURL}
                        alt={c.companyName}
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: "cover",
                          borderRadius: "50%",
                          border: `1px solid ${COLORS.ink}22`,
                          background: "#fff",
                        }}
                      />
                      <span style={{ fontSize: 11.5, color: COLORS.inkSoft, textAlign: "center" }}>{c.companyName}</span>
                    </div>
                  ) : (
                    <span style={{ ...tagStyle, padding: "10px 18px", fontSize: 14, color: COLORS.ink }}>
                      {c.companyName}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link
                href="/companies"
                style={{
                  display: "inline-block",
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: `1.5px solid ${COLORS.ink}`,
                  color: COLORS.ink,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                تصفح كل الشركات ←
              </Link>
            </div>
          </div>
        )}

        {latestJobs.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 19, color: COLORS.ink, marginBottom: 16 }}>أحدث الوظائف</h2>
            <PublicJobsList jobs={latestJobs} layout="grid" />
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Link
                href="/jobs"
                style={{
                  display: "inline-block",
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: `1.5px solid ${COLORS.ink}`,
                  color: COLORS.ink,
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                تصفح كل الوظائف ←
              </Link>
            </div>
          </div>
        )}

        {exampleCombos.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <h3 style={{ fontSize: 15, color: COLORS.ink, marginBottom: 4 }}>
              تصفح حسب المحافظة والتخصص:
            </h3>
            <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 12 }}>
              كل الوظائف المتاحة حاليًا مقسّمة حسب المحافظة والتخصص.
            </p>
            <BrowseByCombos combos={exampleCombos} variant="inline" />
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 14 }}>
            تصفح حسب المحافظة
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GOVERNORATES.map((g) => (
              <Link
                key={g}
                href={`/jobs?governorate=${encodeURIComponent(g)}`}
                style={{ ...tagStyle, textDecoration: "none", color: COLORS.ink, padding: "7px 14px", fontSize: 13 }}
              >
                {g}
              </Link>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 14 }}>
            تصفح حسب التخصص
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SPECIALIZATION_OPTIONS.map((s) => (
              <Link
                key={s}
                href={`/jobs?specialization=${encodeURIComponent(s)}`}
                style={{ ...tagStyle, textDecoration: "none", color: COLORS.ink, padding: "7px 14px", fontSize: 13 }}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>

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
      <WhatsAppFloatingButton />
    </div>
  );
}
