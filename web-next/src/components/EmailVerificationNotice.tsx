"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/lib/emailVerificationGate";

type Props = {
  email: string;
};

// مكوّن مشترك بيتعرض بدل أي فيتشر أساسي (نشر وظيفة، تقديم، عرض بيانات تواصل) لو الحساب
// لسه محتاج تأكيد إيميل — شوف lib/emailVerificationGate.ts لمنطق تحديد مين محتاج التأكيد ده.
export default function EmailVerificationNotice({ email }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleResend() {
    setStatus("sending");
    const result = await resendVerificationEmail();
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMsg(result.error || "حصلت مشكلة، حاول تاني");
    }
  }

  return (
    <div
      dir="rtl"
      style={{
        background: "#FFF7E6",
        border: "1px solid #E8A33D66",
        borderRadius: 12,
        padding: "20px 22px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>📩</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#14213D", marginBottom: 6 }}>
        أكد إيميلك الأول عشان تقدر تستخدم حسابك
      </div>
      <div style={{ fontSize: 13.5, color: "#4A5568", lineHeight: 1.8, marginBottom: 6 }}>
        بعتنالك لينك تأكيد على <strong>{email}</strong> — افتح الإيميل ودوس على اللينك، وبعدين
        رجّع افتح الصفحة دي تاني.
      </div>
      <div style={{ fontSize: 13.5, color: "#4A5568", lineHeight: 1.8, marginBottom: 14 }}>
        لو ملقتش الرسالة، بص في مجلد الرسائل غير المرغوب فيها (السبام).
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={status === "sending"}
        style={{
          padding: "10px 22px",
          fontSize: 13.5,
          fontWeight: 700,
          border: "1px solid #E8A33D",
          background: "#fff",
          color: "#8A570D",
          borderRadius: 8,
          cursor: status === "sending" ? "wait" : "pointer",
          opacity: status === "sending" ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        {status === "sending" ? "جاري الإرسال..." : "📤 إعادة إرسال اللينك"}
      </button>
      {status === "sent" && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: "#2F6F4E", fontWeight: 700 }}>
          ✓ اتبعت لينك جديد على إيميلك
        </div>
      )}
      {status === "error" && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: "#B03A14", fontWeight: 700 }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}
