import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

type FunnelStep = "role_selected" | "method_selected";
type FunnelRole = "job_seeker" | "employer";
type FunnelMethod = "google" | "email" | "phone";

// تتبّع داخلي لقمع التسجيل — بديل/نسخة احتياطية عن أحداث Meta Pixel المكافئة
// (SelectAccountType/SelectSignupMethod)، بيتسجل في نفس اللحظات بالظبط. الكتابة
// fire-and-forget: فشلها ميوقفش ولا يأثر على تجربة التسجيل خالص. محتاجة قاعدة Firestore
// تسمح بـcreate بس (مش read) على registration_funnel_events من غير تسجيل دخول، لأن
// التسجيل بيحصل قبل ما المستخدم يبقى مسجل دخول أصلًا.
export function logFunnelEvent(step: FunnelStep, role: FunnelRole, method?: FunnelMethod) {
  addDoc(collection(db, "registration_funnel_events"), {
    step,
    role,
    ...(method ? { method } : {}),
    timestamp: serverTimestamp(),
  }).catch((err) => {
    console.error("[registrationFunnel] فشل تسجيل حدث القمع", err);
  });
}
