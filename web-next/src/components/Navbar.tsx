"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import NotificationBell from "./NotificationBell";
import LogoMark from "./LogoMark";

const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

// أقل فترة بين تحديثين لـlastActiveAt لنفس المستخدم — عشان مكتبش على Firestore في كل تحميل
// صفحة، ده بيحصل مرة كل ساعة كحد أقصى لكل مستخدم بدل كل صفحة يفتحها.
const ACTIVITY_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [userType, setUserType] = useState<"job_seeker" | "employer" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userLabel, setUserLabel] = useState("");
  const [employerPlan, setEmployerPlan] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // null يعني "لسه معرفناش" (مش باحث عن عمل أصلًا، أو لسه بيحمّل) — مبيظهرش أي شارة في
  // الحالة دي، بس لو رقم فعلي وأقل من 100 هيظهر تنبيه الاستكمال.
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;
    let unsubscribeEmployerDoc: (() => void) | null = null;
    let unsubscribeSeekerDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeUserDoc?.();
      unsubscribeUserDoc = null;
      unsubscribeEmployerDoc?.();
      unsubscribeEmployerDoc = null;
      unsubscribeSeekerDoc?.();
      unsubscribeSeekerDoc = null;

      if (!user) {
        setSignedIn(false);
        setUserType(null);
        setIsAdmin(false);
        setEmployerPlan(null);
        setProfileCompletion(null);
        return;
      }
      setSignedIn(true);
      setUserLabel(user.displayName || user.email || user.phoneNumber || "");
      setIsAdmin(ADMIN_EMAILS.includes(user.email || ""));

      // onSnapshot بدل getDoc (قراءة لمرة واحدة) — أول تسجيل دخول بيكتب users/{uid} من
      // routeAfterAuth في page.tsx بالتوازي مع الاستماع ده، ولو الهيدر قرا قبل ما الكتابة
      // تخلص كان بيتجمّد على النتيجة القديمة (أو الفاضية) لحد ما حد يعمل ريفريش يدوي —
      // بالـonSnapshot أي تحديث لاحق للمستند بيوصل الهيدر أوتوماتيك من غير ريفريش خالص.
      unsubscribeUserDoc = onSnapshot(
        doc(db, "users", user.uid),
        (userDoc) => {
          const type = userDoc.exists() ? userDoc.data().userType || null : null;
          setUserType(type);

          // تحديث lastActiveAt لإحصائيات "المستخدمين النشطين" في لوحة الأدمن — بنستخدم نفس
          // الـsnapshot المشترك ده بدل قراءة إضافية، وبنحدّث بس لو آخر تحديث أقدم من ساعة
          // (أو أول مرة)، عشان منكتبش على Firestore في كل تحميل صفحة. لو المستند لسه ماتكتبش
          // (سباق مع routeAfterAuth وقت أول تسجيل دخول) بنسيب الموضوع للـsnapshot الجاي.
          if (userDoc.exists()) {
            const lastActiveAt = userDoc.data().lastActiveAt as Timestamp | undefined;
            if (!lastActiveAt || Date.now() - lastActiveAt.toMillis() > ACTIVITY_UPDATE_INTERVAL_MS) {
              updateDoc(doc(db, "users", user.uid), { lastActiveAt: serverTimestamp() }).catch((err) => {
                console.error("[Navbar] فشل تحديث lastActiveAt", err);
              });
            }
          }

          unsubscribeEmployerDoc?.();
          unsubscribeEmployerDoc = null;
          unsubscribeSeekerDoc?.();
          unsubscribeSeekerDoc = null;

          if (type === "employer") {
            unsubscribeEmployerDoc = onSnapshot(
              doc(db, "employers", user.uid),
              (employerDoc) => {
                setEmployerPlan(employerDoc.exists() ? employerDoc.data().plan || "free" : "free");
              },
              (err) => {
                console.error("[Navbar] فشل قراءة employers/{uid} لمعرفة الباقة", err);
              }
            );
          } else {
            setEmployerPlan(null);
          }

          // نفس onSnapshot المشترك اللي بيحدد نوع الحساب — بيضيف قراءة job_seekers/{uid} بس
          // لباحث عن شغل، عشان نحسب نسبة اكتمال البروفايل ونعرض تنبيه استكمال دائم في كل
          // صفحات الموقع (مش مربوط بصفحة /seeker بس)، من غير ما نزوّد useEffect منفصل.
          if (type === "job_seeker") {
            unsubscribeSeekerDoc = onSnapshot(
              doc(db, "job_seekers", user.uid),
              (seekerDoc) => {
                setProfileCompletion(calculateProfileCompletion(seekerDoc.exists() ? seekerDoc.data() : null));
              },
              (err) => {
                console.error("[Navbar] فشل قراءة job_seekers/{uid} لحساب نسبة اكتمال البروفايل", err);
              }
            );
          } else {
            setProfileCompletion(null);
          }
        },
        (err) => {
          console.error("[Navbar] فشل قراءة users/{uid} لمعرفة نوع الحساب", err);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUserDoc?.();
      unsubscribeEmployerDoc?.();
      unsubscribeSeekerDoc?.();
    };
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/");
  }

  const isPremium = employerPlan === "premium";

  // الهيدر لازم يعكس الصفحة اللي المستخدم واقف فيها دلوقتي، مش آخر دور سجّل بيه دخول —
  // لأن نفس الحساب ممكن يكون عنده بروفايل صاحب عمل وبروفايل باحث عن شغل في نفس الوقت
  // /companies صفحة محايدة: بتقبل عناصر الطرفين (صاحب عمل وباحث) حسب مين الداخل
  const isSeekerContext = pathname.startsWith("/seeker");
  const isEmployerContext = pathname.startsWith("/employer") || pathname.startsWith("/admin");

  const showSeekerItems = userType === "job_seeker" && !isEmployerContext;
  const showEmployerItems = userType === "employer" && !isSeekerContext;
  const showAdminLink = isAdmin && !isSeekerContext;

  return (
    <nav
      dir="rtl"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        padding: "12px 20px",
        borderBottom: "1px solid #14213D22",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Link href="/" style={brandLinkStyle}>
          <LogoMark size={32} />
          <span style={brandTextStyle}>الشغل</span>
        </Link>
        {showSeekerItems && (
          <>
            <Link href="/seeker?tab=jobs" style={linkStyle}>🏠 تصفح الوظائف</Link>
            <Link href="/seeker?tab=saved" style={linkStyle}>🔖 الوظائف المحفوظة</Link>
            <Link href="/seeker?tab=profile" style={linkStyle}>👤 بروفايلي</Link>
          </>
        )}
        {/* مش مربوطة بـshowSeekerItems (يعني مش مقتصرة على صفحات الباحث) — لازم تفضل ظاهرة
            في كل صفحات الموقع طول ما الباحث لسه بروفايله ناقص، وتختفي تلقائيًا لو وصل 100%. */}
        {userType === "job_seeker" && profileCompletion !== null && profileCompletion < 100 && (
          <Link href="/seeker?tab=profile" style={profileNudgeStyle}>
            ⚠️ بياناتك {profileCompletion}% مكتملة — كمّل دلوقتي
          </Link>
        )}
        {showEmployerItems && (
          <span style={isPremium ? premiumBadgeStyle : freeBadgeStyle}>
            {isPremium ? "⭐ الباقة المدفوعة" : "الباقة المجانية"}
          </span>
        )}
        {showEmployerItems && (
          <>
            <Link href="/employer?tab=company" style={linkStyle}>🏠 لوحة الشركة</Link>
            <Link href="/employer?tab=postjob" style={linkStyle}>📝 نشر وظيفة جديدة</Link>
            <Link href="/employer?tab=talent" style={linkStyle}>🔍 البحث عن كوادر</Link>
          </>
        )}
        <Link href="/jobs" style={linkStyle}>💼 الوظائف</Link>
        <Link href="/companies" style={linkStyle}>🏛️ الشركات</Link>
        {showAdminLink && <Link href="/admin" style={linkStyle}>📊 لوحة الإدارة</Link>}
        {signedIn && <NotificationBell />}
      </div>

      {signedIn && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#4A5568" }}>{userLabel}</span>
          <button onClick={handleSignOut} style={signOutStyle}>خروج</button>
        </div>
      )}

      {/* زراير الدخول للزوار مش المسجلين — منقولة من هيدر page.tsx القديم عشان منعملش هيدرين
          فوق بعض على الصفحة الرئيسية. */}
      {!signedIn && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Link href="/register?role=employer" style={employerCtaStyle}>سجّل بشركتك</Link>
          <Link href="/register" style={seekerCtaStyle}>سجل كباحث عن شغل</Link>
        </div>
      )}
    </nav>
  );
}

const brandLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
  marginLeft: 6,
};

const brandTextStyle: React.CSSProperties = {
  fontFamily: "var(--font-cairo)",
  fontSize: 17,
  fontWeight: 800,
  color: "#14213D",
};

export const linkStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  textDecoration: "none",
  color: "#14213D",
  fontSize: 14,
  fontWeight: 600,
  border: "1px solid #14213D22",
};

const profileNudgeStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  textDecoration: "none",
  color: "#8A570D",
  background: "rgba(232,163,61,0.2)",
  border: "1px solid #E8A33D",
  fontSize: 13,
  fontWeight: 700,
};

const freeBadgeStyle: React.CSSProperties = { fontSize: 12, background: "#F0EDE3", padding: "3px 10px", borderRadius: 999, fontWeight: 700 };
const premiumBadgeStyle: React.CSSProperties = { fontSize: 12, background: "rgba(232,163,61,0.2)", padding: "3px 10px", borderRadius: 999, fontWeight: 700, color: "#8A570D" };

const signOutStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "1px solid #B03A14",
  color: "#B03A14",
  background: "transparent",
  fontSize: 13,
  cursor: "pointer",
};

const employerCtaStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "1.5px solid #14213D",
  color: "#14213D",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
};

const seekerCtaStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  border: "none",
  background: "#B03A14",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
};
