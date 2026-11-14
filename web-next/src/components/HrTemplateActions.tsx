"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// زرار "نسخ النموذج" و"طباعة النموذج" تحت مربع النموذج في /hr-templates/[slug].
// الطباعة بنفس طريقة CvPrintCard.tsx: النموذج بيتعمله portal كـchild مباشر لـbody بكلاس
// hr-template-print-view، وقاعدة @media print في globals.css بتخفي أي sibling تاني، فالمطبوع
// هو النموذج بس. الكلاس ده مخفي على الشاشة (globals.css) عشان النسخة دي متظهرش تحت الصفحة.
export default function HrTemplateActions({ template }: { template: string }) {
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(template);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = template;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (!printing) return;
    const handleAfterPrint = () => setPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    // frame واحد عشان الـportal يترسم الأول قبل نافذة الطباعة
    const frameId = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printing]);

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={handleCopy} style={primaryButtonStyle}>
          {copied ? "تم النسخ" : "نسخ النموذج"}
        </button>
        <button onClick={() => setPrinting(true)} style={ghostButtonStyle}>
          طباعة النموذج
        </button>
      </div>

      {printing && typeof document !== "undefined" && createPortal(
        <div className="hr-template-print-view" dir="rtl">
          {template}
        </div>,
        document.body
      )}
    </>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "#14213D",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14.5,
  fontFamily: "inherit",
};

const ghostButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "transparent",
  color: "#14213D",
  border: "1px solid #14213D",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14.5,
  fontFamily: "inherit",
};
