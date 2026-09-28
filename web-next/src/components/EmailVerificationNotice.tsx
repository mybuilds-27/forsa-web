"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/lib/emailVerificationGate";

type Props = {
  email: string;
};

// مكوّن مشترك بيتعرض بدل أي فيتشر أساسي (نشر وظيفة، تقديم، عرض بيانات تواصل) لو الحساب
// لسه محتاج تأكيد إيميل — شوف lib/emailVerificationGate.ts لمنطق تحديد مين محتاج التأكيد ده.
// صندوق بارز بحدود سميكة وخط كبير، وجملة "دوّر في الـSpam" في صندوق مستقل ملفت (الإيميل الافتراضي
// من فايربيز كتير بيوصل للسبام)، وزرار إعادة الإرسال تحتها مباشرة.
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
        background: "#FFF3D6",
        border: "2px solid #E8A33D",
        borderRadius: 14,
        padding: "24px 22px",
        textAlign: "center",
        boxShadow: "0 2px 8px rgba(232,163,61,0.25)",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 8 }}>📩</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 10 }}>
        أكد إيميلك الأول عشان تقدر تستخدم حسابك
      </div>
      <div style={{ fontSize: 15, color: "#37414F", lineHeight: 1.9, marginBottom: 14 }}>
        بعتنالك إيميل تأكيد على{" "}
        {email ? (
          <strong
            dir="ltr"
            style={{
              display: "inline-block",
              background: "#fff",
              border: "1px solid #E8A33D66",
              borderRadius: 6,
              padding: "0 8px",
              wordBreak: "break-all",
            }}
          >
            {email}
          </strong>
        ) : (
          "إيميلك"
        )}{" "}
        — افتحه ودوس على اللينك اللي جواه، وبعدين رجّع افتح الصفحة دي تاني.
      </div>
      <div
        style={{
          background: "#fff",
          border: "1.5px dashed #E8A33D",
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 15,
          fontWeight: 700,
          color: "#8A570D",
          lineHeight: 1.8,
          marginBottom: 14,
        }}
      >
        ⚠️ لو مش لاقي الإيميل في الوارد، دوّر في الـ Spam (الرسائل غير المرغوب فيها)
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={status === "sending"}
        style={{
          padding: "12px 28px",
          fontSize: 15,
          fontWeight: 800,
          border: "none",
          background: "#E8A33D",
          color: "#14213D",
          borderRadius: 10,
          cursor: status === "sending" ? "wait" : "pointer",
          opacity: status === "sending" ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        {status === "sending" ? "جاري الإرسال..." : "📤 إعادة إرسال اللينك"}
      </button>
      {status === "sent" && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(47,111,78,0.12)",
            fontSize: 14,
            color: "#2F6F4E",
            fontWeight: 700,
          }}
        >
          ✓ اتبعت لينك جديد على إيميلك — دوّر في الـ Spam برضه
        </div>
      )}
      {status === "error" && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(176,58,20,0.08)",
            fontSize: 14,
            color: "#B03A14",
            fontWeight: 700,
          }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  );
}
