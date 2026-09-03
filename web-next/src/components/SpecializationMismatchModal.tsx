"use client";

export type MismatchItem = {
  label: string;
  message: string;
};

type Props = {
  items: MismatchItem[];
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// بيتعرض قبل إتمام التقديم لو فيه اختلاف بين بيانات بروفايل الباحث وبيانات الوظيفة (تخصص،
// مستوى، ...) — تنبيه بس، مش منع، عشان الباحث يقدر يراجع قراره قبل ما يقدّم بالغلط. كل
// نوع فحص (تخصص/مستوى) بيبني رسالته الجاهزة بنفسه في نقطة النداء (ApplyButton.tsx/JobsTab.tsx)
// ويبعتها هنا — لو فيه أكتر من اختلاف في نفس الوقت، بيتعرضوا كلهم مع بعض في مودال واحد
// بسؤال تأكيد واحد بدل ما يتكرر السؤال لكل نوع اختلاف.
export default function SpecializationMismatchModal({ items, submitting, onCancel, onConfirm }: Props) {
  if (items.length === 0) return null;

  const title = items.length === 1 ? `⚠️ ${items[0].label} مختلف` : "⚠️ في أكتر من اختلاف بين بياناتك والوظيفة";

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
        <h2 style={{ marginBottom: 10, fontSize: 18 }}>{title}</h2>

        {items.map((item, i) => (
          <p key={i} style={{ color: "#4A5568", fontSize: 14, lineHeight: 1.8, marginBottom: 8 }}>
            {item.message}
          </p>
        ))}

        <p style={{ color: "#14213D", fontSize: 14, fontWeight: 700, lineHeight: 1.8, marginTop: 12, marginBottom: 20 }}>
          متأكد إنك عايز تقدّم برضو؟
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
