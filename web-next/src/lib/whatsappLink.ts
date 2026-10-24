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

// اسم الشركة فاضي أو مسافات أو مخفي (undefined/null): "صاحب عمل" — عشان الرسالة متطلعش أبدًا بقيمة
// فاضية أو undefined.
function senderPhrase(companyName?: string | null): string {
  const company = typeof companyName === "string" ? companyName.trim() : "";
  return company ? `معك ${company} عبر موقع الشغل` : "معك صاحب عمل عبر موقع الشغل";
}

// رسالة نافذة بيانات الباحث في "البحث عن كوادر" (SeekerDetailModal) — الباحث ما قدّمش على وظيفة محددة.
export function talentWhatsAppMessage(companyName?: string | null): string {
  return `السلام عليكم ورحمة الله وبركاته، ${senderPhrase(companyName)}. اطلعنا على ملفك الشخصي ونود التواصل معك بخصوص فرصة عمل لدينا. هل يناسبك التحدث الآن؟`;
}

// رسالة كارت المتقدم على وظيفة صاحب العمل (ApplicantCard) — المرشح قدّم فعلًا. لو المسمى فاضي
// بنرجع لرسالة البحث عن كوادر بدل ما نكتب "وظيفة" من غير اسم.
export function applicantWhatsAppMessage(companyName?: string | null, jobTitle?: string | null): string {
  const title = typeof jobTitle === "string" ? jobTitle.trim() : "";
  if (!title) return talentWhatsAppMessage(companyName);
  return `السلام عليكم ورحمة الله وبركاته، ${senderPhrase(companyName)}. بخصوص تقديمك على وظيفة ${title}، نود التواصل معك. هل يناسبك التحدث الآن؟`;
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
