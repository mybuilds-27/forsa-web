import { slugify } from "@/lib/constants";
import { getActiveJobsSeoData, MIN_JOBS_FOR_INDEX } from "@/lib/publicJobsQuery";
import { articles } from "@/content/articles";

// ملف الـsitemap ده مالهوش أي dynamic segment، فـNext.js كان بيعمله static prerender
// وقت الـbuild ويسيبه في كاش (زي ما لقينا في companies/page.tsx وjobs/page.tsx) — يعني
// وظيفة جديدة منشورة معتضافش لملف الـsitemap لحد أول deploy جديد. force-dynamic بيضمن
// توليد الـsitemap فريش من Firestore في كل طلب.
export const dynamic = "force-dynamic";

export default async function sitemap() {
  const baseUrl = "https://www.elshoghl.com";

  const staticPages = [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/jobs`, lastModified: new Date() },
    { url: `${baseUrl}/about`, lastModified: new Date() },
    { url: `${baseUrl}/privacy`, lastModified: new Date() },
    { url: `${baseUrl}/terms`, lastModified: new Date() },
    { url: `${baseUrl}/contact`, lastModified: new Date() },
    { url: `${baseUrl}/articles`, lastModified: new Date() },
    { url: `${baseUrl}/companies`, lastModified: new Date() },
    { url: `${baseUrl}/faq`, lastModified: new Date() },
    { url: `${baseUrl}/why-free`, lastModified: new Date() },
  ];

  const articlePages = articles.map((a) => ({
    url: `${baseUrl}/articles/${a.slug}`,
    lastModified: new Date(a.date),
  }));

  let jobPages: { url: string; lastModified: Date }[] = [];
  let governoratePages: { url: string; lastModified: Date }[] = [];
  let specializationPages: { url: string; lastModified: Date }[] = [];
  let comboPages: { url: string; lastModified: Date }[] = [];
  try {
    const { jobIds, governorates, specializations, combos, governorateCounts, specializationCounts } =
      await getActiveJobsSeoData();

    jobPages = jobIds.map((id) => ({
      url: `${baseUrl}/jobs/${id}`,
      lastModified: new Date(),
    }));

    governoratePages = governorates
      .filter((g) => (governorateCounts[g] || 0) >= MIN_JOBS_FOR_INDEX)
      .map((g) => ({
        url: `${baseUrl}/jobs/${slugify(g)}`,
        lastModified: new Date(),
      }));

    specializationPages = specializations
      .filter((s) => (specializationCounts[s] || 0) >= MIN_JOBS_FOR_INDEX)
      .map((s) => ({
        url: `${baseUrl}/jobs/specialization/${slugify(s)}`,
        lastModified: new Date(),
      }));

    comboPages = combos
      .filter((c) => c.count >= MIN_JOBS_FOR_INDEX)
      .map((c) => ({
        url: `${baseUrl}/jobs/${slugify(c.governorate)}/${slugify(c.specialization)}`,
        lastModified: new Date(),
      }));
  } catch (err) {
    console.error("Sitemap job fetch failed", err);
  }

  return [...staticPages, ...articlePages, ...jobPages, ...governoratePages, ...specializationPages, ...comboPages];
}
