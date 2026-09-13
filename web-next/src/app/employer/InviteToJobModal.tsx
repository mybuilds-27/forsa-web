"use client";

import { useEffect, useRef, useState } from "react";
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

// شكل مبسّط بس للحقول المستخدمة في jobLabel — jobs نفسها فضلت any[] زي ما كانت (مش هدف
// التعديل ده)، بس مفيش داعي any هنا تحديدًا لمجرد قراءة 4 حقول نصية معروفة.
type JobLabelFields = { title?: string; showCompanyName?: boolean; companyName?: string; city?: string; governorate?: string };

// اسم عرض موحّد للوظيفة (في نتائج البحث وفي صندوق الاختيار المؤكّد) — نفس الحقول اللي كانت
// متعروضة في نص <option> القديم بالظبط.
function jobLabel(j: JobLabelFields): string {
  return `${j.title} — ${j.showCompanyName && j.companyName ? j.companyName : "شركة غير معلنة"} — ${j.city} - ${j.governorate}`;
}

export default function InviteToJobModal({ seekerId, seekerName, employerPlan, defaultJobId, onClose }: Props) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // نفس نمط البحث الحي في KeywordsPicker.tsx — بس اختيار واحد بس بدل چيبس متعددة: لما وظيفة
  // تتختار، القايمة بتتقفل وبيتعرض اسمها بدل الحقل، وزرار "تغيير" بيرجّع لوضع البحث تاني.
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // composedPath() بدل contains(e.target) — نفس السبب المتوثّق في KeywordsPicker.tsx: لو
    // العنصر المختار اتشال من الشجرة فورًا (مش حالتنا هنا فعليًا لأن القايمة بتتقفل خالص بعد
    // الاختيار، لكن نفس النمط الآمن المُجرَّب بدل contains العادية).
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !e.composedPath().includes(containerRef.current)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // بعد ما يمسح اختياره (زرار "تغيير")، حقل البحث بيتعرض من جديد فاضي — بنفوكس عليه فورًا
  // ونفتح القايمة عشان يقدر يدور تاني من غير ما يحتاج يدوس على الحقل الأول.
  useEffect(() => {
    if (isOpen && !selectedJobId) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, selectedJobId]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);
  const trimmedSearch = searchText.trim().toLowerCase();
  const filteredJobs = trimmedSearch
    ? jobs.filter((j) => jobLabel(j).toLowerCase().includes(trimmedSearch))
    : jobs;

  function selectJob(jobId: string) {
    setSelectedJobId(jobId);
    setSearchText("");
    setIsOpen(false);
  }

  function clearSelection() {
    setSelectedJobId("");
    setIsOpen(true);
  }

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
                {selectedJob ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 12px",
                      border: "1px solid #ccc",
                      borderRadius: 6,
                      fontSize: 14,
                      background: "#FAF6EC",
                    }}
                  >
                    <span>{jobLabel(selectedJob)}</span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      style={{
                        flexShrink: 0,
                        fontSize: 12.5,
                        padding: "4px 10px",
                        border: "1px solid #14213D",
                        borderRadius: 6,
                        background: "transparent",
                        color: "#14213D",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <div ref={containerRef} style={{ position: "relative" }}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                        setIsOpen(true);
                      }}
                      onFocus={() => setIsOpen(true)}
                      onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
                      placeholder="دور على وظيفة من إعلاناتك..."
                      style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, fontFamily: "inherit" }}
                    />
                    {isOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          zIndex: 10,
                          marginTop: 4,
                          maxHeight: 220,
                          overflowY: "auto",
                          background: "#fff",
                          border: "1px solid #ccc",
                          borderRadius: 6,
                          boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                        }}
                      >
                        {filteredJobs.length === 0 ? (
                          <div style={{ padding: "8px 10px", fontSize: 13, color: "#4A5568" }}>مفيش نتائج مطابقة</div>
                        ) : (
                          filteredJobs.map((j) => (
                            <div
                              key={j.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectJob(j.id);
                              }}
                              style={{ padding: "8px 10px", fontSize: 13.5, cursor: "pointer" }}
                            >
                              {jobLabel(j)}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
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
