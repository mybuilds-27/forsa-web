"use client";

import { useState } from "react";
import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildWhatsAppChatLink, whatsappButtonStyle } from "@/lib/whatsappLink";

// قسم "أنشط أصحاب العمل" في تاب أصحاب الأعمال: كل صاحب عمل نشر وظيفة واحدة على الأقل في آخر 90 يوم،
// مترتبين بعدد التقديمات على وظايفه (كل الوقت) من الأكبر للأصغر، وأول 30 بس. بيتحمّل بزرار "عرض" بس.
//
// القراءات في كل ضغطة "عرض" تقريبًا:
//   1) job_posts اللي createdAt بتاعها في آخر 90 يوم (range على حقل واحد، من غير composite index): قراءة لكل وظيفة.
//   2) عدد التقديمات لكل صاحب عمل منهم: getCountFromServer(applications where employerId ==)، مفيش حقل
//      جاهز بعدد التقديمات على job_posts. كل استعلام عدّ = قراءة واحدة لكل 1000 تقديم (أقل حاجة قراءة واحدة).
//   3) لأول 30 بس: مستندات employers (استعلام documentId in، قراءة لكل مستند) + private/contact لكل واحد.
// الوظايف النشطة دلوقتي محسوبة من نفس وظايف الـ90 يوم (isActive ومش منتهية)، لأن أطول مدة نشر 60 يوم
// (planLimits.ts) وexpiresAt بيتحدد وقت النشر بس، فأي وظيفة نشطة دلوقتي اتنشرت في آخر 90 يوم.
const WINDOW_DAYS = 90;
const TOP_N = 30;
const COUNT_CONCURRENCY = 10;
const IN_QUERY_CHUNK = 30;

type Row = {
  id: string;
  companyName: string;
  premiumNow: boolean;
  planExpiresAtMillis: number | null;
  jobs90: number;
  activeNow: number;
  applications: number | null;
  lastJobMillis: number | null;
  phone: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const formatMillis = (ms: number | null) => (ms === null ? "—" : new Date(ms).toLocaleDateString("ar-EG"));

async function loadTopEmployers(): Promise<{ rows: Row[]; employersInWindow: number }> {
  const nowMs = Date.now();
  const since = Timestamp.fromMillis(nowMs - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const postsSnap = await getDocs(query(collection(db, "job_posts"), where("createdAt", ">=", since)));

  const byEmployer = new Map<string, { jobs90: number; activeNow: number; lastJobMillis: number | null }>();
  postsSnap.docs.forEach((d) => {
    const data = d.data();
    const employerId = str(data.employerId);
    if (!employerId) return;
    const createdAt = data.createdAt as Timestamp | undefined;
    const expiresAt = data.expiresAt as Timestamp | undefined;
    const createdMs = createdAt?.toMillis ? createdAt.toMillis() : null;
    const active = data.isActive === true && !(expiresAt?.toMillis && expiresAt.toMillis() <= nowMs);
    const cur = byEmployer.get(employerId) || { jobs90: 0, activeNow: 0, lastJobMillis: null };
    cur.jobs90 += 1;
    if (active) cur.activeNow += 1;
    if (createdMs !== null && (cur.lastJobMillis === null || createdMs > cur.lastJobMillis)) cur.lastJobMillis = createdMs;
    byEmployer.set(employerId, cur);
  });

  // عدد التقديمات لكل صاحب عمل (على دفعات عشان مانبعتش مئات الطلبات مرة واحدة). فشل واحد = null ويتحط في الآخر.
  const ids = [...byEmployer.keys()];
  const appCounts = new Map<string, number | null>();
  for (let i = 0; i < ids.length; i += COUNT_CONCURRENCY) {
    const chunk = ids.slice(i, i + COUNT_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((id) => getCountFromServer(query(collection(db, "applications"), where("employerId", "==", id))))
    );
    results.forEach((r, j) => appCounts.set(chunk[j], r.status === "fulfilled" ? r.value.data().count : null));
  }

  const top = ids
    .sort((a, b) => (appCounts.get(b) ?? -1) - (appCounts.get(a) ?? -1))
    .slice(0, TOP_N);

  const employers = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < top.length; i += IN_QUERY_CHUNK) {
    const snap = await getDocs(query(collection(db, "employers"), where(documentId(), "in", top.slice(i, i + IN_QUERY_CHUNK))));
    snap.docs.forEach((d) => employers.set(d.id, d.data()));
  }

  // رقم التواصل من employers/{uid}/private/contact. فشل قراءة واحد بيسيب الرقم فاضي بس.
  const phones = new Map<string, string>();
  await Promise.all(
    top.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, "employers", id, "private", "contact"));
        if (snap.exists()) phones.set(id, str(snap.data().phone));
      } catch (err) {
        console.error("[TopEmployersAdminSection] فشل قراءة private/contact", err);
      }
    })
  );

  const rows = top.map((id) => {
    const e = employers.get(id) || {};
    const planExpiresAt = e.planExpiresAt as Timestamp | undefined;
    const planExpiresAtMillis = planExpiresAt?.toMillis ? planExpiresAt.toMillis() : null;
    const stats = byEmployer.get(id)!;
    return {
      id,
      companyName: str(e.companyName),
      premiumNow: e.plan === "premium" && (planExpiresAtMillis === null || planExpiresAtMillis > nowMs),
      planExpiresAtMillis,
      jobs90: stats.jobs90,
      activeNow: stats.activeNow,
      applications: appCounts.get(id) ?? null,
      lastJobMillis: stats.lastJobMillis,
      phone: phones.get(id) || "",
    };
  });
  return { rows, employersInWindow: ids.length };
}

export default function TopEmployersAdminSection() {
  const [data, setData] = useState<{ rows: Row[]; employersInWindow: number } | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    setState("loading");
    try {
      setData(await loadTopEmployers());
      setState("idle");
    } catch (err) {
      console.error("[TopEmployersAdminSection] فشل التحميل", err);
      setState("error");
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>أنشط أصحاب العمل</h2>
      <p style={{ fontSize: 12.5, color: "#4A5568", margin: "0 0 12px" }}>
        أصحاب الأعمال اللي نشروا وظيفة واحدة على الأقل في آخر {WINDOW_DAYS} يوم، مترتبين بعدد التقديمات على وظايفهم (أول {TOP_N}).
        الباقة المدفوعة الحالية عليها ⭐.
      </p>
      {!data &&
        (state === "loading" ? (
          <div style={{ fontSize: 12, color: "#4A5568", marginTop: 6 }}>جاري التحميل...</div>
        ) : (
          <button type="button" onClick={load} style={showBtnStyle}>
            {state === "error" ? "تعذر التحميل — إعادة المحاولة" : "عرض"}
          </button>
        ))}
      {data && data.rows.length === 0 && <div style={{ fontSize: 13, color: "#4A5568" }}>مفيش أصحاب أعمال نشروا وظايف في آخر {WINDOW_DAYS} يوم.</div>}
      {data && data.rows.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: "#4A5568", marginBottom: 8 }}>
            {data.employersInWindow} صاحب عمل نشر في آخر {WINDOW_DAYS} يوم، والمعروض أول {data.rows.length}.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["الشركة", "الباقة", `وظايف آخر ${WINDOW_DAYS} يوم`, "نشطة دلوقتي", "التقديمات", "آخر وظيفة", "التواصل"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const wa = buildWhatsAppChatLink(r.phone);
                  return (
                    <tr key={r.id} style={r.premiumNow ? { background: "rgba(232,163,61,0.12)" } : undefined}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>
                        {r.premiumNow ? "⭐ " : ""}
                        {r.companyName || "(بدون اسم)"}
                      </td>
                      <td style={tdStyle}>
                        {r.premiumNow ? (
                          <span style={{ color: "#8A570D", fontWeight: 700 }}>
                            مدفوعة{r.planExpiresAtMillis !== null ? ` حتى ${formatMillis(r.planExpiresAtMillis)}` : " (مفتوحة)"}
                          </span>
                        ) : (
                          "مجانية"
                        )}
                      </td>
                      <td style={tdStyle}>{r.jobs90}</td>
                      <td style={tdStyle}>{r.activeNow}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{r.applications ?? "—"}</td>
                      <td style={tdStyle}>{formatMillis(r.lastJobMillis)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span dir="ltr">{r.phone || "—"}</span>
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" style={whatsappButtonStyle}>
                              مراسلة عبر واتساب
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// نفس شكل زرار "عرض" (OnDemandButton في admin/page.tsx)
const showBtnStyle: React.CSSProperties = {
  marginTop: 6,
  padding: "4px 12px",
  fontSize: 12,
  border: "1px solid #14213D",
  background: "transparent",
  borderRadius: 6,
  cursor: "pointer",
};
const thStyle: React.CSSProperties = { textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #14213D33", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #14213D14", verticalAlign: "top" };
