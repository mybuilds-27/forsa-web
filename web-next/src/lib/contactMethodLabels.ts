// نفس التسميات المستخدمة في مودال تفاصيل الوظيفة في jobs/[id]/page.tsx (receiveMethod ===
// "contact") — لوظايف receiveMethod === "contact" مفيش أي applications متسجلة في Firestore
// خالص (التقديم بيوصل صاحب العمل مباشرة برّه تتبع الموقع)، فعرض "0 متقدم" مضلل. بنستبدله
// بنص واضح بيوضح وسيلة التواصل الفعلية بدل الرقم. مشتركة بين لوحة صاحب العمل (CompanyTab.tsx)
// ولوحة الأدمن (admin/page.tsx) عشان منكررش نفس المنطق في مكانين.
export const CONTACT_METHOD_LABELS: Record<string, string> = {
  whatsapp: "واتساب",
  email: "الإيميل",
  phone: "التليفون",
};

export function contactApplyText(p: { contactMethod?: string }): string {
  return `التقديم عبر ${CONTACT_METHOD_LABELS[p.contactMethod || ""] || "التواصل المباشر"}`;
}
