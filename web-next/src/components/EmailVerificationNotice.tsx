"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/lib/emailVerificationGate";
import type { CopyAudience } from "@/lib/errorMessages";

type Props = {
  email: string;
  // الافتراضي "seeker" (النص العامي الأصلي زي ما هو). "employer" = نسخة "بساطة مهنية" من غير إيموجي
  // لصفحات صاحب العمل بس.
  audience?: CopyAudience;
};

// النصوص بس اللي بتختلف بين الجمهورين — الشكل والمنطق واحد. afterEmail هو الفاصل اللي بعد الإيميل
// (مسافة في نسخة الباحث قبل "—"، ولا حاجة في نسخة صاحب العمل قبل النقطة).
const COPY: Record<CopyAudience, {
  icon: string | null;
  title: string;
  sentPrefix: string;
  emailFallback: string;
  afterEmail: string;
  sentSuffix: string;
  spamHint: string;
  sending: string;
  resend: string;
  sent: string;
  error: string;
}> = {
  seeker: {
    icon: "📩",
    title: "أكد إيميلك الأول عشان تقدر تستخدم حسابك",
    sentPrefix: "بعتنالك إيميل تأكيد على",
    emailFallback: "إيميلك",
    afterEmail: " ",
    sentSuffix: "— افتحه ودوس على اللينك اللي جواه، وبعدين رجّع افتح الصفحة دي تاني.",
    spamHint: "⚠️ لو مش لاقي الإيميل في الوارد، دوّر في الـ Spam (الرسائل غير المرغوب فيها)",
    sending: "جاري الإرسال...",
    resend: "📤 إعادة إرسال اللينك",
    sent: "✓ اتبعت لينك جديد على إيميلك — دوّر في الـ Spam برضه",
    error: "حصلت مشكلة، حاول تاني",
  },
  employer: {
    icon: null,
    title: "يرجى تأكيد بريدك الإلكتروني أولًا لاستخدام حسابك",
    sentPrefix: "أرسلنا رسالة تأكيد إلى",
    emailFallback: "بريدك الإلكتروني",
    afterEmail: "",
    sentSuffix: ". افتح الرسالة واضغط على الرابط بداخلها، ثم أعد فتح هذه الصفحة.",
    spamHint: "إذا لم تجد الرسالة في صندوق الوارد، تحقق من مجلد الرسائل غير المرغوب فيها (Spam).",
    sending: "جارٍ الإرسال...",
    resend: "إعادة إرسال الرابط",
    sent: "تم إرسال رابط جديد إلى بريدك الإلكتروني. تحقق من مجلد Spam أيضًا.",
    error: "تعذّر الإرسال. حاول مرة أخرى.",
  },
};

// مكوّن مشترك بيتعرض بدل أي فيتشر أساسي (نشر وظيفة، تقديم، عرض بيانات تواصل) لو الحساب
// لسه محتاج تأكيد إيميل — شوف lib/emailVerificationGate.ts لمنطق تحديد مين محتاج التأكيد ده.
// صندوق بارز بحدود سميكة وخط كبير، وجملة "دوّر في الـSpam" في صندوق مستقل ملفت (الإيميل الافتراضي
// من فايربيز كتير بيوصل للسبام)، وزرار إعادة الإرسال تحتها مباشرة.
export default function EmailVerificationNotice({ email, audience = "seeker" }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const copy = COPY[audience];

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
      {copy.icon && <div style={{ fontSize: 40, marginBottom: 8 }}>{copy.icon}</div>}
      <div style={{ fontSize: 19, fontWeight: 800, color: "#14213D", marginBottom: 10 }}>
        {copy.title}
      </div>
      <div style={{ fontSize: 15, color: "#37414F", lineHeight: 1.9, marginBottom: 14 }}>
        {copy.sentPrefix}{" "}
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
          copy.emailFallback
        )}
        {copy.afterEmail}
        {copy.sentSuffix}
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
        {copy.spamHint}
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
        {status === "sending" ? copy.sending : copy.resend}
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
          {copy.sent}
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
