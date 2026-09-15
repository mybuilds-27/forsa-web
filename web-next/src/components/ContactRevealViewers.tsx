"use client";

import { useState } from "react";
import { fetchContactRevealViewers, ContactRevealViewer } from "@/lib/contactReveal";

type Props = { jobPostId: string };

// قسم قابل للتوسيع (نفس نمط AuthErrorCard في admin/page.tsx) بيعرض مين شاف وسيلة التواصل
// المباشرة للوظيفة دي (contact_reveals/{jobPostId}/viewers) — لصاحب العمل والأدمن مع بعض.
// البيانات بتتجاب أول مرة بس القسم يتفتح (مش مع باقي بيانات الوظيفة في القايمة الرئيسية)،
// عشان منعملش قراءة sub-collection لكل وظيفة من غير داعي.
export default function ContactRevealViewers({ jobPostId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewers, setViewers] = useState<ContactRevealViewer[] | null>(null);

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (viewers !== null) return;
    setLoading(true);
    try {
      setViewers(await fetchContactRevealViewers(jobPostId));
    } catch (err) {
      console.error("[ContactRevealViewers] فشل جلب قايمة اللي شافوا وسيلة التواصل", err);
      setViewers([]);
    }
    setLoading(false);
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          padding: "4px 10px",
          fontSize: 12,
          background: "transparent",
          border: "1px solid #14213D22",
          borderRadius: 6,
          color: "#14213D",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {expanded ? "إخفاء ▲" : "مين شاف وسيلة التواصل؟ ▼"}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ fontSize: 12, color: "#4A5568" }}>جاري التحميل...</div>
          ) : viewers && viewers.length > 0 ? (
            viewers.map((v) => (
              <div key={v.uid} style={{ fontSize: 12, color: "#4A5568", borderTop: "1px solid #14213D14", paddingTop: 6 }}>
                <div style={{ fontWeight: 600, color: "#14213D" }}>{v.fullName}</div>
                <div>{v.viewedAt ? v.viewedAt.toDate().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : ""}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "#4A5568" }}>لسه محدش شاف وسيلة التواصل.</div>
          )}
        </div>
      )}
    </div>
  );
}
