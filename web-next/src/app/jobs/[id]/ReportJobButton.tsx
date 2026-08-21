"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// بعض إضافات الـadblock بتحظر أي طلب فيه كلمة "report" في اسم الـcollection من غير ما
// ترجع error أو resolve خالص — الـpromise بتاعة addDoc بتفضل معلقة للأبد. الـrace مع
// timeout هنا هو الحل الوحيد لفك التعليق ده وإرجاع الزرار يشتغل تاني.
const REPORT_TIMEOUT_MS = 10000;

const REPORT_REASONS = [
  "الوظيفة مش حقيقية",
  "معلومات الوظيفة غلط",
  "تم شغل الوظيفة بالفعل",
  "محتوى غير لائق",
  "سبب تاني",
];

type Props = {
  jobId: string;
  employerId: string;
  jobTitle: string;
};

// زرار "بلغنا" في صفحة تفاصيل الوظيفة — بيكتب بلاغ في job_reports (create-only من العميل،
// مفيش read/update/delete)، وCloud Function (onNewJobReport) بتبعت إيميل تنبيه للأدمن.
// مفيش لوحة أدمن لعرض البلاغات لسه — الإيميل كافي كبداية.
export default function ReportJobButton({ jobId, employerId, jobTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function handleClose() {
    setOpen(false);
    setSent(false);
    setReason(REPORT_REASONS[0]);
    setDetails("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        addDoc(collection(db, "job_reports"), {
          jobId,
          employerId,
          jobTitle,
          reason,
          details: details.trim(),
          reporterId: auth.currentUser?.uid || null,
          createdAt: serverTimestamp(),
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("REPORT_TIMEOUT")), REPORT_TIMEOUT_MS);
        }),
      ]);
      setSent(true);
    } catch (err) {
      console.error("[ReportJobButton] فشل إرسال البلاغ", err);
      if (err instanceof Error && err.message === "REPORT_TIMEOUT") {
        setError("الطلب مستني كتير — لو عندك إضافة adblock في المتصفح جرب تقفلها أو تستخدم نافذة incognito وجرب تاني");
      } else {
        setError("حصلت مشكلة، حاول تاني");
      }
    } finally {
      clearTimeout(timeoutId);
    }
    setSending(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          fontSize: 12.5,
          color: "#4A5568",
          textDecoration: "underline",
          cursor: "pointer",
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        🚩 فيه مشكلة في الوظيفة دي؟ بلغنا
      </button>

      {open && (
        <div
          onClick={handleClose}
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
            style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%" }}
          >
            {sent ? (
              <>
                <h2 style={{ marginBottom: 6, fontSize: 18 }}>✓ شكرًا، وصلنا بلاغك</h2>
                <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 16 }}>هنراجع الوظيفة دي في أقرب وقت.</p>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#14213D",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  تمام
                </button>
              </>
            ) : (
              <>
                <h2 style={{ marginBottom: 6, fontSize: 18 }}>🚩 بلّغ عن مشكلة في الوظيفة</h2>
                <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 16 }}>{jobTitle}</p>

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: "#14213D" }}>
                      السبب
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{ width: "100%", padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                    >
                      {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: "#14213D" }}>
                      تفاصيل إضافية (اختياري)
                    </label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      placeholder="اكتب أي تفاصيل تساعدنا نراجع البلاغ..."
                      style={{ width: "100%", padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, minHeight: 70, fontFamily: "inherit" }}
                    />
                  </div>

                  {error && <div style={{ color: "#B03A14", fontSize: 13, marginBottom: 12 }}>{error}</div>}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="submit"
                      disabled={sending}
                      style={{
                        flex: 1,
                        padding: "10px",
                        background: "#14213D",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: sending ? "wait" : "pointer",
                        opacity: sending ? 0.7 : 1,
                      }}
                    >
                      {sending ? "جاري الإرسال..." : "إرسال البلاغ"}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      style={{ padding: "10px 16px", background: "transparent", border: "1px solid #14213D33", color: "#14213D", borderRadius: 8, cursor: "pointer" }}
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
