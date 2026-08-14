import { getActivePublicJobs, getActiveJobsSeoData } from "@/lib/publicJobsQuery";
import BrowseByCombos from "@/components/BrowseByCombos";
import JobListItem from "./JobListItem";

export const metadata = {
  title: "وظايف شغل في مصر - تصفح كل الوظائف المتاحة | الشغل",
  description: "دوّر على وظيفتك الجاية من هنا - وظايف شغل جديدة يوميًا في كل تخصصات ومحافظات مصر، على موقع الشغل المجاني بالكامل.",
};

// الصفحة دي مالهاش أي dynamic segment، فـNext.js كان بيعملها static prerender وقت الـbuild
// ويسيبها في كاش (زي ما لقينا في companies/page.tsx) — يعني وظيفة جديدة منشورة معتفضلش
// ظاهرة هنا لحد أول deploy جديد حتى لو باقي صفحات SEO (محافظة/تخصص) بتجيبها لايف صح.
// force-dynamic بيضمن قراءة فريش من Firestore في كل طلب.
export const dynamic = "force-dynamic";

const POPULAR_COMBOS_COUNT = 8;

export default async function JobsListPage() {
  const [jobs, seoData] = await Promise.all([getActivePublicJobs(), getActiveJobsSeoData()]);
  const popularCombos = seoData.combos.slice(0, POPULAR_COMBOS_COUNT);

  return (
    <div dir="rtl" style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>تصفح الوظائف</h1>
      <p style={{ color: "#4A5568", marginBottom: 24 }}>
        {jobs.length} وظيفة متاحة حاليًا على موقع الشغل
      </p>

      {jobs.length === 0 && (
        <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
          مفيش وظائف متاحة دلوقتي — تابعنا قريبًا.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {jobs.map((job) => (
          <JobListItem key={job.id} job={job} />
        ))}
      </div>

      {popularCombos.length > 0 && (
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #DED2B5" }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>تصفح حسب المحافظة والتخصص</h2>
          <BrowseByCombos combos={popularCombos} variant="inline" />
        </div>
      )}
    </div>
  );
}
