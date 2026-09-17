"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_ORDER,
  APPLICATION_STATUS_STYLES,
  applicationStatusOf,
  type ApplicationStatus,
} from "@/lib/jobCardStyles";

type ApplicationStatusCounts = Record<ApplicationStatus, number>;

const NEUTRAL_CARD_STYLE = { background: "#F8F6F0", borderRadius: 8, padding: "12px 14px" };

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ flex: "1 1 140px", minWidth: 140, ...NEUTRAL_CARD_STYLE }}>
      <div style={{ fontSize: 11.5, color: "#4A5568", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: "#14213D" }}>{value}</div>
    </div>
  );
}

// إحصائيات نشاط الباحث في /seeker — 4 كروت بسيطة (مقياس أصغر من إحصائيات CompanyTab.tsx):
// إجمالي التقديمات، توزيع حالاتها (بنفس ألوان APPLICATION_STATUS_STYLES المستخدمة في
// ApplicantCard.tsx بالظبط)، عدد الوظائف المحفوظة، وعدد مرات ظهور بيانات تواصله لأصحاب العمل.
//
// الاستعلامات التلاتة (applications/saved_jobs/contact_reveals) equality بسيطة بحقل seekerId
// بس، بدون أي composite index. contact_reveals تحديدًا هي الكولكشن الصح لـ"صاحب العمل شاف
// بيانات تواصل الباحث" (SeekerDetailModal.tsx) — مش job_contact_views، اللي بتسجّل الاتجاه
// العكسي (الباحث بيشوف بيانات تواصل صاحب العمل، ContactReveal.tsx).
//
// كل مصدر معزول بخطأه الخاص (Promise.allSettled) عشان فشل مصدر واحد ميبيّضش باقي الكروت —
// نفس الباج اللي لقيناه وصلحناه قبل كده في CompanyTab.tsx (كان Promise.all بيبيّض الكل مع بعض).
export default function SeekerStats() {
  const [totalApplications, setTotalApplications] = useState<number | null>(null);
  const [statusCounts, setStatusCounts] = useState<ApplicationStatusCounts | null>(null);
  const [applicationsError, setApplicationsError] = useState(false);
  const [savedJobsCount, setSavedJobsCount] = useState<number | null>(null);
  const [savedJobsError, setSavedJobsError] = useState(false);
  const [contactRevealCount, setContactRevealCount] = useState<number | null>(null);
  const [contactRevealError, setContactRevealError] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    (async () => {
      const [applicationsResult, savedJobsResult, contactRevealResult] = await Promise.allSettled([
        getDocs(query(collection(db, "applications"), where("seekerId", "==", user.uid))),
        getCountFromServer(query(collection(db, "saved_jobs"), where("seekerId", "==", user.uid))),
        getCountFromServer(query(collection(db, "contact_reveals"), where("seekerId", "==", user.uid))),
      ]);

      if (applicationsResult.status === "fulfilled") {
        const counts = Object.fromEntries(APPLICATION_STATUS_ORDER.map((s) => [s, 0])) as ApplicationStatusCounts;
        applicationsResult.value.docs.forEach((d) => {
          counts[applicationStatusOf(d.data())] += 1;
        });
        setTotalApplications(applicationsResult.value.size);
        setStatusCounts(counts);
      } else {
        console.error("Failed to load applications stats", applicationsResult.reason);
        setApplicationsError(true);
      }

      if (savedJobsResult.status === "fulfilled") {
        setSavedJobsCount(savedJobsResult.value.data().count);
      } else {
        console.error("Failed to load saved jobs count", savedJobsResult.reason);
        setSavedJobsError(true);
      }

      if (contactRevealResult.status === "fulfilled") {
        setContactRevealCount(contactRevealResult.value.data().count);
      } else {
        console.error("Failed to load contact reveal count", contactRevealResult.reason);
        setContactRevealError(true);
      }
    })();
  }, []);

  return (
    <div style={{ border: "1px solid #14213D22", borderRadius: 10, padding: 20, marginBottom: 20 }}>
      <h3 style={{ marginBottom: 16, fontSize: 17 }}>📊 إحصائياتك</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <StatBox
          label="إجمالي التقديمات"
          value={applicationsError ? "تعذّر التحميل" : totalApplications ?? "..."}
        />

        <div style={{ flex: "2 1 280px", minWidth: 220, ...NEUTRAL_CARD_STYLE }}>
          <div style={{ fontSize: 11.5, color: "#4A5568", marginBottom: 8 }}>توزيع حالات التقديم</div>
          {applicationsError ? (
            <div style={{ fontSize: 13, color: "#B03A14" }}>تعذّر التحميل</div>
          ) : !statusCounts ? (
            <div style={{ fontSize: 13, color: "#4A5568" }}>...</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {APPLICATION_STATUS_ORDER.map((status) => (
                <span key={status} style={APPLICATION_STATUS_STYLES[status]}>
                  {APPLICATION_STATUS_LABELS[status]}: {statusCounts[status]}
                </span>
              ))}
            </div>
          )}
        </div>

        <StatBox
          label="الوظائف المحفوظة"
          value={savedJobsError ? "تعذّر التحميل" : savedJobsCount ?? "..."}
        />

        <StatBox
          label="ظهور بياناتك لأصحاب العمل"
          value={contactRevealError ? "تعذّر التحميل" : contactRevealCount ?? "..."}
        />
      </div>
    </div>
  );
}
