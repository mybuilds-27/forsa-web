"use client";

type Props = {
  jobSpecialization: string;
  seekerSpecialization: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// بيتعرض قبل إتمام التقديم لو تخصص الباحث المحفوظ في بروفايله مختلف عن تخصص الوظيفة —
// تنبيه بس، مش منع، عشان الباحث يقدر يراجع قراره قبل ما يقدّم على وظيفة برّه تخصصه بالغلط.
// مبيتعرضش خالص لو الباحث معندوش تخصص محفوظ أصلًا (شوف نقطة النداء في ApplyButton.tsx/JobsTab.tsx).
export default function SpecializationMismatchModal({
  jobSpecialization,
  seekerSpecialization,
  submitting,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div
      onClick={onCancel}
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
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
          position: "relative",
        }}
      >
        <h2 style={{ marginBottom: 10, fontSize: 18 }}>⚠️ التخصص مختلف</h2>
        <p style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 20 }}>
          الوظيفة دي في تخصص <strong>{jobSpecialization}</strong>، وبروفايلك موضّح إن تخصصك{" "}
          <strong>{seekerSpecialization}</strong> — متأكد إنك عايز تقدّم؟
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              flex: 1,
              padding: "12px",
              background: "#fff",
              color: "#14213D",
              border: "1.5px solid #14213D33",
              borderRadius: 8,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            رجوع
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            style={{
              flex: 1,
              padding: "12px",
              background: "#14213D",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
              fontSize: 14,
            }}
          >
            {submitting ? "جاري التقديم..." : "قدّم برضو"}
          </button>
        </div>
      </div>
    </div>
  );
}
