"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { checkEmailVerificationGate, resendVerificationEmail } from "@/lib/emailVerificationGate";

// بانر صغير أعلى /seeker و/employer للحساب اللي سجّل بإيميل ولسه ماأكدش — بيستخدم نفس
// checkEmailVerificationGate اللي بيقرر EmailVerificationNotice (مين محتاج تأكيد: users/{uid}.
// requiresEmailVerification === true + emailVerified لسه false بعد reload)، فحسابات التليفون
// وجوجل والحسابات القديمة مبتظهرلهاش خالص. من غير زرار قفل: بيختفي لوحده أول ما الإيميل يتأكد.
export default function EmailVerificationBanner() {
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) return;
      try {
        const result = await checkEmailVerificationGate();
        if (!cancelled && result.blocked) setEmail(result.email);
      } catch (err) {
        console.error("[EmailVerificationBanner] فشل فحص تأكيد الإيميل", err);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

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

  if (email === null) return null;

  return (
    <div
      dir="rtl"
      style={{
        background: "#FFF3D6",
        border: "1px solid #E8A33D",
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
        fontSize: 13.5,
        color: "#14213D",
        lineHeight: 1.7,
      }}
    >
      <span>
        📩 بعتنالك إيميل تأكيد على{" "}
        {email ? (
          <strong dir="ltr" style={{ display: "inline-block", wordBreak: "break-all" }}>
            {email}
          </strong>
        ) : (
          "إيميلك"
        )}{" "}
        — لو مش لاقيه دوّر في الـ Spam
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={status === "sending"}
          style={{
            padding: "6px 14px",
            fontSize: 13,
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
          {status === "sending" ? "جاري الإرسال..." : "إعادة إرسال"}
        </button>
        {status === "sent" && <span style={{ fontSize: 12.5, color: "#2F6F4E", fontWeight: 700 }}>✓ اتبعت لينك جديد</span>}
        {status === "error" && <span style={{ fontSize: 12.5, color: "#B03A14", fontWeight: 700 }}>{errorMsg}</span>}
      </span>
    </div>
  );
}
