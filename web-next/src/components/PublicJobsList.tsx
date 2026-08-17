"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchSavedJobIds, setJobSaved } from "@/lib/savedJobs";
import JobListItem from "@/app/jobs/JobListItem";
import RegisterModal from "./RegisterModal";

type Props = {
  jobs: any[];
  // list: عمودي (صفحات /jobs العامة)، grid: شبكة (قسم "أحدث الوظائف" في الرئيسية)
  layout?: "list" | "grid";
};

// Client wrapper بيدير حالة "الحفظ" لكل كروت الوظائف العامة (/jobs وصفحاته الفرعية،
// والرئيسية) — بنفس منطق fetchSavedJobIds/setJobSaved المستخدم في seeker/JobsTab.tsx
// بالظبط، بس بيجيب المجموعة مرة واحدة هنا على مستوى القايمة كلها بدل كل كارت لوحده.
export default function PublicJobsList({ jobs, layout = "list" }: Props) {
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [pendingSaveJobId, setPendingSaveJobId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setSavedJobs(new Set());
        return;
      }
      try {
        setSavedJobs(await fetchSavedJobIds(user.uid));
      } catch (err) {
        console.error("[PublicJobsList] فشل جلب الوظائف المحفوظة", err);
      }
    });
    return () => unsubscribe();
  }, []);

  async function handleToggleSave(jobId: string) {
    const user = auth.currentUser;
    // زائر مش مسجل دخول دوس "حفظ" — بدل ما نعمل حاجة جديدة، بنفتح نفس مودال التسجيل
    // المستخدم أصلًا لزرار "قدم الآن"، وبعد نجاح التسجيل بنكمّل الحفظ اللي كان بيحاول يعمله.
    if (!user) {
      setPendingSaveJobId(jobId);
      setShowRegisterModal(true);
      return;
    }
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
      console.error("[PublicJobsList] فشل حفظ/إلغاء حفظ الوظيفة", err);
    }
  }

  function handleRegisterSuccess() {
    setShowRegisterModal(false);
    if (pendingSaveJobId) {
      const jobId = pendingSaveJobId;
      setPendingSaveJobId(null);
      handleToggleSave(jobId);
    }
  }

  return (
    <>
      <div
        style={
          layout === "grid"
            ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }
            : { display: "flex", flexDirection: "column", gap: 14 }
        }
      >
        {jobs.map((job) => (
          <JobListItem
            key={job.id}
            job={job}
            saved={savedJobs.has(job.id)}
            onToggleSave={() => handleToggleSave(job.id)}
          />
        ))}
      </div>

      {showRegisterModal && (
        <RegisterModal
          onClose={() => { setShowRegisterModal(false); setPendingSaveJobId(null); }}
          onSuccess={handleRegisterSuccess}
        />
      )}
    </>
  );
}
