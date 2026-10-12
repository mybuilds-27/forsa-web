"use client";

import { useCallback, useEffect, useState } from "react";
import { verificationResendCooldownSeconds } from "./emailVerificationGate";

// الثواني الباقية على تهدئة زرار "إعادة إرسال" لينك التأكيد (شوف VERIFICATION_RESEND_COOLDOWN_MS)، وبتنزل كل ثانية
// لحد 0. refresh بتتنادى بعد أي محاولة إرسال عشان العدّ يبدأ من آخر وقت اتسجّل.
// المكونين اللي بيستخدموه بيتعرضوا على الكلاينت بس بعد فحص تأكيد الإيميل (async)، فالقيمة الأولية بتتحسب من
// localStorage مباشرة؛ على السيرفر (لو اتعرض هناك) بتبدأ 0.
export function useVerificationResendCooldown(): [number, () => void] {
  const [seconds, setSeconds] = useState(() => (typeof window === "undefined" ? 0 : verificationResendCooldownSeconds()));
  const refresh = useCallback(() => setSeconds(verificationResendCooldownSeconds()), []);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds(verificationResendCooldownSeconds()), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  return [seconds, refresh];
}
