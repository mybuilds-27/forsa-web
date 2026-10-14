import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// رابط إحالة صاحب العمل: /register?role=employer&ref=<uid>. الـref بيتحفظ في localStorage لمدة 30 يوم
// (أول إحالة صالحة بس هي اللي بتفضل)، وبيتبعت للسيرفر مرة واحدة بعد إنشاء الشركة لأول مرة
// (claimEmployerReferral في functions/index.js، اللي بيعمل كل التحقق ويكتب referrals/{uid}).
const STORAGE_KEY = "elshoghl_employer_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
// نفس REFERRAL_UID_PATTERN في الدالة
const REF_PATTERN = /^[A-Za-z0-9]{20,40}$/;

type StoredRef = { ref: string; savedAt: number };

function readStored(): StoredRef | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed || typeof parsed.ref !== "string" || !REF_PATTERN.test(parsed.ref) || typeof parsed.savedAt !== "number") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredReferral() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // التخزين مش متاح — مفيش حاجة نمسحها
  }
}

// بيتنادى من /register لو الرابط فيه ?ref. أول إحالة صالحة ولسه مخلصتش مدتها بتفضل، وأي رابط تاني
// بعدها بيتجاهل. فشل التخزين (تصفح خاص، إلخ) بيضيّع الإحالة بس من غير ما يأثر على التسجيل.
export function saveReferralFromUrl(rawRef: string | null) {
  const ref = (rawRef || "").trim();
  if (!REF_PATTERN.test(ref)) return;
  if (readStored()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ref, savedAt: Date.now() } satisfies StoredRef));
  } catch {
    // التخزين مش متاح — الإحالة بس اللي بتضيع
  }
}

// بيتنادى بعد إنشاء الشركة لأول مرة بنجاح. أي رد من السيرفر (اتسجلت، اتسجلت قبل كده، اترفضت) نهائي
// فالـref بيتمسح. خطأ شبكة أو سيرفر بيسيب الـref زي ما هو. مبيرميش أخطاء ومبيعرضش أي رسالة للمستخدم.
export async function claimStoredReferral(): Promise<void> {
  const stored = readStored();
  if (!stored) return;
  try {
    const call = httpsCallable<{ ref: string }, { status: string; reason?: string }>(functions, "claimEmployerReferral");
    await call({ ref: stored.ref });
    clearStoredReferral();
  } catch (err) {
    console.error("[employerReferral] فشل تسجيل الإحالة", err);
  }
}
