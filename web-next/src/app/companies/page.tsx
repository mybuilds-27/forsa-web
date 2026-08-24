import { getCompaniesWithoutLogos } from "@/lib/companiesQuery";
import CompaniesGrid from "./CompaniesGrid";

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
  // بدل getCompanies (بتجيب لوجو كل شركة دفعة واحدة)، هنا بنجيب القايمة الأساسية بس
  // (استعلام job_posts واحد، من غير أي قراءات إضافية) — قراءات اللوجو بتتأجل للدفعة
  // المعروضة فعليًا بس عن طريق CompaniesGrid (client component)، عشان الصفحة تفضل خفيفة
  // حتى لو عدد الشركات بقى مئات.
  const companies = await getCompaniesWithoutLogos();

  return (
    <div dir="rtl" style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>الشركات</h1>

      {companies.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
          مفيش شركات ظاهرة حاليًا — تابعنا قريبًا.
        </div>
      )}

      <CompaniesGrid companies={companies} />
    </div>
  );
}
