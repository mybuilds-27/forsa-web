import { sendEmailVerification } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

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

export async function resendVerificationEmail(): Promise<{ ok: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: "لازم تكون مسجل دخول" };
  try {
    await sendEmailVerification(user);
    return { ok: true };
  } catch (err: unknown) {
    console.error("[emailVerificationGate] فشل إعادة إرسال لينك التأكيد", err);
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    if (code === "auth/too-many-requests") {
      return { ok: false, error: "استنى شوية قبل ما تطلب لينك تاني" };
    }
    return { ok: false, error: "حصلت مشكلة، حاول تاني" };
  }
}
