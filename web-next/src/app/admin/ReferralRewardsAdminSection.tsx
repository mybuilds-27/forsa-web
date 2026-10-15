"use client";

import { useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  adminActionErrorMessage,
  adminGrantReferralReward,
  adminListReferralCandidates,
  adminListReferralCounts,
  type ReferralCandidate,
  type ReferralCandidatesResult,
  type ReferralCountsResult,
} from "@/lib/adminEmployers";
import { toolBtnStyle, dangerToolBtnStyle } from "@/lib/jobCardStyles";

// قسم "مكافآت الإحالة" في تاب أصحاب الأعمال: البيانات بتتحمّل بزر "عرض" بس (مش تلقائي)، والمنح/الرفض
// على السيرفر (adminGrantReferralReward بتختار الإحالات الخمسة بنفسها جوه transaction). أخطاء السيرفر
// بتتعرض زي ما هي — نصوص عربية مكتوبة للأدمن.
const SUSPICIOUS_LABELS: Record<string, string> = {
  same_contact_phone: "نفس رقم التواصل بتاع صاحب الإحالة",
  same_auth_phone: "نفس رقم الدخول بالتليفون بتاع صاحب الإحالة",
};

function formatMillis(ms: number | null): string {
  return ms === null ? "—" : new Date(ms).toLocaleDateString("ar-EG");
}

export default function ReferralRewardsAdminSection() {
  const [data, setData] = useState<ReferralCandidatesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busyReferrerId, setBusyReferrerId] = useState<string | null>(null);
  // نتيجة آخر منح/رفض — بتتعرض فوق القائمة (الكارت نفسه ممكن يختفي بعد التحديث)، وبتفضل لحد إجراء تاني أو "عرض/تحديث"
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      setData(await adminListReferralCandidates());
    } catch (err) {
      console.error("adminListReferralCandidates failed", err);
      setLoadError(adminActionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function decide(candidate: ReferralCandidate, action: "grant" | "reject") {
    if (busyReferrerId) return;
    const name = candidate.companyName || candidate.referrerId;
    let reason = "";
    if (action === "reject") {
      const input = window.prompt(`سبب رفض مكافأة "${name}"؟ (لازم يتكتب)`);
      if (input === null) return;
      reason = input.trim();
      if (!reason) {
        window.alert("لازم تكتب سبب الرفض.");
        return;
      }
      if (!window.confirm(`ترفض مكافأة "${name}"؟ الإحالات الخمسة هتتحسب مستخدمة ومش هتظهر تاني.`)) return;
    } else {
      const months = data?.rewardMonths ?? 3;
      if (!window.confirm(`تمنح "${name}" ${months} أشهر من الباقة المدفوعة مقابل ${data?.rewardSize ?? 5} إحالات مؤهلة؟`)) return;
    }

    setBusyReferrerId(candidate.referrerId);
    setMessage(null);
    try {
      const result = await adminGrantReferralReward(candidate.referrerId, action, reason || undefined);
      const text =
        result.status === "granted"
          ? `"${name}": اتمنحت المكافأة — الباقة سارية لحد ${formatMillis(result.planExpiresAtMillis)}`
          : `"${name}": اترفضت المكافأة واتسجّل السبب`;
      setMessage({ ok: true, text });
      await load();
    } catch (err) {
      console.error("adminGrantReferralReward failed", err);
      setMessage({ ok: false, text: `"${name}": ${adminActionErrorMessage(err)}` });
    } finally {
      setBusyReferrerId(null);
    }
  }

  return (
    <div style={{ border: "1px solid #14213D22", borderRadius: 10, padding: 16, marginTop: 30 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>مكافآت الإحالة</h2>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            void load();
          }}
          disabled={loading || busyReferrerId !== null}
          style={toolBtnStyle}
        >
          {loading ? "جاري التحميل..." : data ? "تحديث" : "عرض"}
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#4A5568", margin: "8px 0 0" }}>
        أصحاب الإحالة اللي عندهم {data?.rewardSize ?? 5} إحالات مؤهلة ومش مستخدمة أو أكتر. راجع الحسابات المُحالة قبل المنح.
      </p>

      {message && (
        <div style={{ marginTop: 12, fontSize: 13.5, color: message.ok ? "#2F6F4E" : "#B03A14" }}>{message.text}</div>
      )}
      {loadError && <div style={{ marginTop: 12, color: "#B03A14", fontSize: 13.5 }}>{loadError}</div>}

      {data && data.candidates.length === 0 && (
        <div style={{ marginTop: 12, color: "#4A5568", fontSize: 13.5 }}>مفيش أصحاب إحالة مستحقين دلوقتي.</div>
      )}

      {data?.candidates.map((c) => {
        const busy = busyReferrerId !== null;
        // نفس اختيار السيرفر: أول rewardSize مؤهلين ومش مستخدمين بترتيب referredAt تصاعدي
        const willCount = new Set(
          c.referred
            .filter((r) => r.qualified && !r.used)
            .sort((a, b) => (a.referredAtMillis ?? 0) - (b.referredAtMillis ?? 0))
            .slice(0, data.rewardSize)
            .map((r) => r.employerId)
        );
        return (
          <div key={c.referrerId} style={{ border: "1px solid #14213D1A", borderRadius: 8, padding: 14, marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {c.companyName || "(من غير اسم)"}
              {c.banned && <span style={{ color: "#B03A14", fontWeight: 400, fontSize: 13 }}> — محظور</span>}
            </div>
            <div style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.8 }}>
              الباقة: {c.plan === "premium" ? "مدفوعة" : "مجانية"}
              {c.plan === "premium" && ` — تنتهي ${c.planExpiresAtMillis ? formatMillis(c.planExpiresAtMillis) : "(من غير تاريخ انتهاء)"}`}
              {" · "}مؤهلين متاحين: <strong>{c.qualifiedAvailable}</strong>
              {" · "}مكافآت سابقة: {c.rewardsGranted}
            </div>

            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "#F8F6F0" }}>
                    {["الشركة المُحالة", "إنشاء الشركة", "تاريخ الإحالة", "إيميل/تليفون متأكد", "الوظائف", "محظور", "مؤشرات الشك", "مؤهل", "مستخدم", "سيُحتسب"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.referred.map((r) => (
                    <tr key={r.employerId} style={{ background: r.suspicious.length > 0 ? "#FBEAE5" : undefined }}>
                      <td style={tdStyle}>{r.exists ? r.companyName || "(من غير اسم)" : "(الشركة اتمسحت)"}</td>
                      <td style={tdStyle}>{formatMillis(r.createdAtMillis)}</td>
                      <td style={tdStyle}>{formatMillis(r.referredAtMillis)}</td>
                      <td style={tdStyle}>{r.verified ? "نعم" : "لا"}</td>
                      <td style={tdStyle}>{r.jobCount}</td>
                      <td style={{ ...tdStyle, color: r.banned ? "#B03A14" : undefined }}>{r.banned ? "نعم" : "لا"}</td>
                      <td style={{ ...tdStyle, color: r.suspicious.length > 0 ? "#B03A14" : undefined, fontWeight: r.suspicious.length > 0 ? 700 : 400 }}>
                        {r.suspicious.length > 0 ? r.suspicious.map((s) => SUSPICIOUS_LABELS[s] || s).join("، ") : "—"}
                      </td>
                      <td style={tdStyle}>{r.qualified ? "نعم" : "لا"}</td>
                      <td style={tdStyle}>{r.used ? "نعم" : "لا"}</td>
                      <td style={{ ...tdStyle, fontWeight: willCount.has(r.employerId) ? 700 : 400 }}>{willCount.has(r.employerId) ? "نعم" : "لا"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12.5, color: "#4A5568", marginTop: 6 }}>
              المنح أو الرفض يشمل الإحالات الخمس المحددة بـ&quot;نعم&quot; في عمود سيُحتسب.
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" disabled={busy} onClick={() => decide(c, "grant")} style={toolBtnStyle}>
                {busyReferrerId === c.referrerId ? "جاري..." : `منح ${data.rewardMonths} أشهر`}
              </button>
              <button type="button" disabled={busy} onClick={() => decide(c, "reject")} style={dangerToolBtnStyle}>
                رفض
              </button>
            </div>
          </div>
        );
      })}

      <ReferralCountsTable />
    </div>
  );
}

// اسم الشركة لكل صاحب إحالة — قراءة employers بدفعات 30 (documentId in)، نفس نمط تاب أصحاب الأعمال
async function loadCompanyNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(collection(db, "employers"), where(documentId(), "in", ids.slice(i, i + 30))));
    snap.docs.forEach((d) => names.set(d.id, typeof d.data().companyName === "string" ? d.data().companyName : ""));
  }
  return names;
}

// "عدد الإحالات لكل صاحب عمل": كل صاحب إحالة عنده إحالة واحدة أو أكتر، من الأكبر للأصغر. البيانات
// بتتحمّل بزرار (مش تلقائي)، ونفس النداء متخزّن ومشترك مع خانة "الإحالات" في كروت أصحاب الأعمال.
function ReferralCountsTable() {
  const [result, setResult] = useState<(ReferralCountsResult & { names: Map<string, string> }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(force: boolean) {
    setLoading(true);
    setError("");
    try {
      const counts = await adminListReferralCounts(force);
      const names = await loadCompanyNames(counts.counts.map((c) => c.referrerId));
      setResult({ ...counts, names });
    } catch (err) {
      console.error("adminListReferralCounts failed", err);
      setError(adminActionErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: "100%", boxSizing: "border-box", marginTop: 16, paddingTop: 14, borderTop: "1px solid #14213D1A" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 15.5, margin: 0 }}>عدد الإحالات لكل صاحب عمل</h3>
        <button type="button" onClick={() => void load(result !== null)} disabled={loading} style={toolBtnStyle}>
          {loading ? "جاري التحميل..." : result ? "تحديث" : "عرض"}
        </button>
      </div>

      {error && <div style={{ marginTop: 10, color: "#B03A14", fontSize: 13.5 }}>{error}</div>}

      {result?.truncated && (
        <div style={{ marginTop: 10, fontSize: 13, color: "#8A570D" }}>
          الأعداد محسوبة من أول {result.readLimit} إحالة بس — المجموعة أكبر من كده، فالأرقام ممكن تكون أقل من الحقيقية.
        </div>
      )}

      {result && result.counts.length === 0 && (
        <div style={{ marginTop: 10, color: "#4A5568", fontSize: 13.5 }}>مفيش إحالات لسه.</div>
      )}

      {result && result.counts.length > 0 && (
        <div style={{ width: "100%", overflowX: "auto", marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8F6F0" }}>
                {["الشركة", "إجمالي الإحالات", "المشبوهة"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.counts.map((c) => {
                const name = result.names.has(c.referrerId) ? result.names.get(c.referrerId) || "(من غير اسم)" : "(الشركة اتمسحت)";
                return (
                  <tr key={c.referrerId}>
                    <td style={{ ...tdStyle, overflowWrap: "anywhere" }}>{name}</td>
                    <td style={tdStyle}>{c.total}</td>
                    <td style={{ ...tdStyle, color: c.suspicious > 0 ? "#B03A14" : undefined, fontWeight: c.suspicious > 0 ? 700 : 400 }}>
                      {c.suspicious}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "7px 8px", textAlign: "right", borderBottom: "1px solid #14213D33", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "7px 8px", borderBottom: "1px solid #14213D14", verticalAlign: "top" };
