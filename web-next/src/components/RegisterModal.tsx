"use client";

import RegisterForm from "./RegisterForm";

type Props = {
  onClose: () => void;
  // بيتنادى بعد نجاح التسجيل — بيستخدم مع مودال التقديم على وظيفة عشان يكمّل التقديم
  // فورًا من غير ما يحتاج المستخدم يدوس "قدم الآن" تاني. الدور دايمًا "باحث عن شغل" هنا،
  // فمفيش داعي يوصلنا في الـcallback.
  onSuccess: () => void;
};

export default function RegisterModal({ onClose, onSuccess }: Props) {
  return (
    <div
      onClick={onClose}
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
          maxWidth: 460,
          width: "100%",
          maxHeight: "90vh",
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

        <h2 style={{ marginBottom: 6, fontSize: 19 }}>سجّل عشان تقدر تقدّم</h2>
        <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 16 }}>
          هتقدر تكمّل التقديم على الوظيفة دي فورًا بعد ما تسجّل — مجاني بالكامل ومش هياخد
          أكتر من دقيقة.
        </p>

        <RegisterForm role="job_seeker" showRoleToggle={false} onSuccess={onSuccess} />
      </div>
    </div>
  );
}
