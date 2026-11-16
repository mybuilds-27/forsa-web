"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { buildHrTemplateDocx } from "@/lib/hrTemplateDocx";

// عداد استخدام النموذج (template_usage/{slug}): +1 في حقل واحد بس، من غير أي بيانات عن الزائر.
// fire-and-forget: الفشل بيتسجل في console بس، ومبيأثرش على الزرار. القواعد بتسمح بزيادة 1 بس في كل كتابة.
function trackUsage(slug: string, field: "download" | "copy" | "print") {
  setDoc(doc(db, "template_usage", slug), { [field]: increment(1) }, { merge: true }).catch((err) =>
    console.error("[HrTemplateActions] فشل تسجيل استخدام النموذج", err)
  );
}

// زرار "نسخ النموذج" و"طباعة النموذج" و"تحميل Word" تحت مربع النموذج في /hr-templates/[slug].
// الطباعة بنفس طريقة CvPrintCard.tsx: النموذج بيتعمله portal كـchild مباشر لـbody بكلاس
// hr-template-print-view، وقاعدة @media print في globals.css بتخفي أي sibling تاني، فالمطبوع
// هو النموذج بس. الكلاس ده مخفي على الشاشة (globals.css) عشان النسخة دي متظهرش تحت الصفحة.
// Word: ملف .docx بيتعمل في المتصفح من نفس قيمة template (lib/hrTemplateDocx.ts، مكتبة docx بتتحمّل وقت الضغط بس).
export default function HrTemplateActions({ template, slug }: { template: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [preparingWord, setPreparingWord] = useState(false);
  const [wordError, setWordError] = useState(false);

  async function handleWordDownload() {
    setPreparingWord(true);
    setWordError(false);
    try {
      const { doc, Packer } = await buildHrTemplateDocx(template, slug);
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      trackUsage(slug, "download");
    } catch (err) {
      console.error("[HrTemplateActions] فشل إنشاء ملف Word", err);
      setWordError(true);
    } finally {
      setPreparingWord(false);
    }
  }

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
    trackUsage(slug, "copy");
  }

  useEffect(() => {
    if (!printing) return;
    const handleAfterPrint = () => setPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    // frame واحد عشان الـportal يترسم الأول قبل نافذة الطباعة
    const frameId = requestAnimationFrame(() => {
      trackUsage(slug, "print");
      window.print();
    });
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printing, slug]);

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={handleCopy} style={primaryButtonStyle}>
          {copied ? "تم النسخ" : "نسخ النموذج"}
        </button>
        <button onClick={() => setPrinting(true)} style={ghostButtonStyle}>
          طباعة النموذج
        </button>
        <button onClick={handleWordDownload} disabled={preparingWord} style={ghostButtonStyle}>
          {preparingWord ? "جارٍ التحضير..." : "تحميل Word"}
        </button>
      </div>
      {wordError && (
        <p style={{ fontSize: 13, color: "#B42318", margin: "8px 0 0" }}>تعذّر إنشاء الملف، حاول مرة أخرى.</p>
      )}

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
