import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import JobListItem from "@/app/jobs/JobListItem";

const RESULT_COUNT = 4;

// كل الحقول اللي JobListItem.tsx بتستخدمها (العنوان، الشركة، الموقع، الوقت النسبي، الشارات،
// التخصص، المستوى، الراتب) — الاستعلام تحت أصلًا بيجيب المستند كامل ({ id, ...d.data() })،
// فمفيش حاجة ناقصة فعليًا في البيانات نفسها، بس الـtype القديم كان ناقص تعريف باقي الحقول دي.
type RelatedJob = {
  id: string;
  title: string;
  companyName?: string;
  showCompanyName?: boolean;
  governorate: string;
  city?: string;
  jobType: string;
  jobLevel?: string;
  specialization?: string;
  featured?: boolean;
  createdAt?: any;
  showSalary?: boolean;
  salaryNegotiable?: boolean;
  salaryFrom?: number;
  salaryTo?: number;
  expiresAt?: any;
};

async function fetchActiveJobs(constraints: any[], excludeId: string) {
  const snap = await getDocs(query(collection(db, "job_posts"), ...constraints));
  const now = Date.now();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as RelatedJob))
    .filter((p) => p.id !== excludeId)
    .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now);
}

async function getRelatedJobs(current: { id: string; specialization: string; governorate: string }) {
  const results: RelatedJob[] = [];
  const seen = new Set<string>([current.id]);

  function addJobs(jobs: RelatedJob[]) {
    for (const job of jobs) {
      if (results.length >= RESULT_COUNT) break;
      if (!seen.has(job.id)) {
        results.push(job);
        seen.add(job.id);
      }
    }
  }

  try {
    addJobs(
      await fetchActiveJobs(
        [
          where("isActive", "==", true),
          where("specialization", "==", current.specialization),
          orderBy("createdAt", "desc"),
          limit(RESULT_COUNT + 1),
        ],
        current.id
      )
    );
  } catch (err) {
    console.error("Related jobs (specialization) failed", err);
  }

  if (results.length < RESULT_COUNT) {
    try {
      addJobs(
        await fetchActiveJobs(
          [
            where("isActive", "==", true),
            where("governorate", "==", current.governorate),
            orderBy("createdAt", "desc"),
            limit(RESULT_COUNT + 1),
          ],
          current.id
        )
      );
    } catch (err) {
      console.error("Related jobs (governorate) failed", err);
    }
  }

  if (results.length < RESULT_COUNT) {
    try {
      addJobs(
        await fetchActiveJobs(
          [where("isActive", "==", true), orderBy("createdAt", "desc"), limit(RESULT_COUNT + 1)],
          current.id
        )
      );
    } catch (err) {
      console.error("Related jobs (latest) failed", err);
    }
  }

  return results.slice(0, RESULT_COUNT);
}

export default async function RelatedJobs({
  jobId,
  specialization,
  governorate,
}: {
  jobId: string;
  specialization: string;
  governorate: string;
}) {
  const jobs = await getRelatedJobs({ id: jobId, specialization, governorate });

  if (jobs.length === 0) return null;

  return (
    <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #DED2B5" }}>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>وظائف ذات صلة</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {jobs.map((job) => (
          <JobListItem key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
