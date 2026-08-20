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
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";
import { normalizeEgyptianPhone } from "@/lib/phoneAuth";
import { logClientError } from "@/lib/errorLog";
import { logFunnelEvent } from "@/lib/registrationFunnel";

export type Role = "job_seeker" | "employer";

// بيتخزّن قبل signInWithRedirect عشان نعرف نكمّل التسجيل بيه لما المستخدم يرجع من جوجل —
// آمن لأن فلو واحد بس بيكون شغال في نفس الوقت لكل تاب، بغض النظر عن مين مستخدم الكومبوننت
// ده (صفحة /register أو مودال التقديم على وظيفة).
const PENDING_ROLE_STORAGE_KEY = "elshoghl_pending_auth_role";

// نفس القايمة المستخدمة في Navbar.tsx وpage.tsx وadmin/page.tsx لتحديد حساب الأدمن
const ADMIN_EMAILS = ["elshoghl27@gmail.com", "mohamedzakaria2727@gmail.com"];

const COLORS = {
  ink: "#14213D",
  inkSoft: "#4A5568",
  stamp: "#B03A14",
  success: "#2F6F4E",
};

// جوجل بيرفض/بيعقّد الـOAuth من جوه WebViews بتاعة فيسبوك/إنستجرام، فبنحذّر المستخدم
// يفتح الرابط في متصفح حقيقي بدل ما يتفاجئ بفشل صامت.
function isInAppWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram/i.test(navigator.userAgent || "");
}

// فايربيز مالوش "دخول بتليفون + باسورد" كطريقة مصادقة مستقلة — الحل الشائع إننا نربط
// (link) بيانات دخول إيميل/باسورد بنفس حساب التليفون، بإيميل داخلي وهمي مبني من الرقم
// نفسه، من غير ما المستخدم يشوفه أو يتفاعل معاه خالص. e164Phone هنا بصيغة زي +201012345678.
function phoneToSyntheticEmail(e164Phone: string): string {
  return `phone+${e164Phone.replace(/^\+/, "")}@elshoghl.internal`;
}

type Props = {
  role: Role;
  onRoleChange?: (role: Role) => void;
  // مودال التقديم على وظيفة بيستخدم الفورم دي بدور "باحث عن شغل" ثابت من غير توجل خالص —
  // showRoleToggle=false في الحالة دي.
  showRoleToggle?: boolean;
  // بيتنادى بعد ما الحساب يتأكد إنه موجود (سواء اتعمله إنشاء أو دخول) ومش حساب أدمن —
  // الصفحة بتستخدمه للتوجيه لـ/seeker أو /employer، والمودال بيستخدمه عشان يكمّل التقديم
  // على الوظيفة فورًا من غير ما يحتاج المستخدم يدوس "قدم الآن" تاني.
  onSuccess: (role: Role) => void;
  // بيتغيّر (counter) كل ما لينك "عندك حساب بالفعل؟" فوق اللوجو في register/page.tsx يتدوس
  // عليه — بيفتح فورم الإيميل في وضع "دخول" مباشرة. undefined يعني معندناش زرار خارجي بيطلب
  // كده (زي مودال التقديم على وظيفة).
  openLoginSignal?: number;
};

export default function RegisterForm({ role, onRoleChange, showRoleToggle = true, onSuccess, openLoginSignal }: Props) {
  const router = useRouter();

  const [isWebView, setIsWebView] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setIsWebView(isInAppWebView());
  }, []);

  // بيفتح فورم الإيميل في وضع "دخول" مباشرة كل ما openLoginSignal يتغيّر — أول render بيه
  // undefined أو 0 فمبيعملش حاجة، وبعدين أي زيادة (دوسة على اللينك) بتفتح الفورم.
  useEffect(() => {
    if (!openLoginSignal) return;
    setEmailPanelOpen(true);
    setLoginMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLoginSignal]);

  const [emailPanelOpen, setEmailPanelOpen] = useState(false);
  const [loginMode, setLoginMode] = useState(false);
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
  const [phonePassword, setPhonePassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  // otpContext بيفرّق بين خطوة الكود بتاعة تسجيل جديد بالتليفون، وخطوة الكود بتاعة استرجاع
  // دخول مستخدم قديم اتسجل بالتليفون قبل ما يبقى عندنا باسورد (شوف handleOtpFallback تحت).
  const [otpContext, setOtpContext] = useState<"signup" | "login-fallback">("signup");
  // بيظهر لما مستخدم يجرب يدخل برقم تليفون + باسورد ويفشل — يديله فرصة يدخل بكود التحقق
  // القديم بدل ما يتقفل برّه، وبعدين نربطله الباسورد اللي كتبه عشان يستخدمه المرة الجاية.
  const [showOtpFallback, setShowOtpFallback] = useState(false);
  const [pendingLoginPhone, setPendingLoginPhone] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  // true من لحظة ما أي محاولة تسجيل جديدة تبدأ لحد ما routeAfterAuth بتاعتها يخلص أو يفشل.
  const authInProgressRef = useRef(false);

  // لما signInWithPopup يفشل (شائع جوه WebView) بنعمل fallback لـsignInWithRedirect، اللي
  // بيودّي المستخدم لجوجل وبيرجّعه لنفس الصفحة بعد ما يسجّل دخول. ملحوظة: لو ده حصل من
  // جوه مودال التقديم على وظيفة، الصفحة بترجع بالكامل (redirect = navigation حقيقي) وبالتالي
  // المودال مش هيفضل مفتوح — تسجيل الدخول هيتم فعليًا بس المستخدم هيحتاج يدوس "قدم الآن"
  // تاني. حالة نادرة (WebView + جوجل تحديدًا)، والمودال أصلًا بينصح باستخدام الإيميل أو
  // التليفون بدلها في الحالة دي.
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

  // displayNameOverride بيتبعت بس من فلو التليفون — مصادقة فايربيز بالتليفون معندهاش
  // displayName خالص، فبنستخدم اسم كتبه المستخدم بنفسه في حقل "الاسم بالكامل" بدلًا منه.
  async function routeAfterAuth(selectedRole: Role, displayNameOverride?: string) {
    const user = auth.currentUser;
    if (!user) return;

    // لازم نفحص الأدمن هنا قبل أي حاجة — routeAfterAuth هي أول حاجة بتتنفذ فورًا بعد أي
    // تسجيل دخول جديد، بغض النظر عن السياق (صفحة أو مودال).
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

    onSuccess(selectedRole);
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    authInProgressRef.current = true;
    (window as any).fbq?.("trackCustom", "SelectSignupMethod", { method: "google" });
    logFunnelEvent("method_selected", role, "google");
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
    setLoginMode(false);
    (window as any).fbq?.("trackCustom", "SelectSignupMethod", { method: "email" });
    logFunnelEvent("method_selected", role, "email");
  }

  function closeEmailAuth() {
    setEmailPanelOpen(false);
    setLoginMode(false);
    setEmail("");
    setPassword("");
    setError("");
    setShowOtpFallback(false);
    setPendingLoginPhone(null);
    // لو المستخدم كان في نص استرجاع دخول بالـOTP وقفل الفورم، نرجّع كل حاجة لوضعها الطبيعي
    if (otpContext === "login-fallback") {
      setOtpContext("signup");
      setPhoneStep("enter-phone");
      setOtpCode("");
      setConfirmationResult(null);
    }
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

  // فورم "دخول" بياخد رقم موبايل أو إيميل في حقل واحد — بنفرّق بينهم برقم مصري صحيح ولا لأ.
  async function handleUnifiedLogin() {
    const identifier = email.trim();
    const normalizedPhone = normalizeEgyptianPhone(identifier);
    if (normalizedPhone) {
      await handlePhonePasswordLogin(normalizedPhone);
    } else {
      await handleEmailLogin();
    }
  }

  async function handlePhonePasswordLogin(normalizedPhone: string) {
    setError("");
    setErrorColor(COLORS.stamp);
    setEmailSaving(true);
    authInProgressRef.current = true;
    try {
      await signInWithEmailAndPassword(auth, phoneToSyntheticEmail(normalizedPhone), password);
      closeEmailAuth();
      await routeAfterAuth(role);
    } catch (err: any) {
      // ده ممكن يبقى باسورد غلط، أو حساب قديم اتسجل بالتليفون قبل ما يبقى عندنا باسورد
      // خالص — مقدرش أفرّق بينهم من نوع الخطأ لوحده، فبديله فرصة يدخل بكود التحقق بدلها.
      console.error("Phone password login failed", err);
      logClientError("phone_password_login", err);
      setError("الباسورد غلط، أو الحساب ده لسه معندوش باسورد متسجل.");
      setPendingLoginPhone(normalizedPhone);
      setShowOtpFallback(true);
    } finally {
      authInProgressRef.current = false;
      setEmailSaving(false);
    }
  }

  // مستخدم قديم اتسجل بالتليفون قبل ما نضيف الباسورد — بنرجّعه لمسار الـOTP القديم عشان
  // يقدر يدخل، وبعد ما يتأكد الكود بنربط نفس الباسورد اللي كان كاتبه فوق (handleVerifyCode).
  function handleOtpFallback() {
    if (!pendingLoginPhone) return;
    setOtpContext("login-fallback");
    setPhoneNumber(pendingLoginPhone);
    setShowOtpFallback(false);
    setError("");
    handleSendCode(pendingLoginPhone);
  }

  function cancelLoginOtp() {
    setPhoneStep("enter-phone");
    setOtpCode("");
    setConfirmationResult(null);
    setOtpContext("signup");
    setShowOtpFallback(true);
    setError("");
  }

  // بعد ما أي تحقق بالتليفون (تسجيل جديد أو استرجاع دخول) ينجح، بنربط الباسورد اللي كتبه
  // المستخدم بالحساب — بس لو الحساب معندوش credential باسورد مربوط بالفعل (مستخدم اتسجل
  // بالتليفون قبل التعديل ده ولسه معندوش باسورد). فشل الربط ميوقفش تسجيل الدخول نفسه.
  async function linkPasswordIfNeeded(passwordToLink: string, normalizedPhone: string) {
    const user = auth.currentUser;
    // في حالة استرجاع الدخول، passwordToLink ممكن يكون مجرد "محاولة" كتبها المستخدم قبل ما
    // يكتشف إن حسابه لسه معندوش باسورد — لو أقل من 6 أحرف مش هنربطها كباسورد فعلي بدون
    // تأكيد صريح منه، ونسيبه يقدر يعمل كده لاحقًا بدل ما نفرض عليه باسورد قصير مش قاصده.
    if (!user || passwordToLink.trim().length < 6) return;
    if (user.providerData.some((p) => p.providerId === "password")) return;
    try {
      await linkWithCredential(user, EmailAuthProvider.credential(phoneToSyntheticEmail(normalizedPhone), passwordToLink));
    } catch (err) {
      console.error("Failed to link password credential to phone account", err);
      logClientError("phone_link_password", err);
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
  // الاسم أو الرقم أو الباسورد اللي كتبهم قبل كده.
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

  // phoneOverride بتتبعت من handleOtpFallback عشان تتفادى قراءة state الـphoneNumber قبل
  // ما يتحدّث فعليًا (setState مش متزامن) — من غيرها هيتبعت الرقم القديم مش الجديد.
  async function handleSendCode(phoneOverride?: string) {
    setError("");
    setErrorColor(COLORS.stamp);

    const isSignup = otpContext === "signup";

    if (isSignup) {
      if (!fullName.trim()) {
        setError("اكتب اسمك بالكامل");
        return;
      }
      if (!phonePassword || phonePassword.length < 6) {
        setError("اختار باسورد 6 أحرف على الأقل");
        return;
      }
    }

    const normalized = normalizeEgyptianPhone((phoneOverride ?? phoneNumber).trim());
    if (!normalized) {
      setError("اكتب رقم موبايل مصري صحيح (مثال: 01012345678)");
      return;
    }

    setPhoneLoading(true);

    // فحص تضارب الحسابات معناه بس وقت التسجيل الجديد — استرجاع دخول حساب قديم غرضه أصلًا
    // إن الرقم ده مرتبط بحساب موجود، فمفيش داعي (ولا معنى) نمنعه هنا.
    if (isSignup) {
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
      logFunnelEvent("method_selected", role, "phone");
    }

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
    const normalized = normalizeEgyptianPhone(phoneNumber.trim());
    if (!normalized) return;
    setError("");
    setErrorColor(COLORS.stamp);
    setPhoneLoading(true);
    authInProgressRef.current = true;
    try {
      await confirmationResult.confirm(otpCode.trim());
      const isSignup = otpContext === "signup";
      await linkPasswordIfNeeded(isSignup ? phonePassword : password, normalized);
      if (isSignup) {
        await routeAfterAuth(role, fullName.trim());
      } else {
        await routeAfterAuth(role);
      }
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
  // كل قسم. خطوة تأكيد كود الـOTP (تسجيل جديد أو استرجاع دخول) ليها الأولوية القصوى لو
  // بدأت فعليًا، حتى لو فورم الإيميل لسه مفتوح تقنيًا — بعد كده فورم الإيميل، وأخيرًا حقول
  // الاسم/التليفون الافتراضية.
  function finalCta(): { label: string; onClick: () => void; disabled: boolean } {
    if (phoneStep === "enter-code") {
      return {
        label: otpContext === "login-fallback" ? "دخول" : "إنشاء حساب مجانًا",
        onClick: handleVerifyCode,
        disabled: phoneLoading,
      };
    }
    if (emailPanelOpen) {
      return loginMode
        ? { label: "دخول", onClick: handleUnifiedLogin, disabled: emailSaving }
        : { label: "إنشاء حساب مجانًا", onClick: handleEmailSignUp, disabled: emailSaving };
    }
    return { label: "ابعتلي كود التحقق", onClick: () => handleSendCode(), disabled: phoneLoading };
  }

  const cta = finalCta();

  return (
    <div dir="rtl">
      {showRoleToggle && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <RoleToggleButton
            active={role === "job_seeker"}
            onClick={() => onRoleChange?.("job_seeker")}
            icon="🔍"
            label="باحث عن شغل"
          />
          <RoleToggleButton
            active={role === "employer"}
            onClick={() => onRoleChange?.("employer")}
            icon="🏢"
            label="صاحب عمل"
          />
        </div>
      )}

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
        {role === "employer" && (
          <div
            style={{
              marginTop: 10,
              maxWidth: 340,
              marginLeft: "auto",
              marginRight: "auto",
              fontSize: 12.5,
              color: COLORS.success,
              lineHeight: 1.7,
              fontWeight: 600,
            }}
          >
            من غير أي مستندات أو رسوم — انشر لحد 5 وظايف شهريًا مجانًا (كل وظيفة نشطة 30
            يوم) + 5 دعوات تقديم شهريًا
          </div>
        )}
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
        {/* التسجيل بالاسم ورقم الموبايل هو الاختيار الأساسي الظاهر فوق — جوجل والإيميل
            بدائل تحت خط "أو". ده بس ترتيب عرض بصري، المنطق والسلوك (فحص تضارب الحسابات،
            الـOTP، إلخ) زي ما هو تمامًا. */}
        {phoneStep === "enter-phone" && !loginMode && (
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
            <div>
              <label style={fieldLabelStyle}>اختار باسورد</label>
              <input
                type="password"
                value={phonePassword}
                onChange={(e) => setPhonePassword(e.target.value)}
                placeholder="6 أحرف على الأقل"
                style={fieldInputStyle}
              />
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: -4 }}>
                عشان تقدر تدخل المرة الجاية بالباسورد على طول من غير ما نبعتلك كود تاني
              </div>
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
            <button
              type="button"
              onClick={otpContext === "login-fallback" ? cancelLoginOtp : resetPhoneCodeStep}
              style={smallLinkStyle}
            >
              {otpContext === "login-fallback" ? "رجوع" : "تغيير الرقم"}
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
          <div style={{ flex: 1, height: 1, background: `${COLORS.ink}22` }} />
          <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>أو</span>
          <div style={{ flex: 1, height: 1, background: `${COLORS.ink}22` }} />
        </div>

        <AuthOptionButton onClick={handleGoogleSignIn} disabled={googleLoading} icon={<GoogleIcon />} label="المتابعة بجوجل" />
        {isWebView && (
          <div style={{ fontSize: 12, color: "#8A570D", marginTop: -4 }}>
            ⚠️ ممكن ما يشتغلش صح من جوه التطبيق — الأفضل تفتح الرابط في المتصفح زي فوق، أو
            جرّب الإيميل تحت
          </div>
        )}

        {!emailPanelOpen && (
          <AuthOptionButton onClick={openEmailAuth} icon="✉️" label="المتابعة بالإيميل" />
        )}

        {emailPanelOpen && (
          <div style={{ border: `1px solid ${COLORS.ink}22`, borderRadius: 12, padding: 18, background: "#fff" }}>
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLabelStyle}>{loginMode ? "رقم الموبايل أو الإيميل" : "الإيميل"}</label>
              <input
                type={loginMode ? "text" : "email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={loginMode ? "01012345678 أو example@email.com" : "example@email.com"}
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

            {/* استرجاع الباسورد بإيميل فعلي بس — مش متاح لمستخدم بيدخل برقم تليفون لأن
                الإيميل الداخلي اللي بنستخدمه وهمي، ومحدش يقدر يستلم إيميل عليه أصلًا. */}
            {(!loginMode || !normalizeEgyptianPhone(email.trim())) && (
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <button type="button" onClick={handlePasswordReset} style={smallLinkStyle}>
                  نسيت الباسورد؟
                </button>
                {!loginMode && (
                  <button type="button" onClick={handleEmailLogin} disabled={emailSaving} style={smallLinkStyle}>
                    عندي حساب بالفعل — دخول
                  </button>
                )}
              </div>
            )}

            {showOtpFallback && (
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={handleOtpFallback} style={smallLinkStyle}>
                  سجّلت بالتليفون قبل كده ولسه معندكش باسورد؟ ادخل بكود التحقق (OTP) بدلاً منه
                </button>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={closeEmailAuth} style={smallLinkStyle}>
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* اتنقلت هنا من فوق حقول التليفون — ملحوظة عامة على مستوى الصفحة كلها بدل ما تبقى
            مربوطة بصريًا بحقول معينة، ومش لازمة أصلًا في وضع الدخول (loginMode). */}
        {!loginMode && (
          <p style={{ color: COLORS.inkSoft, fontSize: 11.5, lineHeight: 1.8, margin: "10px 0 0", textAlign: "center" }}>
            ⚠️ لو سجّلت قبل كده بجوجل أو الإيميل، استخدم نفس الطريقة دي تاني بدل رقم التليفون —
            كل طريقة دخول بتعمل حساب منفصل.
          </p>
        )}
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
