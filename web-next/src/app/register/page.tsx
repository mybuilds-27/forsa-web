"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";
import { normalizeEgyptianPhone } from "@/lib/phoneAuth";
import { logClientError } from "@/lib/errorLog";
import LogoMark from "@/components/LogoMark";

type Role = "job_seeker" | "employer";

// بيتخزّن قبل signInWithRedirect عشان نعرف نكمّل التسجيل بيه لما المستخدم يرجع من جوجل —
// نفس المفتاح المستخدم في page.tsx، آمن لأن فلو واحد بس بيكون شغال في نفس الوقت لكل تاب.
const PENDING_ROLE_STORAGE_KEY = "elshoghl_pending_auth_role";

// نفس القايمة المستخدمة في Navbar.tsx وpage.tsx وadmin/page.tsx لتحديد حساب الأدمن
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

const COLORS = {
  ink: "#14213D",
  inkSoft: "#4A5568",
  paper: "#FAF6EC",
  stamp: "#B03A14",
  success: "#2F6F4E",
};

// نفس منطق كشف WebView الموجود في page.tsx — جوجل بيرفض/بيعقّد الـOAuth من جوه WebViews
// بتاعة فيسبوك/إنستجرام، فبنحذّر المستخدم يفتح الرابط في متصفح حقيقي بدل ما يتفاجئ بفشل صامت.
function isInAppWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram/i.test(navigator.userAgent || "");
}

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
  const [isWebView, setIsWebView] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setIsWebView(isInAppWebView());
  }, []);

  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorColor, setErrorColor] = useState(COLORS.stamp);
  const [googleLoading, setGoogleLoading] = useState(false);

  // مفيش خطوة "idle" — حقول الاسم ورقم الموبايل ظاهرة على طول تحت "أو" من غير ما يحتاج
  // المستخدم يدوس على أي رابط الأول.
  const [phoneStep, setPhoneStep] = useState<"enter-phone" | "enter-code">("enter-phone");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  // true من لحظة ما أي محاولة تسجيل جديدة تبدأ لحد ما routeAfterAuth بتاعتها يخلص أو يفشل —
  // عشان useEffect "لو مسجل دخول بالفعل" تحت ميعملش توجيه مستقل بيسابق routeAfterAuth.
  const authInProgressRef = useRef(false);

  // لما signInWithPopup يفشل (شائع جوه WebView) بنعمل fallback لـsignInWithRedirect، اللي
  // بيودّي المستخدم لجوجل وبيرجّعه لنفس الصفحة بعد ما يسجّل دخول.
  useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!result) return;
        const storedRole = localStorage.getItem(PENDING_ROLE_STORAGE_KEY) as Role | null;
        localStorage.removeItem(PENDING_ROLE_STORAGE_KEY);
        if (storedRole) {
          await routeAfterAuth(storedRole);
        }
      } catch (err: any) {
        console.error("Google redirect result failed", err);
        logClientError("google_redirect_result", err);
        setErrorColor(COLORS.stamp);
        setError("حصلت مشكلة في تسجيل الدخول بجوجل، جرب طريقة تانية");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // لو المستخدم مسجل دخول بالفعل وفتح /register، ميشوفش شاشة التسجيل تاني — نوجّهه لمكانه
  // المناسب زي ما بيحصل في page.tsx.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || localStorage.getItem(PENDING_ROLE_STORAGE_KEY) || authInProgressRef.current) {
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

  // displayNameOverride بيتبعت بس من فلو التليفون — مصادقة فايربيز بالتليفون معندهاش
  // displayName خالص، فبنستخدم اسم كتبه المستخدم بنفسه في حقل "الاسم بالكامل" بدلًا منه.
  async function routeAfterAuth(selectedRole: Role, displayNameOverride?: string) {
    const user = auth.currentUser;
    if (!user) return;

    // لازم نفحص الأدمن هنا كمان قبل أي حاجة، مش بس في effect "مسجل دخول بالفعل" — لأن
    // routeAfterAuth هي أول حاجة بتتنفذ فورًا بعد أي تسجيل دخول جديد.
    if (ADMIN_EMAILS.includes(user.email || "")) {
      router.push("/admin");
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayName: displayNameOverride || user.displayName,
        photoURL: user.photoURL,
        userType: selectedRole,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    } else {
      const data = snap.data();
      if (selectedRole !== data.userType) {
        await updateDoc(userRef, { userType: selectedRole });
      }
      await updateDoc(userRef, { lastLogin: serverTimestamp() });
    }

    if (selectedRole === "job_seeker") {
      router.push("/seeker");
    } else {
      router.push("/employer");
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    authInProgressRef.current = true;
    (window as any).fbq?.("trackCustom", "SelectSignupMethod", { method: "google" });
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      await routeAfterAuth(role);
      authInProgressRef.current = false;
    } catch (err: any) {
      console.warn("popup failed, falling back to redirect", err);
      logClientError("google_popup_signin", err);
      try {
        localStorage.setItem(PENDING_ROLE_STORAGE_KEY, role);
        await signInWithRedirect(auth, provider);
        // لو نجحت، المتصفح هيتنقل فعليًا لجوجل بره الصفحة دي — الصفحة هتتحمّل من جديد لما
        // المستخدم يرجع، فمفيش داعي نصفّر الـref هنا.
      } catch (err2: any) {
        console.error("Google redirect fallback failed", err2);
        logClientError("google_redirect_signin", err2);
        localStorage.removeItem(PENDING_ROLE_STORAGE_KEY);
        authInProgressRef.current = false;
        setError("حصلت مشكلة في تسجيل الدخول بجوجل، جرب طريقة تانية (إيميل أو تليفون)");
        setGoogleLoading(false);
      }
    }
  }

  function openEmailAuth() {
    setError("");
    setEmailPanelOpen(true);
    (window as any).fbq?.("trackCustom", "SelectSignupMethod", { method: "email" });
  }

  function closeEmailAuth() {
    setEmailPanelOpen(false);
    setEmail("");
    setPassword("");
    setError("");
  }

  function emailAuthErrorMessage(err: any): string {
    const map: Record<string, string> = {
      "auth/email-already-in-use": 'الإيميل ده متسجل بالفعل — جرب "دخول" بدل "إنشاء حساب"',
      "auth/invalid-email": "صيغة الإيميل مش صحيحة",
      "auth/weak-password": "الباسورد لازم يكون 6 أحرف على الأقل",
      "auth/wrong-password": "الباسورد غلط",
      "auth/user-not-found": "مفيش حساب مسجل بالإيميل ده",
      "auth/invalid-credential": "الإيميل أو الباسورد غلط",
      "auth/missing-password": "اكتب الباسورد",
      "auth/network-request-failed": "تأكد من اتصال الإنترنت وحاول تاني",
    };
    return map[err?.code] || "حصلت مشكلة، حاول تاني";
  }

  async function handleEmailSignUp() {
    setError("");
    setErrorColor(COLORS.stamp);
    setEmailSaving(true);
    authInProgressRef.current = true;
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      closeEmailAuth();
      await routeAfterAuth(role);
    } catch (err: any) {
      console.error("Email sign up failed", err);
      logClientError("email_signup", err);
      setError(emailAuthErrorMessage(err));
    } finally {
      authInProgressRef.current = false;
      setEmailSaving(false);
    }
  }

  async function handleEmailLogin() {
    setError("");
    setErrorColor(COLORS.stamp);
    setEmailSaving(true);
    authInProgressRef.current = true;
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      closeEmailAuth();
      await routeAfterAuth(role);
    } catch (err: any) {
      console.error("Email login failed", err);
      logClientError("email_login", err);
      setError(emailAuthErrorMessage(err));
    } finally {
      authInProgressRef.current = false;
      setEmailSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setErrorColor(COLORS.stamp);
      setError('اكتب إيميلك في الحقل فوق الأول، وبعدين دوس "نسيت الباسورد؟"');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setErrorColor(COLORS.success);
      setError("اتبعتلك لينك إعادة تعيين الباسورد على إيميلك");
    } catch (err: any) {
      setErrorColor(COLORS.stamp);
      setError(emailAuthErrorMessage(err));
    }
  }

  function phoneAuthErrorMessage(err: any): string {
    const map: Record<string, string> = {
      "auth/invalid-phone-number": "رقم التليفون مش صحيح",
      "auth/too-many-requests": "محاولات كتير جدًا — جرب تاني بعد شوية",
      "auth/invalid-verification-code": "كود التحقق غلط",
      "auth/code-expired": "الكود ده انتهت صلاحيته — اطلب كود جديد",
      "auth/quota-exceeded": "الخدمة مش متاحة دلوقتي — جرب تاني لاحقًا",
      "auth/operation-not-allowed": "تسجيل الدخول برقم التليفون لسه مش مفعّل على الموقع",
      "auth/network-request-failed": "تأكد من اتصال الإنترنت وحاول تاني",
    };
    return map[err?.code] || "حصلت مشكلة، حاول تاني";
  }

  // إنشاء الـ reCAPTCHA مرة واحدة بس عند أول استخدام فعلي، عشان نتجنب مشكلة React Strict
  // Mode اللي بتنفذ الـeffects مرتين وتحاول تعمل instance تاني على نفس العنصر.
  function getRecaptchaVerifier(): RecaptchaVerifier {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaVerifierRef.current;
  }

  // مفيش "إلغاء" كامل للتليفون دلوقتي (الحقول ظاهرة على طول، مفيش حاجة تتقفل) — بس لو
  // المستخدم وصل لخطوة الكود وعايز يغيّر الرقم، بيرجّعه لخطوة إدخال الرقم من غير ما يمسح
  // الاسم أو الرقم اللي كتبهم قبل كده.
  function resetPhoneCodeStep() {
    setPhoneStep("enter-phone");
    setOtpCode("");
    setConfirmationResult(null);
    setError("");
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      console.error("Copy link failed", err);
    }
  }

  async function handleSendCode() {
    setError("");
    setErrorColor(COLORS.stamp);
    if (!fullName.trim()) {
      setError("اكتب اسمك بالكامل");
      return;
    }
    const normalized = normalizeEgyptianPhone(phoneNumber.trim());
    if (!normalized) {
      setError("اكتب رقم موبايل مصري صحيح (مثال: 01012345678)");
      return;
    }

    setPhoneLoading(true);

    // بنتأكد الرقم ده مش مرتبط بحساب موجود بالفعل (اتسجل قبل كده بجوجل أو الإيميل) قبل
    // ما نبعت كود التحقق أصلًا — يمنع حساب مزدوج ويوفّر رسالة SMS مش هتتبعت لو الحساب
    // موجود بالفعل. لو الفحص نفسه فشل (مشكلة شبكة مثلًا) بنكمّل عادي وميوقفش التسجيل،
    // لأنه تحقق إضافي مش بوابة أمان أساسية.
    try {
      const checkPhone = httpsCallable(functions, "checkPhoneAlreadyRegistered");
      const result = await checkPhone({ phone: normalized });
      if ((result.data as any)?.alreadyRegistered) {
        setError(
          "الرقم ده متسجل بحساب موجود بالفعل — سجّل دخولك بنفس الطريقة اللي استخدمتها أول مرة (جوجل أو الإيميل) بدل رقم التليفون."
        );
        setPhoneLoading(false);
        return;
      }
    } catch (err) {
      console.error("Phone conflict check failed", err);
      logClientError("phone_conflict_check", err);
    }

    (window as any).fbq?.("trackCustom", "SelectSignupMethod", { method: "phone" });
    try {
      const verifier = getRecaptchaVerifier();
      const result = await signInWithPhoneNumber(auth, normalized, verifier);
      setConfirmationResult(result);
      setPhoneStep("enter-code");
    } catch (err: any) {
      console.error("Send code failed", err);
      logClientError("phone_send_code", err);
      setError(phoneAuthErrorMessage(err));
      // نلغي الـ verifier عشان محاولة تانية تعمل واحد جديد صحيح
      recaptchaVerifierRef.current = null;
    }
    setPhoneLoading(false);
  }

  async function handleVerifyCode() {
    if (!confirmationResult) return;
    setError("");
    setErrorColor(COLORS.stamp);
    setPhoneLoading(true);
    authInProgressRef.current = true;
    try {
      await confirmationResult.confirm(otpCode.trim());
      await routeAfterAuth(role, fullName.trim());
    } catch (err: any) {
      console.error("Verify code failed", err);
      logClientError("phone_verify_code", err);
      setError(phoneAuthErrorMessage(err));
    } finally {
      authInProgressRef.current = false;
    }
    setPhoneLoading(false);
  }

  // الزرار النهائي الأحمر بيتكيّف مع الخطوة الحالية بدل ما يبقى فيه زرار submit منفصل جوه
  // كل قسم. حقول الاسم/التليفون ظاهرة على طول وهي المسار الافتراضي، فبتحكم في الزرار
  // إلا لو المستخدم فتح فورم الإيميل بنفسه (اختيار صريح)، وقتها بياخد الأولوية.
  function finalCta(): { label: string; onClick: () => void; disabled: boolean } {
    if (emailPanelOpen) {
      return { label: "إنشاء حساب مجانًا", onClick: handleEmailSignUp, disabled: emailSaving };
    }
    if (phoneStep === "enter-code") {
      return { label: "إنشاء حساب مجانًا", onClick: handleVerifyCode, disabled: phoneLoading };
    }
    return { label: "ابعتلي كود التحقق", onClick: handleSendCode, disabled: phoneLoading };
  }

  if (checkingSession) {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  const cta = finalCta();

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

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <RoleToggleButton
          active={role === "job_seeker"}
          onClick={() => setRole("job_seeker")}
          icon="🔍"
          label="باحث عن شغل"
        />
        <RoleToggleButton
          active={role === "employer"}
          onClick={() => setRole("employer")}
          icon="🏢"
          label="صاحب عمل"
        />
      </div>

      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <span
          style={{
            display: "inline-block",
            background: "rgba(47,111,78,0.12)",
            color: COLORS.success,
            fontWeight: 700,
            fontSize: 12.5,
            padding: "6px 14px",
            borderRadius: 999,
          }}
        >
          🎉 مجاني بالكامل — لباحثين الشغل وأصحاب الأعمال
        </span>
      </div>

      {isWebView && (
        <div
          style={{
            background: "rgba(232,163,61,0.15)",
            border: "1px solid #E8A33D66",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 18,
            fontSize: 13.5,
            color: COLORS.ink,
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            ⚠️ إنت فاتح الرابط من جوه تطبيق (فيسبوك/إنستجرام)
          </div>
          <div style={{ marginBottom: 10 }}>
            عشان تسجّل بسهولة وأمان، افتح الرابط في متصفحك العادي (كروم أو سفاري): دوس على
            أيقونة الثلات نقط <strong>⋮</strong> فوق يمين الشاشة واختار <strong>"افتح في المتصفح"</strong>.
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            style={{
              background: "#fff",
              border: "1px solid #E8A33D",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 700,
              color: "#8A570D",
              cursor: "pointer",
            }}
          >
            {linkCopied ? "✓ اتنسخ الرابط" : "📋 انسخ رابط الصفحة"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
        <AuthOptionButton onClick={handleGoogleSignIn} disabled={googleLoading} icon={<GoogleIcon />} label="المتابعة بجوجل" />
        {isWebView && (
          <div style={{ fontSize: 12, color: "#8A570D", marginTop: -4 }}>
            ⚠️ ممكن ما يشتغلش صح من جوه التطبيق — الأفضل تفتح الرابط في المتصفح زي فوق، أو
            جرّب الإيميل أو التليفون تحت
          </div>
        )}

        {!emailPanelOpen && (
          <AuthOptionButton onClick={openEmailAuth} icon="✉️" label="المتابعة بالإيميل" />
        )}

        {emailPanelOpen && (
          <div style={{ border: `1px solid ${COLORS.ink}22`, borderRadius: 12, padding: 18, background: "#fff" }}>
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLabelStyle}>الإيميل</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                style={fieldInputStyle}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={fieldLabelStyle}>الباسورد</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                style={fieldInputStyle}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <button type="button" onClick={handlePasswordReset} style={smallLinkStyle}>
                نسيت الباسورد؟
              </button>
              <button type="button" onClick={handleEmailLogin} disabled={emailSaving} style={smallLinkStyle}>
                عندي حساب بالفعل — دخول
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={closeEmailAuth} style={smallLinkStyle}>
                إلغاء
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
          <div style={{ flex: 1, height: 1, background: `${COLORS.ink}22` }} />
          <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>أو</span>
          <div style={{ flex: 1, height: 1, background: `${COLORS.ink}22` }} />
        </div>

        <p style={{ color: COLORS.inkSoft, fontSize: 12.5, lineHeight: 1.8, margin: 0 }}>
          ⚠️ لو سجّلت قبل كده بجوجل أو الإيميل، استخدم نفس الطريقة دي تاني بدل رقم التليفون —
          كل طريقة دخول بتعمل حساب منفصل.
        </p>

        {phoneStep === "enter-phone" && (
          <>
            <div>
              <label style={fieldLabelStyle}>الاسم بالكامل</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="اسمك الكامل"
                style={fieldInputStyle}
              />
            </div>
            <div>
              <label style={fieldLabelStyle}>رقم الموبايل</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="01012345678"
                style={fieldInputStyle}
              />
            </div>
          </>
        )}

        {phoneStep === "enter-code" && (
          <div>
            <label style={fieldLabelStyle}>كود التحقق</label>
            <input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="123456"
              style={fieldInputStyle}
            />
            <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: -4, marginBottom: 6 }}>
              اتبعتلك رسالة نصية فيها الكود على {phoneNumber}
            </div>
            <button type="button" onClick={resetPhoneCodeStep} style={smallLinkStyle}>
              تغيير الرقم
            </button>
          </div>
        )}

        {error && (
          <div style={{ color: errorColor, fontSize: 13, textAlign: "center" }}>{error}</div>
        )}

        <button
          type="button"
          onClick={cta.onClick}
          disabled={cta.disabled}
          style={{
            width: "100%",
            padding: "14px",
            background: COLORS.stamp,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 800,
            cursor: cta.disabled ? "wait" : "pointer",
            opacity: cta.disabled ? 0.7 : 1,
            fontFamily: "inherit",
            marginTop: 6,
          }}
        >
          {cta.disabled ? "جاري التنفيذ..." : cta.label}
        </button>
      </div>

      <div id="recaptcha-container" />
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600, color: COLORS.ink };
const fieldInputStyle: React.CSSProperties = { width: "100%", padding: 9, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, fontFamily: "inherit" };
const smallLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 12.5,
  textDecoration: "underline",
  color: COLORS.inkSoft,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
};

function RoleToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "16px 14px",
        borderRadius: 12,
        border: active ? "none" : `1.5px solid ${COLORS.ink}33`,
        background: active ? COLORS.ink : "#fff",
        color: active ? "#fff" : COLORS.ink,
        fontSize: 15,
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  );
}

// الثلاثة خيارات (Google/إيميل) لازم يبقوا بنفس الوزن البصري — أبيض بحدود، مفيش خيار
// "أساسي" أكبر من التاني هنا، الزرار الأساسي الحقيقي هو الزرار الأحمر تحت.
function AuthOptionButton({
  onClick,
  disabled,
  icon,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        background: "#fff",
        border: `1.5px solid ${COLORS.ink}33`,
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 700,
        color: COLORS.ink,
        cursor: disabled ? "wait" : "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0 }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.5 26.7 36 24 36c-5.3 0-9.6-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C39.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
