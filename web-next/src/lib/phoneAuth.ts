// بيحوّل رقم موبايل مصري (محلي أو دولي) لصيغة E.164، أو يرجّع null لو الرقم مش صحيح
export function normalizeEgyptianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");

  const local = digits.match(/^01[0125]\d{8}$/);
  if (local) return "+20" + digits.slice(1);

  const intl = digits.match(/^\+201[0125]\d{8}$/);
  if (intl) return digits;

  return null;
}

// لينكات wa.me محتاجة الرقم بصيغة دولية بس من غير علامة "+" (زي 201012345678) — بنعتمد على
// normalizeEgyptianPhone نفسها (بدل ما نكرر نفس منطق التحقق من صفر البداية/كود الدولة) وبنشيل
// الـ"+" بس من النتيجة. الصيغة الدولية من غير "+" أصلاً (201012345678) شائعة برضو (حد كاتب
// الرقم بنفسه وحاطط كود الدولة بس ناسي الـ+)، فبنتحقق منها كمان قبل ما نستسلم. بترجع null
// لو الرقم مش بأي صيغة مصرية معروفة، عشان اللي بينادي الدالة يقرر fallback مناسب بنفسه بدل
// ما نفترض نجاح دايمًا.
export function toWhatsAppNumber(raw: string): string | null {
  const normalized = normalizeEgyptianPhone(raw);
  if (normalized) return normalized.replace(/^\+/, "");

  const digits = raw.replace(/[\s-]/g, "");
  if (/^201[0125]\d{8}$/.test(digits)) return digits;

  return null;
}
