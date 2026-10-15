"use client";

import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/lib/firebase";

// قسم "رابط الإحالة" في CompanyTab. الأعداد من getMyReferralStats (functions/index.js) — أعداد بس، من غير
// أي بيانات عن الشركات المُحالة. النداء مرة واحدة عند ظهور القسم، وبعدها بزر "تحديث" يدوي بس.
type ReferralStats = {
  referred: number;
  qualifiedAvailable: number;
  pending: number;
  rewardsGranted: number;
  rewardSize: number;
};

// الدومين الرسمي — نفس SITE_URL في app/layout.tsx (metadataBase) وbaseUrl في app/sitemap.ts (مفيش ثابت
// مشترك متصدّر). www بيرد 200 مباشرة، والدومين من غير www بيعمل 308 لنفس الرابط ومعاه الـquery.
const SITE_ORIGIN = "https://www.elshoghl.com";

export default function EmployerReferralSection() {
  const uid = auth.currentUser?.uid || "";
  const referralLink = uid ? `${SITE_ORIGIN}/register?role=employer&ref=${uid}` : "";
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const loadedOnceRef = useRef(false);

  async function loadStats() {
    setStatus("loading");
    try {
      const call = httpsCallable<Record<string, never>, ReferralStats>(functions, "getMyReferralStats");
      const result = await call({});
      setStats(result.data);
      setStatus("ready");
    } catch (err) {
      // رسالة ثابتة بس — مفيش أي نص من السيرفر بيتعرض
      console.error("[EmployerReferralSection] فشل تحميل بيانات الإحالات", err);
      setStats(null);
      setStatus("error");
    }
  }

  useEffect(() => {
    // مرة واحدة بس حتى لو الـeffect اتنفذ مرتين (StrictMode في dev)
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    void loadStats();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 3000);
  }

  if (!referralLink) return null;

  return (
    <div style={{ border: "1px solid #14213D22", borderRadius: 10, padding: 20, marginBottom: 30 }}>
      <h3 style={{ marginBottom: 10, fontSize: 17 }}>ادعُ أصحاب الأعمال واحصل على باقة مدفوعة مجانًا</h3>
      <p style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 12, lineHeight: 1.7 }}>
        كل 5 شركات تسجّل عبر رابطك وتوثّق حسابها وتنشر وظيفة واحدة على الأقل تمنحك 3 أشهر في الباقة المدفوعة بعد المراجعة، تشمل نشر وظائف أكثر والتواصل المباشر مع المرشحين. شارك الرابط مع شركات تعرفها.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
        <input
          type="text"
          readOnly
          value={referralLink}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: "1 1 260px", minWidth: 0, padding: "9px 12px", border: "1px solid #14213D33", borderRadius: 8, fontSize: 13 }}
        />
        <button
          onClick={copyLink}
          style={{ padding: "9px 16px", background: "#14213D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13.5 }}
        >
          نسخ الرابط
        </button>
      </div>
      {copyState === "copied" && <div style={{ fontSize: 12.5, color: "#2F6F4E", marginBottom: 6 }}>تم نسخ الرابط.</div>}
      {copyState === "failed" && (
        <div style={{ fontSize: 12.5, color: "#B03A14", marginBottom: 6 }}>تعذر نسخ الرابط تلقائيًا، يمكنك نسخه يدويًا من الحقل أعلاه.</div>
      )}

      <div style={{ marginTop: 14 }}>
        {status === "loading" && <div style={{ fontSize: 13.5, color: "#4A5568" }}>جارٍ تحميل بيانات الإحالات...</div>}
        {status === "error" && <div style={{ fontSize: 13.5, color: "#B03A14" }}>تعذر تحميل بيانات الإحالات حاليًا.</div>}
        {status === "ready" && stats && (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#14213D", marginBottom: 6 }}>
              الإحالات المؤهلة: {Math.min(stats.qualifiedAvailable, stats.rewardSize)} من {stats.rewardSize}
            </div>
            {stats.qualifiedAvailable >= stats.rewardSize && (
              <div style={{ fontSize: 13.5, color: "#2F6F4E", marginBottom: 6 }}>اكتمل العدد المطلوب، وسيجري مراجعة الاستحقاق.</div>
            )}
            <div style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 4 }}>
              إحالات لم تكتمل شروطها بعد: {stats.pending}
            </div>
            <div style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 4 }}>
              إجمالي الحسابات المسجّلة عبر رابطك: {stats.referred}
            </div>
            {stats.rewardsGranted > 0 && (
              <div style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 4 }}>
                المكافآت الممنوحة سابقًا: {stats.rewardsGranted}
              </div>
            )}
          </>
        )}
        <button
          onClick={() => void loadStats()}
          disabled={status === "loading"}
          style={{
            marginTop: 8,
            padding: "6px 14px",
            background: "transparent",
            color: "#14213D",
            border: "1px solid #14213D55",
            borderRadius: 8,
            cursor: status === "loading" ? "default" : "pointer",
            fontSize: 12.5,
          }}
        >
          تحديث
        </button>
      </div>

      <p style={{ fontSize: 13, color: "#4A5568", marginTop: 14, lineHeight: 1.8 }}>
        الإحالة المؤهلة هي حساب صاحب عمل جديد سُجّل عبر رابطك، وتم توثيق بريده الإلكتروني أو رقم هاتفه، وقد نشر وظيفة واحدة على الأقل.
      </p>
      <p style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.8, margin: 0 }}>
        عند الوصول إلى 5 إحالات مؤهلة، يُراجع الاستحقاق ويُفعَّل اشتراك 3 أشهر في الباقة المدفوعة بعد الموافقة.
      </p>
    </div>
  );
}
