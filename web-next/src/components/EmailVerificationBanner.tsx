"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { checkEmailVerificationGate, resendVerificationEmail } from "@/lib/emailVerificationGate";
import type { CopyAudience } from "@/lib/errorMessages";

// النصوص بس اللي بتختلف بين الجمهورين (شوف CopyAudience) — الشكل والمنطق واحد. afterEmail هو
// الفاصل اللي بعد الإيميل (مسافة قبل "—" عند الباحث، ولا حاجة قبل النقطة عند صاحب العمل).
const COPY: Record<CopyAudience, {
  sentPrefix: string;
  emailFallback: string;
  afterEmail: string;
  sentSuffix: string;
  sending: string;
  resend: string;
  sent: string;
  error: string;
}> = {
  seeker: {
    sentPrefix: "📩 بعتنالك إيميل تأكيد على",
    emailFallback: "إيميلك",
    afterEmail: " ",
    sentSuffix: "— لو مش لاقيه دوّر في الـ Spam",
    sending: "جاري الإرسال...",
    resend: "إعادة إرسال",
    sent: "✓ اتبعت لينك جديد",
    error: "حصلت مشكلة، حاول تاني",
  },
  employer: {
    sentPrefix: "أرسلنا رسالة تأكيد إلى",
    emailFallback: "بريدك الإلكتروني",
    afterEmail: "",
    sentSuffix: ". إذا لم تجدها، تحقق من مجلد Spam.",
    sending: "جارٍ الإرسال...",
    resend: "إعادة إرسال",
    sent: "تم إرسال رابط جديد",
    error: "تعذّر الإرسال. حاول مرة أخرى.",
  },
};

// بانر صغير أعلى /seeker و/employer للحساب اللي سجّل بإيميل ولسه ماأكدش — بيستخدم نفس
// checkEmailVerificationGate اللي بيقرر EmailVerificationNotice (مين محتاج تأكيد: users/{uid}.
// requiresEmailVerification === true + emailVerified لسه false بعد reload)، فحسابات التليفون
// وجوجل والحسابات القديمة مبتظهرلهاش خالص. من غير زرار قفل: بيختفي لوحده أول ما الإيميل يتأكد.
// audience الافتراضي "seeker" (النص الأصلي)؛ /employer بيمرّر "employer".
export default function EmailVerificationBanner({ audience = "seeker" }: { audience?: CopyAudience } = {}) {
  const copy = COPY[audience];
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
    const result = await resendVerificationEmail(audience);
    if (result.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorMsg(result.error || copy.error);
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
        {copy.sentPrefix}{" "}
        {email ? (
          <strong dir="ltr" style={{ display: "inline-block", wordBreak: "break-all" }}>
            {email}
          </strong>
        ) : (
          copy.emailFallback
        )}
        {copy.afterEmail}
        {copy.sentSuffix}
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
          {status === "sending" ? copy.sending : copy.resend}
        </button>
        {status === "sent" && <span style={{ fontSize: 12.5, color: "#2F6F4E", fontWeight: 700 }}>{copy.sent}</span>}
        {status === "error" && <span style={{ fontSize: 12.5, color: "#B03A14", fontWeight: 700 }}>{errorMsg}</span>}
      </span>
    </div>
  );
}
