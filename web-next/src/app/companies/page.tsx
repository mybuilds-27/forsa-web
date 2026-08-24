import Link from "next/link";
import { getCompanies } from "@/lib/companiesQuery";

export const metadata = {
  title: "الشركات اللي بتوظف دلوقتي في مصر - موقع الشغل",
  description: "تصفح الشركات اللي بتدوّر على كوادر وبتوظف دلوقتي في مصر، وشوف كل وظايف الشغل المفتوحة عندها في مكان واحد على موقع الشغل.",
};

// الصفحة دي مالهاش أي dynamic segment، فـNext.js كان بيعملها static prerender وقت الـbuild
// ويسيبها في كاش ISR (لاحظنا x-nextjs-stale-time:300 وx-vercel-cache:HIT فعليًا على الموقع
// الحي) — يعني عدد الوظائف المعروض ممكن يفضل قديم لحد 5 دقايق (أو أكتر لحد أول زيارة بعدها)
// حتى لو حساب العدد نفسه لايف وصحيح 100%. force-dynamic بيضمن قراءة فريش من Firestore
// في كل طلب.
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await getCompanies();

  return (
    <div dir="rtl" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>الشركات</h1>
      <p style={{ color: "#4A5568", marginBottom: 24 }}>
        {companies.length} شركة بتوظف حاليًا على موقع الشغل
      </p>

      {companies.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
          مفيش شركات ظاهرة حاليًا — تابعنا قريبًا.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {companies.map((c) => (
          <Link
            key={c.employerId}
            href={`/companies/${c.employerId}`}
            style={{
              display: "block",
              border: "1px solid #14213D22",
              borderRadius: 10,
              padding: 16,
              textDecoration: "none",
              color: "inherit",
              textAlign: "center",
            }}
          >
            {c.logoURL ? (
              <img
                src={c.logoURL}
                alt={c.companyName}
                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, margin: "0 auto 10px" }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  background: "#F0EDE3",
                  margin: "0 auto 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                🏢
              </div>
            )}
            <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>{c.companyName}</h4>
            <div style={{ fontSize: 12.5, color: "#4A5568" }}>{c.count} وظيفة مفتوحة</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
