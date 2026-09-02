"use client";

import Link from "next/link";
import { markProfileNudgeSeenToday } from "@/lib/profileNudge";

type Props = {
  percent: number;
  onClose: () => void;
};

// بيظهر بعد ما التقديم على وظيفة ينجح فعليًا (شوف ApplyButton.tsx وJobsTab.tsx) — تحفيز
// بس، مش حاجز؛ التقديم نفسه خلص ونجح قبل ما الكومبوننت ده حتى يتعرض. الطرفين (X/"لاحقًا"
// وزرار "كمّل بروفايلك") بيسجّلوا نفس إشارة "اتشافت النهاردة" عشان منمنعش عرضها تاني في
// نفس اليوم (shouldShowProfileNudge في المستدعي).
export default function PostApplyProfileNudge({ percent, onClose }: Props) {
  function handleDismiss() {
    markProfileNudgeSeenToday();
    onClose();
  }

  const isWeak = percent < 50;
  const message = isWeak
    ? `بروفايلك مكتمل ${percent}% بس — يستحسن تكمّل بياناتك عشان صاحب العمل يقدر يقيّم ملفك صح.`
    : `بروفايلك مكتمل ${percent}% — كمّله عشان تزوّد فرصتك في المنافسة.`;

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,33,61,0.55)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "100%", position: "relative" }}
      >
        <button
          onClick={handleDismiss}
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

        <h2 style={{ marginBottom: 6, fontSize: 19 }}>✓ تم التقديم بنجاح</h2>
        <p style={{ color: isWeak ? "#B03A14" : "#4A5568", fontSize: 13.5, lineHeight: 1.7, marginBottom: 20 }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/seeker?tab=profile"
            onClick={handleDismiss}
            style={{
              padding: "10px 20px",
              background: "#14213D",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            كمّل بروفايلك
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            style={{ padding: "10px 20px", border: "1px solid #14213D33", color: "#4A5568", background: "transparent", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
          >
            لاحقًا
          </button>
        </div>
      </div>
    </div>
  );
}
