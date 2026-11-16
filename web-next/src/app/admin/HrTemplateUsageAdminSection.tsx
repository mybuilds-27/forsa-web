"use client";

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hrTemplates } from "@/content/hr-templates";

// قسم "استخدام نماذج HR" في لوحة الإدارة: أعداد التحميل/النسخ/الطباعة لكل نموذج من template_usage/{slug}
// (HrTemplateActions.tsx بيزوّدها). بيتحمّل بزرار "عرض" بس، زي باقي الأقسام التقيلة. الأسماء من hrTemplates،
// والنماذج اللي مالهاش مستند بتظهر بأصفار، والترتيب بالإجمالي من الأكبر للأصغر.
type Row = { slug: string; title: string; download: number; copy: number; print: number; total: number };

const num = (v: unknown) => (typeof v === "number" ? v : 0);

export default function HrTemplateUsageAdminSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    setState("loading");
    try {
      const snap = await getDocs(collection(db, "template_usage"));
      const usage = new Map(snap.docs.map((d) => [d.id, d.data()]));
      const result = hrTemplates
        .map((t) => {
          const u = usage.get(t.slug) || {};
          const download = num(u.download), copy = num(u.copy), print = num(u.print);
          return { slug: t.slug, title: t.title, download, copy, print, total: download + copy + print };
        })
        .sort((a, b) => b.total - a.total);
      setRows(result);
      setState("idle");
    } catch (err) {
      console.error("[HrTemplateUsageAdminSection] فشل تحميل template_usage", err);
      setState("error");
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>استخدام نماذج HR</h2>
      <p style={{ fontSize: 12.5, color: "#4A5568", margin: "0 0 12px" }}>
        عدد مرات تحميل Word والنسخ والطباعة لكل نموذج (عدد بس، من غير أي بيانات عن الزائر)
      </p>
      {!rows &&
        (state === "loading" ? (
          <div style={{ fontSize: 12, color: "#4A5568", marginTop: 6 }}>جاري التحميل...</div>
        ) : (
          <button type="button" onClick={load} style={showBtnStyle}>
            {state === "error" ? "تعذر التحميل — إعادة المحاولة" : "عرض"}
          </button>
        ))}
      {rows && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["النموذج", "التحميل", "النسخ", "الطباعة", "الإجمالي"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug}>
                  <td style={tdStyle}>{r.title}</td>
                  <td style={tdStyle}>{r.download}</td>
                  <td style={tdStyle}>{r.copy}</td>
                  <td style={tdStyle}>{r.print}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
const tdStyle: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #14213D14" };
