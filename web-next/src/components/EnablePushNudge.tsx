"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { enablePushNotifications } from "@/lib/pushNotifications";
import { shouldShowPushNudge, dismissPushNudgeForSession } from "@/lib/pushNudge";

// بيتعرض من Navbar.tsx (نفس نمط EnableNotificationsButton.tsx — مفيش props خالص، بيتابع
// حالة الدخول بنفسه) لأي مستخدم مسجّل دخول طول ما الإذن لسه "default"، بغض النظر عن أي
// حدث معيّن — شوف shouldShowPushNudge في lib/pushNudge.ts. بيظهر مرة واحدة بس لكل فتحة
// موقع (تاب/جلسة جديدة، مش كل تنقّل SPA لأن Navbar نفسها ما بتتعملهاش remount بينهم)، وبيقفل
// لباقي نفس الجلسة بمجرد أي تفاعل. زرار "فعّل التنبيهات" بينادي enablePushNotifications
// مباشرة من غير عرض تفاصيل خطأ هنا لو فشلت — زرار EnableNotificationsButton الدائم في
// الـNavbar أصلًا بيغطي إعادة المحاولة وتفاصيل الخطأ بالكامل.
export default function EnablePushNudge() {
  const [uid, setUid] = useState<string | null>(null);
  // قراءة أولية بس وقت أول render — بتحدد "هل نظهر النهاردة" مرة واحدة، مش بتتغيّر تاني
  // لوحدها بعد كده (القفل بيحصل عبر setVisible صراحةً).
  const [visible, setVisible] = useState(() => shouldShowPushNudge());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setUid(user ? user.uid : null));
    return () => unsubscribe();
  }, []);

  if (!uid || !visible) return null;

  function dismiss() {
    dismissPushNudgeForSession();
    setVisible(false);
  }

  async function handleEnable() {
    setLoading(true);
    try {
      await enablePushNotifications(uid!);
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

        <h2 style={{ marginBottom: 6, fontSize: 19 }}>🔔 عايز توصلك التحديثات فورًا؟</h2>
        <p style={{ color: "#4A5568", fontSize: 13.5, lineHeight: 1.7, marginBottom: 20 }}>
          فعّل التنبيهات عشان توصلك رسالة فورية أول ما حد يرد على تقديمك، يقدّم على وظيفتك، أو
          تلاقي وظيفة جديدة تناسبك.
        </p>

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
