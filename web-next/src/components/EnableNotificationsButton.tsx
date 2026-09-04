"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { enablePushNotifications, isIOS, isPushSupported, isStandalone } from "@/lib/pushNotifications";

// نفس COLORS.ink المستخدمة في مكونات تانية بالموقع (RegisterForm.tsx وغيرها).
const INK_COLOR = "#14213D";

// بيظهر جنب NotificationBell (Navbar.tsx) بس لمستخدم مسجّل دخول، وبس لو الإذن لسه معندهوش
// قرار ("default" — مش اتوافق عليه ولا اترفض). بيختفي تمامًا لو المستخدم رفض قبل كده أو
// وافق بالفعل — مفيش أي إلحاح متكرر.
export default function EnableNotificationsButton() {
  const [uid, setUid] = useState<string | null>(null);
  // قراءة أولية بس لحالة إذن حالية أصلًا في المتصفح — من غير useEffect لأنها مش "subscription"
  // لحاجة بتتغيّر لوحدها، بس قيمة خارجية بنقرأها مرة واحدة وقت أول render.
  const [permission, setPermission] = useState<NotificationPermission | null>(() =>
    isPushSupported() ? Notification.permission : null
  );
  const [loading, setLoading] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setUid(user ? user.uid : null));
    return () => unsubscribe();
  }, []);

  if (!uid) return null;

  // على آيفون مش مثبّت، الـAPIs دي أصلًا مش موثوقة نعتمد عليها قبل التثبيت — بنعرض الزرار
  // بغض النظر عن isPushSupported/permission، وبدل ما نحاول نطلب إذن هيفشل صامت، بنوري
  // تلميح يوضّح شرط التثبيت الأول.
  const iosNotInstalled = isIOS() && !isStandalone();
  if (!iosNotInstalled && (!isPushSupported() || permission !== "default")) {
    return null;
  }

  async function handleClick() {
    if (iosNotInstalled) {
      setShowIOSHint((v) => !v);
      return;
    }
    setLoading(true);
    const result = await enablePushNotifications(uid!);
    setPermission(result);
    setLoading(false);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* نص ظاهر دايمًا بدل الاعتماد على title (tooltip) بس — الـtooltip مبيبانش خالص على
          الموبايل باللمس، وده أهم استخدام متوقع للزرار ده. نفس أسلوب باقي أزرار الـNavbar
          (أيقونة + نص، زي "🏠 لوحة الشركة") عشان يبان واضح إنه مختلف عن جرس الإشعارات. */}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "none",
          border: `1px solid ${INK_COLOR}22`,
          borderRadius: 6,
          padding: "6px 10px",
          cursor: loading ? "wait" : "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: INK_COLOR,
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
        title="فعّل التنبيهات"
        aria-label="فعّل التنبيهات"
      >
        🔔 فعّل التنبيهات
      </button>
      {showIOSHint && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            insetInlineEnd: 0,
            marginTop: 6,
            width: 230,
            background: "#fff",
            border: `1px solid ${INK_COLOR}33`,
            borderRadius: 10,
            padding: 12,
            fontSize: 12.5,
            color: INK_COLOR,
            lineHeight: 1.8,
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            zIndex: 50,
          }}
        >
          لتفعيل التنبيهات على الآيفون، ثبّت الموقع الأول: دوس على زرار المشاركة{" "}
          <strong>⬆️</strong> واختار <strong>&quot;إضافة إلى الشاشة الرئيسية&quot;</strong>،
          وبعدين افتح الموقع من الأيقونة.
          <button
            type="button"
            onClick={() => setShowIOSHint(false)}
            style={{
              display: "block",
              marginTop: 8,
              background: "none",
              border: "none",
              textDecoration: "underline",
              color: INK_COLOR,
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
            }}
          >
            تمام
          </button>
        </div>
      )}
    </div>
  );
}
