"use client";

import { useState } from "react";
import { markPushNudgeSeen } from "@/lib/pushNudge";
import { enablePushNotifications } from "@/lib/pushNotifications";

type Role = "job_seeker" | "employer";

type Props = {
  role: Role;
  uid: string;
  onClose: () => void;
};

const CONTENT: Record<Role, { title: string; body: string }> = {
  job_seeker: {
    title: "🔔 عايز تعرف أول ما حد يرد عليك؟",
    body: "فعّل التنبيهات عشان توصلك رسالة فورية أول ما صاحب العمل يقبل أو يرفض تقديمك، أو تلاقي وظيفة جديدة تناسب تخصصك.",
  },
  employer: {
    title: "🔔 عايز تعرف أول ما حد يقدّم على وظيفتك؟",
    body: "فعّل التنبيهات عشان توصلك رسالة فورية أول ما حد جديد يقدّم على الوظيفة اللي نشرتها.",
  },
};

// بيظهر بعد أول تقديم/أول نشر وظيفة ناجح بس (شوف shouldShowPushNudge في lib/pushNudge.ts)،
// ومرة واحدة بس لكل مستخدم على نفس الجهاز/المتصفح بغض النظر عن نتيجة التفاعل. زرار "فعّل
// التنبيهات" بينادي enablePushNotifications مباشرة من غير عرض تفاصيل خطأ هنا لو فشلت —
// زرار EnableNotificationsButton الدائم في الـNavbar أصلًا بيغطي إعادة المحاولة وتفاصيل
// الخطأ بالكامل لو المستخدم حابب يجرّب تاني بعدين.
export default function EnablePushNudge({ role, uid, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const { title, body } = CONTENT[role];

  function dismiss() {
    markPushNudgeSeen();
    onClose();
  }

  async function handleEnable() {
    setLoading(true);
    try {
      await enablePushNotifications(uid);
    } finally {
      dismiss();
    }
  }

  return (
    <div
      onClick={dismiss}
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
          onClick={dismiss}
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

        <h2 style={{ marginBottom: 6, fontSize: 19 }}>{title}</h2>
        <p style={{ color: "#4A5568", fontSize: 13.5, lineHeight: 1.7, marginBottom: 20 }}>{body}</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleEnable}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: "#14213D",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "جاري التفعيل..." : "فعّل التنبيهات"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{ padding: "10px 20px", border: "1px solid #14213D33", color: "#4A5568", background: "transparent", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
          >
            لاحقًا
          </button>
        </div>
      </div>
    </div>
  );
}
