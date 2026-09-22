"use client";

import { useState } from "react";
import { buildFacebookPostText, FacebookPostJob } from "@/lib/facebookPostText";

type Props = {
  job: FacebookPostJob;
  onClose: () => void;
};

// مودال بنص جاهز للنشر على فيسبوك، جوه textarea قابلة للتعديل الكامل (مش نسخ جامد) — الأدمن/صاحب
// العمل يقدر يزوّد حاجة زي الراتب أو التأمين قبل ما ينسخ، لأنها مش جزء من القالب التلقائي (شوف
// buildFacebookPostText). نفس نمط باقي المودالات في المشروع (SeekerDetailModal.tsx) للخلفية
// والصندوق، ونفس نمط نسخ الرابط بالـfallback في ShareButton.tsx.
export default function FacebookPostModal({ job, onClose }: Props) {
  const jobUrl = typeof window !== "undefined" ? `${window.location.origin}/jobs/${job.id}` : `https://elshoghl.com/jobs/${job.id}`;
  const [text, setText] = useState(() => buildFacebookPostText(job, jobUrl));
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
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

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,33,61,0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 520,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1.5px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ✕
        </button>

        <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "#14213D" }}>📋 نص جاهز للنشر على فيسبوك</h3>
        <p style={{ fontSize: 12.5, color: "#4A5568", marginBottom: 14, lineHeight: 1.7 }}>
          عدّل النص زي ما تحب (تقدر تضيف الراتب أو التأمين أو المواصلات مثلًا) قبل ما تنسخه.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          dir="rtl"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: 12,
            border: "1px solid #14213D33",
            borderRadius: 8,
            fontFamily: "inherit",
            fontSize: 13.5,
            lineHeight: 1.8,
            resize: "vertical",
          }}
        />

        <button
          onClick={handleCopy}
          style={{
            display: "block",
            width: "100%",
            marginTop: 14,
            padding: "10px 16px",
            background: "#14213D",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {copied ? "✓ اتنسخ النص" : "📋 نسخ النص"}
        </button>
      </div>
    </div>
  );
}
