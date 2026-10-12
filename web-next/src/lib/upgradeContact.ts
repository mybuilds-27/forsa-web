// وسيلة طلب الترقية للباقة المدفوعة (التفعيل يدوي من الأدمن بعد التواصل) — مشتركة بين نافذة الترقية
// (UpgradeModal.tsx، client) وصفحة /pricing (server)، عشان الرقم والإيميل والرسالة يفضلوا واحد في المكانين.
export const UPGRADE_WHATSAPP_NUMBER = "201012735333";
export const UPGRADE_WHATSAPP_DISPLAY = "01012735333";
export const UPGRADE_CONTACT_EMAIL = "elshoghl27@gmail.com";

export const upgradeWhatsAppHref = `https://wa.me/${UPGRADE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "مرحبًا، أرغب في ترقية باقة الشركة على موقع الشغل إلى الباقة المدفوعة."
)}`;
export const upgradeEmailHref = `mailto:${UPGRADE_CONTACT_EMAIL}?subject=${encodeURIComponent("طلب ترقية باقة صاحب عمل")}`;
