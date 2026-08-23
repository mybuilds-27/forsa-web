import Link from "next/link";
import { notFound } from "next/navigation";
import { findGovernorateBySlug, findSpecialtyBySlug, slugify } from "@/lib/constants";
import { getActivePublicJobs, getActiveJobsSeoData } from "@/lib/publicJobsQuery";
import BrowseSidebar from "@/components/BrowseSidebar";
import PublicJobsList from "@/components/PublicJobsList";

// نفس مشكلة الـstatic prerender اللي لقيناها في companies/page.tsx وjobs/page.tsx —
// من غيرها، صفحة محافظة+تخصص مع بعض ممكن تفضل بالبيانات القديمة لحد أول deploy جديد.
// force-dynamic بيضمن قراءة فريش من Firestore في كل طلب.
export const dynamic = "force-dynamic";

const POPULAR_COMBOS_COUNT = 8;

// [id] هنا هو slug المحافظة (زي القاهرة) — نفس تسمية segment الأب في jobs/[id]/page.tsx.
// ملحوظة: Next.js بيسيب قيمة الـsegment الأب (id) لسه مشفّرة (percent-encoded) لما توصل
// لـparams بتاع الصفحة المتداخلة دي (بعكس generateMetadata اللي بيوصلها فك تشفيرها)،
// فلازم decodeURIComponent هنا صراحةً قبل أي مقارنة، وإلا findGovernorateBySlug هيفشل دايمًا.
function resolveParams(govSlug: string, specSlug: string) {
  const governorate = findGovernorateBySlug(decodeURIComponent(govSlug));
  const specialization = findSpecialtyBySlug(decodeURIComponent(specSlug));
  return { governorate, specialization };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; specialty: string }> }) {
  const { id: govSlug, specialty: specSlug } = await params;
  const { governorate, specialization } = resolveParams(govSlug, specSlug);
  if (!governorate || !specialization) return { title: "صفحة غير موجودة - الشغل" };

  const jobs = await getActivePublicJobs({ governorate, specialization });
  const title = `وظايف شغل ${specialization} في ${governorate} | الشغل`;
  const description =
    jobs.length > 0
      ? `${jobs.length} وظيفة ${specialization} متاحة حاليًا في ${governorate} على موقع الشغل — تصفح وقدّم دلوقتي.`
      : `دوّر على وظايف ${specialization} في ${governorate} على موقع الشغل.`;

  return {
    title,
    description,
    ...(jobs.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function GovernorateSpecialtyJobsPage({
  params,
}: {
  params: Promise<{ id: string; specialty: string }>;
}) {
  const { id: govSlug, specialty: specSlug } = await params;
  const { governorate, specialization } = resolveParams(govSlug, specSlug);
  if (!governorate || !specialization) notFound();

  const [jobs, seoData] = await Promise.all([
    getActivePublicJobs({ governorate, specialization }),
    getActiveJobsSeoData(),
  ]);
  const popularCombos = seoData.combos.slice(0, POPULAR_COMBOS_COUNT);

  return (
    <div dir="rtl" style={{ width: "100%", maxWidth: 1120, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>
        وظائف {specialization} في {governorate}
      </h1>
      <p style={{ color: "#4A5568", marginBottom: 24 }}>
        {jobs.length > 0
          ? `${jobs.length} وظيفة ${specialization} متاحة حاليًا في ${governorate}`
          : `مفيش وظائف ${specialization} نشطة في ${governorate} دلوقتي`}
      </p>

      <div className="browse-layout">
        <div className="browse-main">
          {jobs.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
              مفيش وظائف {specialization} متاحة في {governorate} دلوقتي —{" "}
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
