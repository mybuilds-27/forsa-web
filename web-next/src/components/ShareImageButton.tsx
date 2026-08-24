"use client";

import { useState } from "react";

type ShareImageButtonProps = {
  jobId: string;
  title?: string;
  style?: React.CSSProperties;
};

export default function ShareImageButton({ jobId, title, style }: ShareImageButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    setError(false);

    try {
      const res = await fetch(`/jobs/${jobId}/share-image`);
      if (!res.ok) throw new Error("share-image request failed");
      const blob = await res.blob();
      const file = new File([blob], `${jobId}.png`, { type: "image/png" });

      // navigator.share بملفات مدعومة غالبًا على الموبايل بس — بتفتح قائمة المشاركة العادية
      // بتاعة الجهاز (واتساب، فيسبوك، إلخ) بالصورة نفسها. على الكمبيوتر (مش مدعومة عادةً)
      // بننزل الصورة مباشرة بدل ما نكسر أو نعرض حاجة متوقفة.
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: title || "وظيفة على موقع الشغل" });
        } catch {
          // المستخدم لغى المشاركة
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${jobId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[ShareImageButton] فشل جلب أو مشاركة صورة الوظيفة", err);
      setError(true);
      setTimeout(() => setError(false), 2500);
    }

    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="مشاركة صورة الوظيفة"
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
        cursor: loading ? "wait" : "pointer",
        fontFamily: "inherit",
        opacity: loading ? 0.7 : 1,
        ...style,
      }}
    >
      📸 {loading ? "جاري التجهيز..." : error ? "حصلت مشكلة" : "مشاركة صورة"}
    </button>
  );
}
