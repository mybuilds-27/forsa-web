"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GOVERNORATES, SPECIALIZATION_OPTIONS, EXPERIENCE_LEVELS } from "@/lib/constants";
import { buildSeekerSnapshot } from "@/lib/seekerSnapshot";
import { fetchSavedJobIds, setJobSaved } from "@/lib/savedJobs";
import { getActiveJobsSeoData, JobCombo } from "@/lib/publicJobsQuery";
import { friendlyErrorMessage } from "@/lib/errorMessages";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import { shouldShowProfileNudge } from "@/lib/profileNudge";
import { shouldShowPushNudge } from "@/lib/pushNudge";
import JobCard, { JobPost, salaryTeaser } from "./JobCard";
import { tagStyle, ApplicationStatus, applicationStatusOf } from "@/lib/jobCardStyles";
import ScreeningQuestionsModal from "@/components/ScreeningQuestionsModal";
import SpecializationMismatchModal, { MismatchItem } from "@/components/SpecializationMismatchModal";
import BrowseSidebar from "@/components/BrowseSidebar";
import ProfileCompletionBar from "@/components/ProfileCompletionBar";
import JobListItem from "@/app/jobs/JobListItem";
import PostApplyProfileNudge from "@/components/PostApplyProfileNudge";
import EnablePushNudge from "@/components/EnablePushNudge";

const PAGE_SIZE = 12;
const POPULAR_COMBOS_COUNT = 40;
const RECOMMENDED_COUNT = 6;

// كل الحقول اللي JobListItem.tsx محتاجها لعرض الكارت — نفس فكرة RelatedJobs.tsx بالظبط.
type RecommendedJob = {
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

async function fetchActiveJobsFor(constraints: any[]) {
  const snap = await getDocs(query(collection(db, "job_posts"), ...constraints));
  const now = Date.now();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as RecommendedJob))
    .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now);
}

// أولوية: (1) نفس التخصص بالظبط، (2) لو مفيش كفاية، وظائف فيها كلمات مفتاحية بتتقاطع مع
// كلمات الباحث — نفس منطق RelatedJobs.tsx (jobs/[id]/RelatedJobs.tsx) بس من غير الطبقة
// الثالثة "أحدث الوظائف" اللي هو بيستخدمها كـfallback أخير، لأن المفروض هنا القسم يختفي
// تمامًا لو مفيش تطابق حقيقي (مش نعرض وظائف عشوائية تحت مسمى "موصى بيها").
async function getRecommendedJobs(specialization: string, keywords: string[]): Promise<RecommendedJob[]> {
  const results: RecommendedJob[] = [];
  const seen = new Set<string>();

  function addJobs(jobs: RecommendedJob[]) {
    for (const job of jobs) {
      if (results.length >= RECOMMENDED_COUNT) break;
      if (!seen.has(job.id)) {
        results.push(job);
        seen.add(job.id);
      }
    }
  }

  if (specialization) {
    try {
      addJobs(
        await fetchActiveJobsFor([
          where("isActive", "==", true),
          where("specialization", "==", specialization),
          orderBy("createdAt", "desc"),
          limit(RECOMMENDED_COUNT),
        ])
      );
    } catch (err) {
      console.error("Recommended jobs (specialization) failed", err);
    }
  }

  if (results.length < RECOMMENDED_COUNT && keywords.length > 0) {
    try {
      addJobs(
        await fetchActiveJobsFor([
          where("isActive", "==", true),
          where("keywords", "array-contains-any", keywords.slice(0, 10)),
          orderBy("createdAt", "desc"),
          limit(RECOMMENDED_COUNT),
        ])
      );
    } catch (err) {
      console.error("Recommended jobs (keywords) failed", err);
    }
  }

  return results.slice(0, RECOMMENDED_COUNT);
}

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  remote: "عن بعد",
  freelance: "فريلانس",
};

type Props = {
  completionPercent?: number;
  specialization?: string;
  keywords?: string[];
};

export default function JobsTab({ completionPercent, specialization, keywords }: Props) {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<RecommendedJob[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [specSelect, setSpecSelect] = useState("");
  const [specOther, setSpecOther] = useState("");
  const [govFilter, setGovFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [jobLevelFilter, setJobLevelFilter] = useState("");

  const [popularCombos, setPopularCombos] = useState<JobCombo[]>([]);

  const [myApplications, setMyApplications] = useState<Map<string, ApplicationStatus>>(new Map());
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [nudgePercent, setNudgePercent] = useState<number | null>(null);
  const [showPushNudge, setShowPushNudge] = useState(false);
  // بيتحط بس لو فيه اختلاف واحد أو أكتر (تخصص و/أو مستوى) بين بروفايل الباحث ووظيفة
  // selectedJob — شوف handleApplyClick.
  const [applyMismatches, setApplyMismatches] = useState<MismatchItem[] | null>(null);
  const [checkingMatch, setCheckingMatch] = useState(false);

  function closeDetailsModal() {
    setSelectedJob(null);
    setShowDetailsModal(false);
  }

  async function loadMyApplications() {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDocs(
      query(collection(db, "applications"), where("seekerId", "==", user.uid))
    );
    setMyApplications(new Map(snap.docs.map((d) => [d.data().jobPostId, applicationStatusOf(d.data())])));
  }

  async function loadMySavedJobs() {
    const user = auth.currentUser;
    if (!user) return;
    setSavedJobs(await fetchSavedJobIds(user.uid));
  }

  async function handleToggleSave(jobId: string) {
    const user = auth.currentUser;
    if (!user) return;
    const isSaved = savedJobs.has(jobId);
    try {
      await setJobSaved(jobId, user.uid, !isSaved);
      setSavedJobs((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(jobId);
        else next.add(jobId);
        return next;
      });
    } catch (err) {
      console.error("Toggle save failed", err);
    }
  }

  async function fetchJobs(reset: boolean) {
    try {
      const constraints: any[] = [
        where("isActive", "==", true),
        orderBy("featured", "desc"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE),
      ];
      if (specSelect && specSelect !== "other") constraints.splice(1, 0, where("specialization", "==", specSelect));
      if (govFilter) constraints.splice(1, 0, where("governorate", "==", govFilter));
      if (jobTypeFilter) constraints.splice(1, 0, where("jobType", "==", jobTypeFilter));
      if (jobLevelFilter) constraints.splice(1, 0, where("jobLevel", "==", jobLevelFilter));
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));

      const q = query(collection(db, "job_posts"), ...constraints);
      const snap = await getDocs(q);

      const now = Date.now();
      const newJobs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as JobPost))
        .filter((p: any) => !p.expiresAt || p.expiresAt.toMillis() > now);

      setJobs((prev) => (reset ? newJobs : [...prev, ...newJobs]));
      setLastDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setError("");
    } catch (err) {
      console.error("Job fetch failed", err);
      setError(friendlyErrorMessage(err));
    }
  }

  async function initialLoad() {
    setLoading(true);
    await Promise.all([loadMyApplications(), loadMySavedJobs()]);
    await fetchJobs(true);
    setLoading(false);
  }

  useEffect(() => {
    initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specSelect, govFilter, jobTypeFilter, jobLevelFilter]);

  useEffect(() => {
    getActiveJobsSeoData()
      .then((data) => setPopularCombos(data.combos.slice(0, POPULAR_COMBOS_COUNT)))
      .catch((err) => console.error("Popular combos fetch failed", err));
  }, []);

  useEffect(() => {
    // getRecommendedJobs بترجع [] لوحدها لو مفيش specialization ولا keywords (مفيش داعي
    // لفحص مبكر هنا) — طالما مفيش حاجة نطابق عليها، بترجع نتيجة فاضية من غير أي استعلام.
    getRecommendedJobs(specialization || "", Array.isArray(keywords) ? keywords : [])
      .then(setRecommendedJobs)
      .catch((err) => console.error("Recommended jobs fetch failed", err));
  }, [specialization, keywords]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await fetchJobs(false);
    setLoadingMore(false);
  }

  const filteredJobs = jobs.filter((p) => {
    if (specSelect !== "other" || !specOther.trim()) return true;
    const haystack = `${p.title} ${p.specialization} ${p.description || ""}`.toLowerCase();
    return haystack.includes(specOther.trim().toLowerCase());
  });

  async function handleApply(job: JobPost, answers: Record<string, string> = {}) {
    const user = auth.currentUser;
    if (!user) return;
    setApplying(true);
    try {
      const seekerDoc = await getDoc(doc(db, "job_seekers", user.uid));
      const s = seekerDoc.exists() ? seekerDoc.data() : {};
      const appId = `${job.id}_${user.uid}`;
      await setDoc(doc(db, "applications", appId), {
        jobPostId: job.id,
        employerId: job.employerId,
        seekerId: user.uid,
        seekerSnapshot: buildSeekerSnapshot(s),
        screeningAnswers: answers,
        appliedAt: serverTimestamp(),
      });
      setMyApplications((prev) => new Map(prev).set(job.id, "submitted"));
      setShowQuestionsModal(false);

      // تنبيه اكتمال البروفايل — تحفيزي بس، بعد نجاح التقديم فعليًا. try/catch منفصل
      // ومعزول تمامًا عن نجاح التقديم نفسه (اللي خلص فوق قبل السطر ده)؛ لو حصل أي خطأ
      // غير متوقع هنا بنتجاهله بصمت من غير ما يبان للمستخدم أو يأثر على أي حاجة تانية.
      // أولوية لتنبيه اكتمال البروفايل لو الاتنين هيظهروا في نفس اللحظة — مودال التنبيهات
      // ببساطة بيتفوّت النهاردة (مش بيتسجل "اتشاف")، فهيتفحص تاني عادي في أول تقديم جاي.
      try {
        const percent = calculateProfileCompletion(s);
        if (shouldShowProfileNudge(percent)) {
          setNudgePercent(percent);
        } else if (shouldShowPushNudge()) {
          setShowPushNudge(true);
        }
      } catch {
        // متجاهلينها عمدًا — التقديم نجح بالفعل، ده مجرد تحفيز إضافي مش أساسي
      }
    } catch (err) {
      console.error("Apply failed", err);
    }
    setApplying(false);
  }

  function proceedWithApply(job: JobPost) {
    if (job.screeningQuestions && job.screeningQuestions.length > 0) {
      setShowQuestionsModal(true);
    } else {
      handleApply(job);
    }
  }

  // فحص تطابق التخصص والمستوى قبل التقديم — نفس منطق ApplyButton.tsx بالظبط، بقراءة واحدة
  // لـjob_seekers/{uid} هنا (handleApply بتقراها تاني لبناء seekerSnapshot)، عمدًا عشان
  // مانلمسش handleApply نفسها اللي بتكتب فعليًا على Firestore. لو فيه أكتر من اختلاف،
  // بيتعرضوا كلهم مع بعض في مودال واحد بدل تنبيهين متتاليين.
  async function handleApplyClick(job: JobPost) {
    setSelectedJob(job);
    const user = auth.currentUser;
    if (!user) return;
    if (job.specialization || job.jobLevel) {
      setCheckingMatch(true);
      try {
        const seekerDoc = await getDoc(doc(db, "job_seekers", user.uid));
        const seekerData = seekerDoc.exists() ? seekerDoc.data() : {};
        const mismatches: MismatchItem[] = [];

        if (job.specialization && seekerData.specialization && seekerData.specialization !== job.specialization) {
          mismatches.push({
            label: "التخصص",
            message: `الوظيفة دي في تخصص ${job.specialization}، وبروفايلك موضّح إن تخصصك ${seekerData.specialization}.`,
          });
        }

        if (job.jobLevel && seekerData.jobLevel && seekerData.jobLevel !== job.jobLevel) {
          mismatches.push({
            label: "المستوى",
            message: `الوظيفة دي بتستهدف مستوى ${EXPERIENCE_LEVELS[job.jobLevel] || job.jobLevel}، وانت بتدوّر على مستوى ${EXPERIENCE_LEVELS[seekerData.jobLevel] || seekerData.jobLevel}.`,
          });
        }

        if (mismatches.length > 0) {
          setCheckingMatch(false);
          setApplyMismatches(mismatches);
          return;
        }
      } catch (err) {
        console.error("[JobsTab] فشل فحص تطابق التخصص/المستوى", err);
        // فشل الفحص نفسه ميوقفش التقديم — نكمل عادي زي لو الباحث معندوش بيانات محفوظة خالص
      }
      setCheckingMatch(false);
    }
    proceedWithApply(job);
  }

  async function handleCancel(job: JobPost) {
    const user = auth.currentUser;
    if (!user) return;
    if (!confirm("متأكد إنك عايز تلغي التقديم على الوظيفة دي؟")) return;
    setApplying(true);
    try {
      const appId = `${job.id}_${user.uid}`;
      await deleteDoc(doc(db, "applications", appId));
      setMyApplications((prev) => {
        const next = new Map(prev);
        next.delete(job.id);
        return next;
      });
    } catch (err) {
      console.error("Cancel failed", err);
    }
    setApplying(false);
  }

  return (
    <div dir="rtl">
      <div className="browse-layout">
        <div className="browse-main">
      {typeof completionPercent === "number" && completionPercent < 100 && (
        <ProfileCompletionBar percent={completionPercent} />
      )}

      {recommendedJobs.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>🎯 وظائف موصى بيها ليك</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {recommendedJobs.map((job) => (
              <JobListItem key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* الفلاتر */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>التخصص</label>
          <select
            value={specSelect}
            onChange={(e) => setSpecSelect(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="">كل التخصصات</option>
            {SPECIALIZATION_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="other">بحث حر (كلمة مفتاحية)</option>
          </select>
          {specSelect === "other" && (
            <input
              type="text"
              value={specOther}
              onChange={(e) => setSpecOther(e.target.value)}
              placeholder="مثال: محاسب أول"
              style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, marginTop: 8 }}
            />
          )}
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>المحافظة</label>
          <select
            value={govFilter}
            onChange={(e) => setGovFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="">الكل</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>نوع الدوام</label>
          <select
            value={jobTypeFilter}
            onChange={(e) => setJobTypeFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="">الكل</option>
            <option value="full_time">دوام كامل</option>
            <option value="part_time">دوام جزئي</option>
            <option value="remote">عن بعد</option>
            <option value="freelance">فريلانس</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>مستوى الوظيفة</label>
          <select
            value={jobLevelFilter}
            onChange={(e) => setJobLevelFilter(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
          >
            <option value="">الكل</option>
            {Object.entries(EXPERIENCE_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p>جاري التحميل...</p>}
      {error && <div style={{ color: "#B03A14", padding: 12 }}>{error}</div>}

      {!loading && !error && (
        <>
          {filteredJobs.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "#4A5568" }}>
              مفيش وظائف مطابقة دلوقتي — جرب توسّع الفلاتر
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredJobs.map((p) => (
              <JobCard
                key={p.id}
                job={p}
                applicationStatus={myApplications.get(p.id)}
                saved={savedJobs.has(p.id)}
                onToggleSave={() => handleToggleSave(p.id)}
                onClick={() => { setSelectedJob(p); setShowDetailsModal(true); }}
                onApply={() => handleApplyClick(p)}
                applying={applying || checkingMatch}
              />
            ))}
          </div>

          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ padding: "8px 20px", border: "1px solid #14213D", borderRadius: 6, background: "transparent", cursor: "pointer" }}
              >
                {loadingMore ? "جاري التحميل..." : "تحميل المزيد"}
              </button>
            </div>
          )}
        </>
      )}
        </div>

        <BrowseSidebar combos={popularCombos} />
      </div>

      {/* مودال تفاصيل الوظيفة */}
      {selectedJob && showDetailsModal && (
        <div
          onClick={closeDetailsModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,33,61,0.55)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              onClick={closeDetailsModal}
              style={{
                position: "absolute",
                top: 14,
                left: 14,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1.5px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
            <h2 style={{ marginBottom: 4 }}>{selectedJob.title}</h2>
            <div style={{ color: "#4A5568", marginBottom: 10 }}>
              {selectedJob.showCompanyName && selectedJob.companyName ? selectedJob.companyName : "شركة غير معلنة"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={tagStyle}>{selectedJob.specialization}</span>
              <span style={tagStyle}>{selectedJob.city} - {selectedJob.governorate}</span>
              <span style={tagStyle}>{JOB_TYPE_LABELS[selectedJob.jobType] || selectedJob.jobType}</span>
              {selectedJob.jobLevel && <span style={tagStyle}>{EXPERIENCE_LEVELS[selectedJob.jobLevel] || selectedJob.jobLevel}</span>}
            </div>
            <p style={{ lineHeight: 1.7 }}>{selectedJob.description}</p>
            <div style={{ marginTop: 10, fontWeight: 600 }}>الراتب: {salaryTeaser(selectedJob)}</div>
            {selectedJob.requirements && (
              <p style={{ marginTop: 10 }}>
                <strong>الشروط:</strong> {selectedJob.requirements}
              </p>
            )}
            <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {myApplications.has(selectedJob.id) ? (
                <button
                  onClick={() => handleCancel(selectedJob)}
                  disabled={applying}
                  style={{ padding: "10px 20px", border: "1px solid #B03A14", color: "#B03A14", background: "transparent", borderRadius: 6, cursor: "pointer" }}
                >
                  ✕ إلغاء التقديم
                </button>
              ) : (
                <button
                  onClick={() => handleApplyClick(selectedJob)}
                  disabled={applying || checkingMatch}
                  style={{ padding: "10px 20px", background: "#14213D", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                >
                  📩 قدم الآن
                </button>
              )}
              <button
                onClick={() => handleToggleSave(selectedJob.id)}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #14213D",
                  background: savedJobs.has(selectedJob.id) ? "#14213D" : "transparent",
                  color: savedJobs.has(selectedJob.id) ? "#fff" : "#14213D",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {savedJobs.has(selectedJob.id) ? "★ محفوظة" : "☆ حفظ الوظيفة"}
              </button>
              <Link
                href={`/jobs/${selectedJob.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 20px",
                  border: "1px solid #14213D",
                  background: "transparent",
                  color: "#14213D",
                  borderRadius: 6,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                🔗 فتح الصفحة الكاملة
              </Link>
            </div>
          </div>
        </div>
      )}

      {showQuestionsModal && selectedJob && (
        <ScreeningQuestionsModal
          questions={selectedJob.screeningQuestions || []}
          submitting={applying}
          onCancel={() => setShowQuestionsModal(false)}
          onSubmit={(answers) => handleApply(selectedJob, answers)}
        />
      )}

      {applyMismatches && selectedJob && (
        <SpecializationMismatchModal
          items={applyMismatches}
          submitting={applying}
          onCancel={() => setApplyMismatches(null)}
          onConfirm={() => {
            setApplyMismatches(null);
            proceedWithApply(selectedJob);
          }}
        />
      )}

      {nudgePercent !== null && (
        <PostApplyProfileNudge percent={nudgePercent} onClose={() => setNudgePercent(null)} />
      )}

      {showPushNudge && auth.currentUser && (
        <EnablePushNudge role="job_seeker" uid={auth.currentUser.uid} onClose={() => setShowPushNudge(false)} />
      )}
    </div>
  );
}