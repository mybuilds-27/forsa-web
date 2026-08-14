"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { auth, db } from "@/lib/firebase";
import { normalizeEgyptianPhone } from "@/lib/phoneAuth";
import { logClientError } from "@/lib/errorLog";

type Role = "job_seeker" | "employer";

// بيتخزّن قبل signInWithRedirect عشان نعرف نكمّل التسجيل بيه لما المستخدم يرجع من جوجل —
// الصفحة بتتحمّل من الصفر بعد الريدايركت، فأي state عادي في الكومبوننت بيتفقد.
const PENDING_ROLE_STORAGE_KEY = "elshoghl_pending_auth_role";

// نفس القايمة المستخدمة في Navbar.tsx وadmin/page.tsx لتحديد حساب الأدمن — لو الإيميل مطابق،
// التوجيه التلقائي هنا لازم يودّي لـ/admin بدل /seeker أو /employer.
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

const COLORS = {
  ink: "#14213D",
  inkSoft: "#4A5568",
  paper: "#FAF6EC",
  stamp: "#B03A14",
  success: "#2F6F4E",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 13,
  textDecoration: "underline",
  color: COLORS.inkSoft,
  cursor: "pointer",
};

// تطبيقات فيسبوك/إنستجرام/ماسنجر بتفتح الروابط جوه WebView داخلي مش متصفح حقيقي، وجوجل
// بيمنع/بيعقّد تسجيل الدخول الكامل (OAuth) من جوه WebViews دي لأسباب أمنية من عندهم — حتى
// لو الكود بتاعنا بيعمل fallback لـsignInWithRedirect صح، شاشة جوجل نفسها بتظهر تحذير أمان
// مخيف للمستخدم. الحل الوحيد الفعلي هو إن المستخدم يفتح الرابط في متصفح حقيقي، فبنكتشف
// الحالة دي ونوضحله إزاي.
function isInAppWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram/i.test(navigator.userAgent || "");
}

export default function LandingPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isWebView, setIsWebView] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // بنكتشفها بعد أول render (جوه useEffect) بدل وقت الـrender الأول عشان نتجنب hydration
  // mismatch — السيرفر مبيعرفش الـuser agent، فبنعرض الحالة العادية الأول وبعدين نظبطها
  // فورًا لما الصفحة توصل للمتصفح.
  useEffect(() => {
    setIsWebView(isInAppWebView());
  }, []);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorColor, setErrorColor] = useState(COLORS.stamp);
  const [loading, setLoading] = useState(false);

  const [phoneStep, setPhoneStep] = useState<"idle" | "enter-phone" | "enter-code">("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  // true من لحظة ما أي محاولة تسجيل دخول جديدة (Google popup/redirect، إيميل، تليفون) تبدأ
  // لحد ما routeAfterAuth بتاعتها يخلص أو تفشل — عشان useEffect "لو مسجل دخول بالفعل" تحت
  // ميعملش توجيه مستقل بيسابق routeAfterAuth على نفس القرار. routeAfterAuth هو المصدر
  // الوحيد المسؤول عن التوجيه بعد أي عملية تسجيل دخول جديدة فعليًا.
  const authInProgressRef = useRef(false);

  // لما signInWithPopup يفشل (شائع جوه WebView بتاع تطبيقات السوشيال ميديا) بنعمل fallback
  // لـsignInWithRedirect، اللي بيودّي المستخدم لجوجل وبيرجّعه لنفس الصفحة بعد ما يسجّل دخول —
  // من غير الكود ده، النتيجة كانت بتضيع تمامًا ومفيش حاجة بتكمّل (لا users/{uid} بيتعمل ولا
  // توجيه لـ/seeker أو /employer)، والمستخدم يفضل واقف في نفس الصفحة من غير أي تفسير.
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

  // لو المستخدم مسجل دخول بالفعل وفتح "/"، ميشوفش شاشة اختيار الحساب/تسجيل الدخول تاني —
  // كانت بتفضل تتعرض حتى لجلسة شغالة فعليًا، وده بيحس المستخدم إنه اتسجّل خروج رغم إن جلسته
  // لسه فعلية (الـNavbar فوق بيفضل شغال عادي، المشكلة كانت في محتوى الصفحة بس). بنستثني حالة
  // العودة من Google redirect (فيه PENDING_ROLE_STORAGE_KEY) عشان نسيب الـuseEffect اللي فوق
  // يكمّل هو التسجيل ويعمل التوجيه بنفسه، من غير سباق بين الاتنين.
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
        console.error("[LandingPage] فشل التحقق من جلسة المستخدم الحالية", err);
        setCheckingSession(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  async function routeAfterAuth(role: Role) {
    const user = auth.currentUser;
    if (!user) return;

    // لازم نفحص الأدمن هنا كمان قبل أي حاجة، مش بس في effect "مسجل دخول بالفعل" — لأن
    // routeAfterAuth هي أول حاجة بتتنفذ فورًا بعد أي تسجيل دخول جديد (Google popup/redirect،
    // إيميل، تليفون). من غير الفحص ده، حساب الأدمن كان بيتوجّه لـ/seeker أو /employer غلط،
    // وكمان كان بيتكتب/يتحدّث userType بتاعه في Firestore بالدور اللي اختاره غلط بالصدفة.
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
        displayName: user.displayName,
        photoURL: user.photoURL,
        userType: role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    } else {
      const data = snap.data();
      if (role !== data.userType) {
        await updateDoc(userRef, { userType: role });
      }
      await updateDoc(userRef, { lastLogin: serverTimestamp() });
    }

    if (role === "job_seeker") {
      router.push("/seeker");
    } else {
      router.push("/employer");
    }
  }

  async function handleGoogleSignIn(role: Role) {
    setError("");
    setPendingRole(role);
    setLoading(true);
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
        // لو نجحت، المتصفح هيتنقل فعليًا لجوجل بره الصفحة دي — مفيش داعي نصفّر الـref هنا،
        // هيترجع false تلقائيًا لأن الصفحة هتتحمّل من جديد لما المستخدم يرجع
      } catch (err2: any) {
        console.error("Google redirect fallback failed", err2);
        logClientError("google_redirect_signin", err2);
        localStorage.removeItem(PENDING_ROLE_STORAGE_KEY);
        authInProgressRef.current = false;
        setError("حصلت مشكلة في تسجيل الدخول بجوجل، جرب طريقة تانية (إيميل أو تليفون)");
        setLoading(false);
      }
    }
  }

  function openEmailAuth(role: Role) {
    setPendingRole(role);
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
    if (!pendingRole) return;
    setError("");
    setErrorColor(COLORS.stamp);
    authInProgressRef.current = true;
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      closeEmailAuth();
      await routeAfterAuth(pendingRole);
    } catch (err: any) {
      console.error("Email sign up failed", err);
      logClientError("email_signup", err);
      setError(emailAuthErrorMessage(err));
    } finally {
      authInProgressRef.current = false;
    }
  }

  async function handleEmailLogin() {
    if (!pendingRole) return;
    setError("");
    setErrorColor(COLORS.stamp);
    authInProgressRef.current = true;
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      closeEmailAuth();
      await routeAfterAuth(pendingRole);
    } catch (err: any) {
      console.error("Email login failed", err);
      logClientError("email_login", err);
      setError(emailAuthErrorMessage(err));
    } finally {
      authInProgressRef.current = false;
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
      "auth/operation-not-allowed": "تسجيل الدخول برقم التليفون لسه مش مفعّل على المنصة",
      "auth/network-request-failed": "تأكد من اتصال الإنترنت وحاول تاني",
    };
    return map[err?.code] || "حصلت مشكلة، حاول تاني";
  }

  // إنشاء الـ reCAPTCHA مرة واحدة بس عند أول استخدام فعلي، عشان نتجنب مشكلة
  // React Strict Mode اللي بتنفذ الـ effects مرتين وتحاول تعمل instance تاني على نفس العنصر
  function getRecaptchaVerifier(): RecaptchaVerifier {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaVerifierRef.current;
  }

  function openPhoneAuth(role: Role) {
    setPendingRole(role);
    setError("");
    setPhoneStep("enter-phone");
    (window as any).fbq?.("trackCustom", "SelectSignupMethod", { method: "phone" });
  }

  function closePhoneAuth() {
    setPhoneStep("idle");
    setPhoneNumber("");
    setOtpCode("");
    setConfirmationResult(null);
    setError("");
  }

  function selectRole(role: Role) {
    setSelectedRole(role);
    setPendingRole(role);
    setError("");
    (window as any).fbq?.("trackCustom", "SelectAccountType", {
      role: role === "job_seeker" ? "seeker" : "employer",
    });
  }

  function backToRoleChoice() {
    setSelectedRole(null);
    setPendingRole(null);
    setEmailPanelOpen(false);
    closePhoneAuth();
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
    const normalized = normalizeEgyptianPhone(phoneNumber.trim());
    if (!normalized) {
      setError("اكتب رقم موبايل مصري صحيح (مثال: 01012345678)");
      return;
    }
    setPhoneLoading(true);
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
    if (!confirmationResult || !pendingRole) return;
    setError("");
    setErrorColor(COLORS.stamp);
    setPhoneLoading(true);
    authInProgressRef.current = true;
    try {
      await confirmationResult.confirm(otpCode.trim());
      closePhoneAuth();
      await routeAfterAuth(pendingRole);
    } catch (err: any) {
      console.error("Verify code failed", err);
      logClientError("phone_verify_code", err);
      setError(phoneAuthErrorMessage(err));
    } finally {
      authInProgressRef.current = false;
    }
    setPhoneLoading(false);
  }

  if (checkingSession) {
    return (
      <div dir="rtl" style={{ textAlign: "center", padding: 60 }}>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
      {!selectedRole && (
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span
            style={{
              fontSize: 13,
              color: COLORS.inkSoft,
              display: "block",
              marginBottom: 10,
            }}
          >
            منصة توظيف مصرية · واستشارات موارد بشرية
          </span>
          <h1 style={{ fontSize: 32, color: COLORS.ink, marginBottom: 12 }}>
            فرصتك الجاية... <span style={{ color: COLORS.stamp }}>موجودة هنا</span>
          </h1>
          <div
            style={{
              display: "inline-block",
              background: "rgba(47,111,78,0.12)",
              color: COLORS.success,
              fontWeight: 700,
              fontSize: 14,
              padding: "8px 16px",
              borderRadius: 999,
              marginTop: 12,
            }}
          >
            🎉 التسجيل على المنصة مجاني ١٠٠٪ للجميع — سواء كنت بتدوّر على شغل أو بتدوّر على كوادر لشركتك
          </div>
        </div>
      )}

      {!selectedRole ? (
        <>
          <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: COLORS.ink, marginBottom: 20 }}>
            إنت مين؟
          </h2>

          <div className="role-options-row" style={{ display: "flex", gap: 14, maxWidth: 820, margin: "0 auto" }}>
            <RoleOptionCard
              onClick={() => selectRole("job_seeker")}
              background={COLORS.ink}
              tintBackground="rgba(20,33,61,0.07)"
              tintColor={COLORS.ink}
              icon="🔍"
              title="باحث عن شغل"
              tagline="بتدوّر على فرصة شغل تناسبك؟ سجّل مجانًا بالكامل وهتقدر:"
              bullets={[
                "تسجّل بياناتك الأساسية بس في دقيقة وتبدأ تصفح فورًا",
                "تقدّم على أي وظيفة تناسبك بضغطة واحدة",
                "تطبع سيرتك الذاتية (CV) جاهزة ومنسّقة",
                "تحفظ الوظائف اللي عاجباك عشان تراجعها بعدين",
                "يوصلك إيميل أسبوعي بالوظائف الجديدة المطابقة لتخصصك",
              ]}
            />
            <RoleOptionCard
              onClick={() => selectRole("employer")}
              background="#C97F1F"
              tintBackground="rgba(232,163,61,0.18)"
              tintColor="#8A570D"
              icon="🏢"
              title="صاحب عمل أو شركة"
              tagline="بتدوّر على كوادر وموظفين لشركتك؟ انشر مجانًا وهتقدر:"
              bullets={[
                "تنشر لحد 5 وظائف شهريًا مجانًا بالكامل، كل وظيفة تفضل نشطة 30 يوم",
                "تستقبل تقديمات وسير ذاتية من غير أي رسوم",
                "تعمل بحث متقدم عن الكوادر المناسبة وتدعوهم للتقديم مباشرة",
                "هيجيلك إيميل يومي فيه ملخص كل المتقدمين على وظايفك",
              ]}
            />
          </div>

          <p style={{ textAlign: "center", color: COLORS.inkSoft, fontSize: 13, marginTop: 20 }}>
            💡 نفس الإيميل يقدر يستخدم الاتنين — كل ما محتاج تدوّر على شغل ادخل من زرار الباحث عن شغل، وكل ما محتاج تدوّر على كوادر لشركتك ادخل من زرار صاحب العمل.
          </p>

          <div style={{ maxWidth: 720, margin: "48px auto 0", padding: "0 16px", color: COLORS.inkSoft, fontSize: 14.5, lineHeight: 1.9 }}>
            <p style={{ marginBottom: 12 }}>
              "الشغل" منصة توظيف مصرية مجانية بالكامل، هدفها إنها تسهّل رحلة الشغل على الطرفين. لو
              بتدوّر على شغل، هتلاقي هنا وظايف يومية في كل تخصصات ومحافظات مصر، وتقدر تقدّم عليها
              في دقايق من غير ما تدفع أي حاجة. ولو صاحب عمل أو شركة، هتقدر تنشر وظايفك وتوصل لكوادر
              مناسبة بسرعة وسهولة.
            </p>
            <p>
              مفيش رسوم اشتراك، مفيش عمولة على أي تقديم أو توظيف — المنصة مبنية عشان تخدم سوق الشغل
              المصري وتقرّب المسافة بين اللي بيدوّر على شغل واللي بيدوّر على شغل عنده.
            </p>
          </div>
        </>
      ) : (
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
          <button
            onClick={backToRoleChoice}
            style={{
              background: "none",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.inkSoft,
              cursor: "pointer",
              marginBottom: 16,
              padding: 0,
              display: "block",
            }}
          >
            → رجوع
          </button>

          <button
            onClick={backToRoleChoice}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: selectedRole === "job_seeker" ? "rgba(20,33,61,0.08)" : "rgba(201,127,31,0.14)",
              color: selectedRole === "job_seeker" ? COLORS.ink : "#8A570D",
              border: "none",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 22,
              fontFamily: "inherit",
            }}
          >
            {selectedRole === "job_seeker" ? "🔍 باحث عن شغل" : "🏢 صاحب عمل أو شركة"}
          </button>

          {isWebView && (
            <div
              style={{
                background: "rgba(232,163,61,0.15)",
                border: "1px solid #E8A33D66",
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 20,
                fontSize: 13.5,
                color: COLORS.ink,
                lineHeight: 1.8,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                ⚠️ إنت فاتح الرابط من جوه تطبيق (فيسبوك/إنستجرام)
              </div>
              <div style={{ marginBottom: 10 }}>
                عشان تسجّل دخول بسهولة وأمان، افتح الرابط في متصفحك العادي (كروم أو سفاري):
                دوس على أيقونة الثلات نقط <strong>⋮</strong> فوق يمين الشاشة واختار
                <strong> "افتح في المتصفح"</strong>.
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

          <h2 style={{ fontSize: 22, color: COLORS.ink, marginBottom: 6, fontFamily: "var(--font-cairo)" }}>
            سجّل دخولك في أقل من دقيقة
          </h2>
          <p style={{ color: COLORS.inkSoft, fontSize: 14, marginBottom: 24 }}>
            مجاني بالكامل، بدون أي رسوم
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AuthOptionButton
              onClick={() => handleGoogleSignIn(selectedRole)}
              disabled={loading}
              icon={<GoogleIcon />}
              label="الدخول بحساب Google"
              accentColor={selectedRole === "job_seeker" ? COLORS.ink : "#C97F1F"}
            />
            {isWebView && (
              <div style={{ fontSize: 12, color: "#8A570D", marginTop: -4 }}>
                ⚠️ ممكن ما يشتغلش صح من جوه التطبيق — الأفضل تفتح الرابط في المتصفح زي فوق، أو
                جرّب الدخول بالإيميل أو التليفون تحت
              </div>
            )}
            <AuthOptionButton
              onClick={() => openEmailAuth(selectedRole)}
              icon="✉️"
              label="الدخول بالإيميل"
              accentColor={selectedRole === "job_seeker" ? COLORS.ink : "#C97F1F"}
            />
            <AuthOptionButton
              onClick={() => openPhoneAuth(selectedRole)}
              icon="📱"
              label="الدخول برقم التليفون"
              accentColor={selectedRole === "job_seeker" ? COLORS.ink : "#C97F1F"}
            />
          </div>
        </div>
      )}

      {emailPanelOpen && (
        <div
          style={{
            maxWidth: 420,
            margin: "30px auto 0",
            border: `1px solid ${COLORS.ink}22`,
            borderRadius: 12,
            padding: 24,
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: 19, marginBottom: 6 }}>تسجيل بالإيميل</h2>
          <p style={{ color: COLORS.inkSoft, fontSize: 13.5, marginBottom: 16 }}>
            {pendingRole === "job_seeker" ? "هتسجل كـ باحث عن عمل" : "هتسجل كـ صاحب عمل"}
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", marginBottom: 4 }}>الإيميل</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: "block", marginBottom: 4 }}>الباسورد</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 أحرف على الأقل"
              style={{ width: "100%", padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handlePasswordReset}
              style={{
                background: "none",
                border: "none",
                fontSize: 12.5,
                textDecoration: "underline",
                color: COLORS.inkSoft,
                cursor: "pointer",
              }}
            >
              نسيت الباسورد؟
            </button>
          </div>

          {error && (
            <div style={{ color: errorColor, fontSize: 13, marginBottom: 10 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={handleEmailSignUp}
              style={{
                padding: "10px 16px",
                background: COLORS.ink,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              إنشاء حساب جديد
            </button>
            <button
              onClick={handleEmailLogin}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: `1px solid ${COLORS.ink}`,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              عندي حساب بالفعل — دخول
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              onClick={closeEmailAuth}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                textDecoration: "underline",
                color: COLORS.inkSoft,
                cursor: "pointer",
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {phoneStep !== "idle" && (
        <div
          style={{
            maxWidth: 420,
            margin: "30px auto 0",
            border: `1px solid ${COLORS.ink}22`,
            borderRadius: 12,
            padding: 24,
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: 19, marginBottom: 6 }}>الدخول برقم التليفون</h2>
          <p style={{ color: COLORS.inkSoft, fontSize: 13.5, marginBottom: 10 }}>
            {pendingRole === "job_seeker" ? "هتسجل كـ باحث عن عمل" : "هتسجل كـ صاحب عمل"}
          </p>
          <p style={{ color: COLORS.inkSoft, fontSize: 12.5, marginBottom: 16 }}>
            ⚠️ لو سجّلت قبل كده بجوجل أو الإيميل، استخدم نفس الطريقة دي تاني بدل رقم التليفون —
            كل طريقة دخول بتعمل حساب منفصل.
          </p>

          {phoneStep === "enter-phone" && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", marginBottom: 4 }}>رقم الموبايل</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="01012345678"
                  style={{ width: "100%", padding: 8 }}
                />
              </div>

              {error && (
                <div style={{ color: errorColor, fontSize: 13, marginBottom: 10 }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={handleSendCode}
                  disabled={phoneLoading}
                  style={{
                    padding: "10px 16px",
                    background: COLORS.ink,
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  {phoneLoading ? "جاري الإرسال..." : "ابعتلي كود التحقق"}
                </button>
              </div>
            </>
          )}

          {phoneStep === "enter-code" && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", marginBottom: 4 }}>كود التحقق</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  style={{ width: "100%", padding: 8 }}
                />
                <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>
                  اتبعتلك رسالة نصية فيها الكود على {phoneNumber}
                </div>
              </div>

              {error && (
                <div style={{ color: errorColor, fontSize: 13, marginBottom: 10 }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={handleVerifyCode}
                  disabled={phoneLoading}
                  style={{
                    padding: "10px 16px",
                    background: COLORS.ink,
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  {phoneLoading ? "جاري التأكيد..." : "تأكيد الكود"}
                </button>
              </div>
            </>
          )}

          <div style={{ marginTop: 14 }}>
            <button onClick={closePhoneAuth} style={linkBtnStyle}>إلغاء</button>
          </div>
        </div>
      )}

      <div id="recaptcha-container" />
    </div>
  );
}

// الثلاثة خيارات (Google/إيميل/تليفون) لازم يبقوا بنفس الوزن البصري بالظبط — نفس المكوّن
// لتلاتتهم، مفيش خيار "أساسي" أكبر من التاني
function AuthOptionButton({
  onClick,
  disabled,
  icon,
  label,
  accentColor,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  accentColor: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        background: "#fff",
        border: `1.5px solid ${accentColor}33`,
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

function RoleOptionCard({
  onClick,
  background,
  tintBackground,
  tintColor,
  icon,
  title,
  tagline,
  bullets,
}: {
  onClick: () => void;
  background: string;
  tintBackground: string;
  tintColor: string;
  icon: string;
  title: string;
  tagline: string;
  bullets: string[];
}) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer", flex: "1 1 0", minWidth: 0 }}>
      {/* البوكس العلوي: الاختيار نفسه (أيقونة + اسم الدور) */}
      <button
        onClick={onClick}
        style={{
          width: "100%",
          textAlign: "center",
          background,
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "18px 22px",
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 26 }}>{icon}</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-cairo)" }}>{title}</span>
      </button>

      {/* البوكس السفلي: وصفي بس (الجملة التعريفية + المزايا) — منفصل بصريًا بمسافة ولون أفتح */}
      <div
        style={{
          marginTop: 8,
          background: tintBackground,
          color: tintColor,
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10, lineHeight: 1.6 }}>{tagline}</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, lineHeight: 1.5, fontWeight: 400 }}>
              <span aria-hidden="true">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
