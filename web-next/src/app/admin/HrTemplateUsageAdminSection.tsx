"use client";

import { useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hrTemplates } from "@/content/hr-templates";
import { fileIdFromHref } from "@/components/TrackedDownloadLink";

// قسم "استخدام نماذج HR" في لوحة الإدارة: أعداد التحميل/النسخ/الطباعة لكل نموذج من template_usage/{slug}
// (HrTemplateActions.tsx بيزوّدها). بيتحمّل بزرار "عرض" بس، زي باقي الأقسام التقيلة. الأسماء من hrTemplates،
// والنماذج اللي مالهاش مستند بتظهر بأصفار، والترتيب بالإجمالي من الأكبر للأصغر.
// تحت الجدول: أعداد حاسبة المرتب من tool_usage/salary-calculator (SalaryCalculator.tsx) بنفس زرار "عرض"،
// وأصفار لو المستند لسه مش موجود. قراءتها مستقلة: لو فشلت الجدول بيظهر عادي والكارت بيكتب "تعذر التحميل" بس.
// وتحت الكارت: جدول "تحميل الملفات" من file_downloads/{fileId} (TrackedDownloadLink.tsx). الاسم هو label الـextraDownload
// لو الملف مستخدم في نموذج، وإلا الـid. ملفات extraDownload اللي مالهاش مستند بتظهر بصفر. قراءته مستقلة برضه.
type Row = { slug: string; title: string; download: number; copy: number; print: number; total: number };
type CalcUsage = { grossToNet: number; netToGross: number; excelDownload: number };
type FileRow = { id: string; name: string; count: number };

// fileId → label لكل ملف مستخدم كـextraDownload في نموذج
const extraDownloadLabels = new Map(
  hrTemplates.flatMap((t) => (t.extraDownload ? [[fileIdFromHref(t.extraDownload.href), t.extraDownload.label] as const] : []))
);

const num = (v: unknown) => (typeof v === "number" ? v : 0);

export default function HrTemplateUsageAdminSection() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [calc, setCalc] = useState<CalcUsage | "error" | null>(null);
  const [files, setFiles] = useState<FileRow[] | "error" | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    setState("loading");
    try {
      const [snap, calcResult, filesResult] = await Promise.all([
        getDocs(collection(db, "template_usage")),
        getDoc(doc(db, "tool_usage", "salary-calculator")).then(
          (calcSnap): CalcUsage => {
            const c = calcSnap.exists() ? calcSnap.data() : {};
            return { grossToNet: num(c.grossToNet), netToGross: num(c.netToGross), excelDownload: num(c.excelDownload) };
          },
          (err): "error" => {
            console.error("[HrTemplateUsageAdminSection] فشل تحميل tool_usage", err);
            return "error";
          }
        ),
        getDocs(collection(db, "file_downloads")).then(
          (filesSnap): FileRow[] => {
            const counts = new Map<string, number>([...extraDownloadLabels.keys()].map((id) => [id, 0]));
            filesSnap.docs.forEach((d) => counts.set(d.id, num(d.data().count)));
            return [...counts]
              .map(([id, count]) => ({ id, name: extraDownloadLabels.get(id) || id, count }))
              .sort((a, b) => b.count - a.count);
          },
          (err): "error" => {
            console.error("[HrTemplateUsageAdminSection] فشل تحميل file_downloads", err);
            return "error";
          }
        ),
      ]);
      const usage = new Map(snap.docs.map((d) => [d.id, d.data()]));
      const result = hrTemplates
        .map((t) => {
          const u = usage.get(t.slug) || {};
          const download = num(u.download), copy = num(u.copy), print = num(u.print);
          return { slug: t.slug, title: t.title, download, copy, print, total: download + copy + print };
        })
        .sort((a, b) => b.total - a.total);
      setRows(result);
      setCalc(calcResult);
      setFiles(filesResult);
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
      {calc && (
        <div style={calcCardStyle}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>حاسبة المرتب</div>
          {calc === "error" ? (
            <div style={{ color: "#4A5568" }}>تعذر التحميل</div>
          ) : (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>من الإجمالي للصافي: <b>{calc.grossToNet}</b></span>
              <span>من الصافي للإجمالي: <b>{calc.netToGross}</b></span>
              <span>تحميل Excel: <b>{calc.excelDownload}</b></span>
            </div>
          )}
        </div>
      )}
      {files && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>تحميل الملفات</div>
          {files === "error" ? (
            <div style={{ fontSize: 12.5, color: "#4A5568" }}>تعذر التحميل</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {["الملف", "عدد التحميلات"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id}>
                      <td style={tdStyle}>{f.name}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{f.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
const calcCardStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  border: "1px solid #14213D22",
  borderRadius: 8,
  background: "#F8F6F0",
  fontSize: 12.5,
};
