import type { CSSProperties } from "react";
import { toWhatsAppNumber } from "@/lib/phoneAuth";

// رابط واتساب لرقم باحث + رسالة جاهزة، أو null لو الرقم مش صالح (فاضي، مش رقم مصري معروف، أو
// إيميل داخلي وهمي @elshoghl.internal اتحط بالغلط مكان الرقم). toWhatsAppNumber (phoneAuth.ts)
// بتعتمد على normalizeEgyptianPhone وبتشيل الـ"+"، والرقم الدولي بيطلع من غير صفر أول
// (20XXXXXXXXXX). الرسالة بتتعمل لها encodeURIComponent هنا — مفيش بيانات حساسة فيها.
function whatsAppNumberOf(rawPhone: unknown): string | null {
  if (typeof rawPhone !== "string" || !rawPhone.trim()) return null;
  if (rawPhone.includes("@elshoghl.internal")) return null;
  return toWhatsAppNumber(rawPhone);
}

export function buildWhatsAppLink(rawPhone: unknown, message: string): string | null {
  const number = whatsAppNumberOf(rawPhone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// نفس التحقق والتطبيع بالظبط، بس من غير رسالة جاهزة — للأماكن اللي مفيهاش سياق (اسم شركة/وظيفة):
// الأدمن، و"مين شاف الوظيفة"، وبيانات المُبلِّغ.
export function buildWhatsAppChatLink(rawPhone: unknown): string | null {
  const number = whatsAppNumberOf(rawPhone);
  return number ? `https://wa.me/${number}` : null;
}

// رسالة كارت المتقدم على وظيفة صاحب العمل (ApplicantCard).
export function applicantWhatsAppMessage(companyName: string, jobTitle: string): string {
  return `السلام عليكم، أنا من شركة ${companyName}، بخصوص تقديمك على وظيفة ${jobTitle} على موقع الشغل`;
}

// رسالة نافذة بيانات الباحث في "البحث عن كوادر" (SeekerDetailModal) — الباحث هنا ما قدّمش على
// وظيفة محددة، فمفيش عنوان وظيفة ولا "تقديمك".
export function talentWhatsAppMessage(companyName: string): string {
  return `السلام عليكم، أنا من شركة ${companyName}، اطّلعت على بروفايلك على موقع الشغل وحابب أتواصل معاك بخصوص فرصة عمل`;
}

export const whatsappButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  alignSelf: "flex-start",
  padding: "6px 14px",
  background: "#2F6F4E",
  color: "#fff",
  borderRadius: 8,
  textDecoration: "none",
  fontSize: 13.5,
  fontWeight: 700,
};
