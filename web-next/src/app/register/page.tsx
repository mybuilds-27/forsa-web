"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import RegisterForm, { Role } from "@/components/RegisterForm";
import LogoMark from "@/components/LogoMark";
import { logFunnelEvent } from "@/lib/registrationFunnel";

// نفس المفتاح المستخدم جوه RegisterForm.tsx وقت signInWithRedirect — لو موجود، معناه
// المستخدم راجع لتوّه من ريدايركت جوجل، فـRegisterForm هو المسؤول عن استكمال التسجيل
// والتوجيه بنفسه (getRedirectResult effect بتاعته)، مش الفحص هنا.
const PENDING_ROLE_STORAGE_KEY = "elshoghl_pending_auth_role";

// نفس القايمة المستخدمة في Navbar.tsx وRegisterForm.tsx وadmin/page.tsx لتحديد حساب الأدمن
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

const COLORS = { ink: "#14213D" };

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
          <p>جاري التحميل...</p>
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ?role=employer بيخلي التوجل مظبوط على "صاحب عمل" من البداية (مفيد لو جاي من زرار
  // "بتدوّر على موظفين؟")، وأي حاجة تانية (أو من غيره خالص) بترجع لـ"باحث عن شغل" كافتراضي.
  const [role, setRole] = useState<Role>(() =>
    searchParams.get("role") === "employer" ? "employer" : "job_seeker"
  );
  const [checkingSession, setCheckingSession] = useState(true);

  // بيحدّث الـURL (من غير navigation كاملة) كل ما المستخدم يدوس على التوجل، عشان اللينك
  // فوق يفضل عاكس الاختيار الفعلي دايمًا — التسجيل نفسه بيعتمد على state role مش على
  // اللينك، بس سيبه قديم كان مربك بصريًا (?role=employer فاضل مكتوب رغم اختيار باحث شغل).
  function selectRole(newRole: Role) {
    setRole(newRole);
    (window as any).fbq?.("trackCustom", "SelectAccountType", { type: newRole });
    logFunnelEvent("role_selected", newRole);
    const params = new URLSearchParams(searchParams.toString());
    if (newRole === "employer") params.set("role", "employer");
    else params.delete("role");
    const qs = params.toString();
    router.replace(qs ? `/register?${qs}` : "/register", { scroll: false });
  }

  // لو المستخدم مسجل دخول بالفعل وفتح /register، ميشوفش شاشة التسجيل تاني — نوجّهه لمكانه
  // المناسب. الفحص ده بيتعمل مرة واحدة بس عند تحميل الصفحة (unsubscribe فورًا بعد أول
  // استدعاء) عشان منسابقش RegisterForm في توجيهه هو بعد تسجيل دخول جديد فعلي من نفس الصفحة.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user || localStorage.getItem(PENDING_ROLE_STORAGE_KEY)) {
        setCheckingSession(false);
        return;
      }
      if (ADMIN_EMAILS.includes(user.email || "")) {
        router.replace("/admin");
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const type = userDoc.exists() ? userDoc.data().userType : null;
        router.replace(type === "employer" ? "/employer" : "/seeker");
      } catch (err) {
        console.error("[RegisterPage] فشل التحقق من جلسة المستخدم الحالية", err);
        setCheckingSession(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  function handleSuccess(selectedRole: Role) {
    router.push(selectedRole === "job_seeker" ? "/seeker" : "/employer");
  }

  if (checkingSession) {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ maxWidth: 440, margin: "0 auto", padding: "40px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <LogoMark size={44} />
          <span style={{ fontFamily: "var(--font-cairo)", fontSize: 24, fontWeight: 800, color: COLORS.ink }}>
            الشغل
          </span>
        </div>
        <h1 style={{ fontSize: 21, color: COLORS.ink, marginBottom: 6, fontFamily: "var(--font-cairo)" }}>
          سجّل حسابك في أقل من دقيقة
        </h1>
      </div>

      <RegisterForm role={role} onRoleChange={selectRole} onSuccess={handleSuccess} />
    </div>
  );
}
