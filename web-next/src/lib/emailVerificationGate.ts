import { sendEmailVerification, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { CopyAudience } from "./errorMessages";

// الدومين اللي لينك التأكيد بيرجّع عليه المستخدم (زرار "متابعة" في صفحة فايربيز بعد التأكيد).
// لازم يكون في Authentication → Settings → Authorized domains في كونسول فايربيز.
const SITE_ORIGIN = "https://www.elshoghl.com";

// بيبعت إيميل التأكيد ومعاه actionCodeSettings.url بيرجّع المستخدم على /employer أو /seeker حسب
// نوع الحساب (userType: "employer" أو غيره = باحث). لو الدومين مش في Authorized domains فايربيز
// بيرفض بـauth/unauthorized-continue-uri (أو invalid-continue-uri) — ساعتها بنبعت الإيميل من غير
// url بدل ما التأكيد كله يقف (الإيميل الافتراضي القديم بيفضل شغال).
export async function sendVerificationEmailWithContinue(user: User, userType: string | null | undefined) {
  const url = `${SITE_ORIGIN}${userType === "employer" ? "/employer" : "/seeker"}`;
  try {
    await sendEmailVerification(user, { url });
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") {
      console.warn("[emailVerificationGate] الدومين مش مسموح كـcontinue url، بنبعت الإيميل من غيره", code);
      await sendEmailVerification(user);
      return;
    }
    throw err;
  }
}

export type EmailVerificationGateResult = { blocked: false } | { blocked: true; email: string };

// المستخدمين اللي سجّلوا بالإيميل بعد تفعيل التأكيد الإجباري ده (requiresEmailVerification:
// true في users/{uid}، بتتحط بس من handleEmailSignUp في RegisterForm.tsx) لازم يأكدوا إيميلهم
// قبل ما يستخدموا أي فيتشر أساسي. الحسابات القديمة، وأي حساب بتليفون أو جوجل، معندهاش الحقل
// ده خالص (undefined) فبتعدي من الفحص ده من غير أي تأثير على تجربتها.
export async function checkEmailVerificationGate(): Promise<EmailVerificationGateResult> {
  const user = auth.currentUser;
  if (!user) return { blocked: false };

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().requiresEmailVerification !== true) {
    return { blocked: false };
  }

  // emailVerified بيتخزّن محليًا من آخر ID token — لو المستخدم أكد إيميله من تاب أو جهاز تاني
  // وهو فاتح الموقع هنا، لازم نحدّثها من السيرفر قبل ما نعتمد عليها، وإلا هنفضل نمنعه غلط.
  try {
    await user.reload();
  } catch (err) {
    console.error("[emailVerificationGate] فشل تحديث حالة المستخدم", err);
  }

  if (auth.currentUser?.emailVerified) return { blocked: false };
  return { blocked: true, email: user.email || "" };
}

// رسايل الخطأ حسب الجمهور (شوف CopyAudience في errorMessages.ts) — الباحث هو الافتراضي.
const RESEND_ERRORS: Record<CopyAudience, { notSignedIn: string; tooManyRequests: string; failed: string }> = {
  seeker: {
    notSignedIn: "لازم تكون مسجل دخول",
    tooManyRequests: "استنى شوية قبل ما تطلب لينك تاني",
    failed: "حصلت مشكلة، حاول تاني",
  },
  employer: {
    notSignedIn: "يجب تسجيل الدخول أولًا",
    tooManyRequests: "يرجى الانتظار قليلًا قبل طلب رابط جديد",
    failed: "تعذّر الإرسال. حاول مرة أخرى.",
  },
};

export async function resendVerificationEmail(audience: CopyAudience = "seeker"): Promise<{ ok: boolean; error?: string }> {
  const errors = RESEND_ERRORS[audience];
  const user = auth.currentUser;
  if (!user) return { ok: false, error: errors.notSignedIn };
  try {
    // نوع الحساب من users/{uid} عشان لينك الرجوع يوديه لصفحته (/employer أو /seeker).
    let userType: string | null = null;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      userType = snap.exists() ? snap.data().userType || null : null;
    } catch (err) {
      console.error("[emailVerificationGate] فشل قراءة نوع الحساب، هيتحط /seeker كافتراضي", err);
    }
    await sendVerificationEmailWithContinue(user, userType);
    return { ok: true };
  } catch (err: unknown) {
    console.error("[emailVerificationGate] فشل إعادة إرسال لينك التأكيد", err);
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    if (code === "auth/too-many-requests") {
      return { ok: false, error: errors.tooManyRequests };
    }
    return { ok: false, error: errors.failed };
  }
}
