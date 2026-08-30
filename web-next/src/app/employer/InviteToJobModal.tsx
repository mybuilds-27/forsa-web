"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// نفس القايمة المستخدمة في باقي الملفات (Navbar.tsx، page.tsx، admin/page.tsx) لتحديد حساب الأدمن
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

type Props = {
  seekerId: string;
  seekerName: string;
  employerPlan: string;
  // لو صاحب العمل جاي لتوّه من نشر وظيفة جديدة (شوف TalentSearchTab.tsx)، بنحدد الوظيفة
  // دي افتراضيًا في القايمة تحت بدل ما يحتاج يدوّر عليها يدوي من بين إعلاناته.
  defaultJobId?: string;
  onClose: () => void;
};

export default function InviteToJobModal({ seekerId, seekerName, employerPlan, defaultJobId, onClose }: Props) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      const user = auth.currentUser;
      if (!user) return;
      // الأدمن مالوش وظائف بتاعته هو، فبدل الاقتصار على employerId == uid بتاعه (هيرجع فاضي
      // دايمًا)، بيشوف كل الوظائف النشطة على الموقع عشان يقدر يدعو باحثين لأي وظيفة.
      const isAdmin = ADMIN_EMAILS.includes(user.email || "");
      const snap = await getDocs(
        isAdmin
          ? query(collection(db, "job_posts"), where("isActive", "==", true))
          : query(collection(db, "job_posts"), where("employerId", "==", user.uid), where("isActive", "==", true))
      );
      const loadedJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      setJobs(loadedJobs);
      // لو الوظيفة الافتراضية موجودة فعليًا بين الوظائف المحمّلة (نشطة ومملوكة له)، بنحددها
      // على طول بدل ما يسيب القايمة فاضية.
      if (defaultJobId && loadedJobs.some((j) => j.id === defaultJobId)) {
        setSelectedJobId(defaultJobId);
      }
      setLoading(false);
    }
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendInvite() {
    const user = auth.currentUser;
    if (!user || !selectedJobId) return;
    setError("");
    setSending(true);
    try {
      const isAdmin = ADMIN_EMAILS.includes(user.email || "");

      // حد الدعوات الشهري بيتحسب على صاحب الوظيفة الحقيقي — مش منطقي نطبقه على الأدمن نفسه
      // لأنه بيبعت الدعوة نيابة عن صاحب العمل، مش بيستهلك من رصيده الشخصي.
      if (!isAdmin) {
        // حد الدعوات الشهري — نفس نمط حد نشر الوظائف الشهري في PostJobTab.tsx
        const monthlyLimit = employerPlan === "premium" ? 30 : 5;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const invitesSnap = await getDocs(query(collection(db, "invitations"), where("employerId", "==", user.uid)));
        const invitesThisMonth = invitesSnap.docs.filter((d) => {
          const t = d.data().createdAt;
          return t && t.toMillis() >= startOfMonth.getTime();
        });
        if (invitesThisMonth.length >= monthlyLimit) {
          setError(
            employerPlan === "premium"
              ? `وصلت للحد الأقصى (${monthlyLimit} دعوة) للباقة المدفوعة الشهر ده.`
              : `الباقة المجانية بتسمح بحد أقصى ${monthlyLimit} دعوات شهريًا، وإنت وصلت للحد ده الشهر ده.`
          );
          setSending(false);
          return;
        }
      }

      const job = jobs.find((j) => j.id === selectedJobId);
      if (!job) {
        setError("اختار وظيفة الأول.");
        setSending(false);
        return;
      }

      // employerId بتاع صاحب الوظيفة الحقيقي — مش بالضرورة user.uid لو اللي بيبعت الدعوة
      // هو الأدمن نيابة عن صاحب العمل، عشان الإحصائيات والصلاحيات تفضل صحيحة على الوظيفة الأصلية.
      await setDoc(doc(db, "invitations", `${selectedJobId}_${seekerId}`), {
        employerId: job.employerId || user.uid,
        employerCompanyName: job.companyName || "",
        seekerId,
        jobPostId: selectedJobId,
        jobTitle: job.title || "",
        createdAt: serverTimestamp(),
      });

      setSent(true);
    } catch (err) {
      console.error("Send invite failed", err);
      setError("حصلت مشكلة — جرب تاني.");
    }
    setSending(false);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,33,61,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 440,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
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

        <h2 style={{ marginBottom: 6, fontSize: 19 }}>ادعُ {seekerName || "الباحث"} للتقديم</h2>

        {sent ? (
          <p style={{ color: "#2F6F4E", fontSize: 14 }}>✓ اتبعتت الدعوة بنجاح.</p>
        ) : (
          <>
            <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 16 }}>
              اختار وظيفة من إعلاناتك النشطة، وهنبعتله إيميل يدعوه للتقديم عليها.
            </p>

            {loading && <p>جاري التحميل...</p>}

            {!loading && jobs.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", color: "#4A5568" }}>
                مفيش إعلانات نشطة عندك دلوقتي.
              </div>
            )}

            {!loading && jobs.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13.5, fontWeight: 600 }}>الوظيفة</label>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                >
                  <option value="">اختر وظيفة</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} — {j.showCompanyName && j.companyName ? j.companyName : "شركة غير معلنة"} — {j.city} - {j.governorate}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <div style={{ color: "#B03A14", fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button
              onClick={handleSendInvite}
              disabled={sending || !selectedJobId}
              style={{
                width: "100%",
                padding: "12px",
                background: "#14213D",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                cursor: sending || !selectedJobId ? "not-allowed" : "pointer",
                opacity: sending || !selectedJobId ? 0.6 : 1,
              }}
            >
              {sending ? "جاري الإرسال..." : "إرسال الدعوة"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
