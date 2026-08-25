import Link from "next/link";
import { notFound } from "next/navigation";
import { findGovernorateBySlug, findAreaBySlug, slugify } from "@/lib/constants";
import { getActivePublicJobs, getActiveJobsSeoData } from "@/lib/publicJobsQuery";
import BrowseSidebar from "@/components/BrowseSidebar";
import PublicJobsList from "@/components/PublicJobsList";

// نفس مشكلة الـstatic prerender اللي لقيناها في companies/page.tsx وjobs/page.tsx —
// من غيرها صفحة محافظة+منطقة مع بعض ممكن تفضل بالبيانات القديمة لحد أول deploy جديد.
// force-dynamic بيضمن قراءة فريش من Firestore في كل طلب.
export const dynamic = "force-dynamic";

const POPULAR_COMBOS_COUNT = 40;

// "area" segment ثابت بالإنجليزي بين [id] (المحافظة) و[city] — عشان نتجنب أي تعارض مع
// مسار /jobs/[id]/[specialty] الموجود بالفعل للتخصصات (Next.js مش بيسمح بأكتر من dynamic
// segment واحد بنفس المستوى تحت نفس الأب من غير تمييز زي ده).

// [id] هنا هو slug المحافظة (زي القاهرة) — نفس تسمية segment الأب في jobs/[id]/page.tsx.
// ملحوظة: Next.js بيسيب قيمة الـsegment الأب (id) لسه مشفّرة (percent-encoded) لما توصل
// لـparams بتاع الصفحة المتداخلة دي (بعكس generateMetadata اللي بيوصلها فك تشفيرها)،
// فلازم decodeURIComponent هنا صراحةً قبل أي مقارنة، وإلا findGovernorateBySlug هيفشل دايمًا.
function resolveParams(govSlug: string, citySlug: string) {
  const governorate = findGovernorateBySlug(decodeURIComponent(govSlug));
  const city = governorate ? findAreaBySlug(governorate, decodeURIComponent(citySlug)) : null;
  return { governorate, city };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; city: string }> }) {
  const { id: govSlug, city: citySlug } = await params;
  const { governorate, city } = resolveParams(govSlug, citySlug);
  if (!governorate || !city) return { title: "صفحة غير موجودة - الشغل" };

  const jobs = await getActivePublicJobs({ governorate, city });
  const title = `وظايف شغل في ${city} - ${governorate} | الشغل`;
  const description =
    jobs.length > 0
      ? `${jobs.length} وظيفة شغل متاحة حاليًا في ${city}، ${governorate} — تصفح وقدّم دلوقتي.`
      : `دوّر على وظايف شغل في ${city}.`;

  return {
    title,
    description,
    ...(jobs.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function AreaJobsPage({ params }: { params: Promise<{ id: string; city: string }> }) {
  const { id: govSlug, city: citySlug } = await params;
  const { governorate, city } = resolveParams(govSlug, citySlug);
  if (!governorate || !city) notFound();

  const [jobs, seoData] = await Promise.all([
    getActivePublicJobs({ governorate, city }),
    getActiveJobsSeoData(),
  ]);
  const popularCombos = seoData.combos.slice(0, POPULAR_COMBOS_COUNT);

  return (
    <div dir="rtl" style={{ width: "100%", maxWidth: 1120, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>
        وظائف في {city} - {governorate}
      </h1>
      <p style={{ color: "#4A5568", marginBottom: 24 }}>
        {jobs.length > 0
          ? `${jobs.length} وظيفة متاحة حاليًا في ${city}`
          : `مفيش وظائف نشطة في ${city} دلوقتي`}
      </p>

      <div className="browse-layout">
        <div className="browse-main">
          {jobs.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
              مفيش وظائف متاحة في {city} دلوقتي —{" "}
              <Link href={`/jobs/${slugify(governorate)}`} style={{ color: "#14213D" }}>
                تصفح كل الوظائف في {governorate}
              </Link>
            </div>
          )}

          <PublicJobsList jobs={jobs} />
        </div>

        <BrowseSidebar combos={popularCombos} />
      </div>
    </div>
  );
}
