"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeEntries } from "@/lib/profileFields";
import CVPreview from "@/components/CVPreview";

// بطاقة "اطبع سيرتك الذاتية" + الطباعة نفسها — مشتركة بين تاب "حسابي" (ProfileTab) وتاب
// "السيرة الذاتية" (?tab=cv في seeker/page.tsx). بتترسم بس لما الباحث عنده بروفايل.
export default function CvPrintCard({ data }: { data: Record<string, unknown> }) {
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    window.print();
    const handleAfterPrint = () => setPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [printing]);

  return (
    <>
      <div
        style={{
          background: "#F8F6F0",
          border: "1px solid #14213D33",
          borderRadius: 10,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#14213D" }}>اطبع سيرتك الذاتية</h3>
        <p style={{ margin: "0 0 14px", fontSize: 14.5, color: "#4A5568", lineHeight: 1.8 }}>
          سيرة ذاتية عربي مرتبة من بيانات بروفايلك، تحفظها PDF وتبعتها لأي شركة.
        </p>
        <button
          onClick={() => setPrinting(true)}
          style={{
            width: "100%",
            maxWidth: 360,
            padding: "14px 24px",
            background: "#14213D",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 16,
            fontFamily: "inherit",
          }}
        >
          📄 اعمل CV احترافي واحفظه
        </button>
      </div>

      {/* بنعمل الطباعة portal لـdocument.body عشان يبقى sibling مباشر للهيدر والفوتر، مش
          متداخل جوه شجرة الصفحة العادية — لو فضل جوه شجرة الصفحة، إخفاء باقي العناصر
          بـvisibility بيسيب مساحتهم محجوزة في التخطيط ويطلع صفحة فاضية زيادة وقت الطباعة. */}
      {printing && typeof document !== "undefined" && createPortal(
        <div className="cv-print-view">
          <CVPreview data={data} skills={normalizeEntries(data.skills)} languages={normalizeEntries(data.languages)} />
        </div>,
        document.body
      )}
    </>
  );
}
