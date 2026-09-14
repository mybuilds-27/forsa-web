"use client";

import { useState } from "react";
import RegisterForm from "./RegisterForm";

type Props = {
  onClose: () => void;
  // بيتنادى بعد نجاح التسجيل — بيستخدم مع مودال التقديم على وظيفة عشان يكمّل التقديم
  // فورًا من غير ما يحتاج المستخدم يدوس "قدم الآن" تاني. الدور دايمًا "باحث عن شغل" هنا،
  // فمفيش داعي يوصلنا في الـcallback.
  onSuccess: () => void;
};

export default function RegisterModal({ onClose, onSuccess }: Props) {
  // true أثناء أي طلب كود/تحقق تليفون شغال جوه RegisterForm (شوف onBusyChange هناك) — بنمنع
  // قفل المودال في الحالة دي عشان مينفعش يحصل unmount للفورم وهي لسه مستخدمة الـreCAPTCHA
  // widget من جوه signInWithPhoneNumber المعلّق، وده كان بيسبب "already rendered" في المحاولة
  // الجاية لو المستخدم قفل وفتح تاني بسرعة.
  const [busy, setBusy] = useState(false);

  function handleClose() {
    if (busy) return;
    onClose();
  }

  return (
    <div
      onClick={handleClose}
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
          onClick={handleClose}
          disabled={busy}
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1.5px solid #ccc",
            background: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          ✕
        </button>

        <h2 style={{ marginBottom: 6, fontSize: 19 }}>سجّل عشان تقدر تقدّم</h2>
        <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 16 }}>
          هتقدر تكمّل التقديم على الوظيفة دي فورًا بعد ما تسجّل — مجاني بالكامل ومش هياخد
          أكتر من دقيقة.
        </p>

        <RegisterForm role="job_seeker" showRoleToggle={false} onSuccess={onSuccess} onBusyChange={setBusy} />
      </div>
    </div>
  );
}
