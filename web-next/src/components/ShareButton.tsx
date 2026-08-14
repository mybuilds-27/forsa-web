"use client";

import { useState } from "react";

type ShareButtonProps = {
  jobId: string;
  title?: string;
  style?: React.CSSProperties;
};

export default function ShareButton({ jobId, title, style }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/jobs/${jobId}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: title || "وظيفة على موقع الشغل", url });
      } catch {
        // المستخدم لغى المشاركة
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
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
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={handleShare}
        title="مشاركة الوظيفة"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          padding: "3px 10px",
          borderRadius: 999,
          border: "1px solid #14213D22",
          background: "#F0EDE3",
          color: "#14213D",
          cursor: "pointer",
          fontFamily: "inherit",
          ...style,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" />
          <line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
        </svg>
        مشاركة
      </button>
      {copied && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            right: 0,
            background: "#14213D",
            color: "#fff",
            fontSize: 11,
            padding: "4px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          تم نسخ الرابط
        </span>
      )}
    </span>
  );
}
