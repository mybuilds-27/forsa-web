// نفس رقم WHATSAPP_NUMBER المستخدم في UpgradeModal.tsx (وemployer/page.tsx) — رقم دعم
// واحد ثابت في كل الموقع، من غير أي داعي لتوحيده في مكان مشترك دلوقتي (نسخة واحدة كمان هنا
// مطابقة تمامًا، زي باقي الأماكن).
const WHATSAPP_NUMBER = "201012735333";
const DEFAULT_MESSAGE = "عندي سؤال عن موقع الشغل";

// زرار عائم ثابت مع السكرول — مفيش أي state أو تفاعل جافاسكريبت، فمش محتاج "use client"
// خالص حتى لو اتستخدم جوه صفحة Server Component زي الرئيسية.
export default function WhatsAppFloatingButton() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="تواصل معنا واتساب"
      aria-label="تواصل معنا واتساب"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: "auto",
        height: "auto",
        borderRadius: 32,
        background: "#25D366",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: "13px 18px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        zIndex: 999,
        textDecoration: "none",
        color: "#fff",
        fontWeight: 700,
        fontSize: 14.5,
        whiteSpace: "nowrap",
      }}
    >
      <WhatsAppIcon />
      تواصل معنا واتساب
    </a>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
      <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.36.687 4.56 1.872 6.41L4 29l7.77-1.836A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.818a9.77 9.77 0 0 1-4.98-1.362l-.357-.212-4.612 1.09 1.104-4.49-.233-.368A9.77 9.77 0 0 1 5.182 15c0-5.972 4.85-10.818 10.822-10.818S26.818 9.028 26.818 15 21.976 24.818 16.004 24.818Zm5.98-8.14c-.328-.164-1.94-.957-2.24-1.066-.3-.11-.518-.164-.737.164-.219.328-.846 1.066-1.037 1.285-.19.219-.382.246-.71.082-.328-.164-1.384-.51-2.636-1.626-.975-.87-1.633-1.943-1.824-2.271-.19-.328-.02-.505.144-.669.148-.147.328-.383.492-.574.164-.192.219-.328.328-.547.11-.219.055-.41-.027-.574-.082-.164-.737-1.776-1.01-2.434-.266-.64-.537-.554-.737-.564l-.628-.01c-.219 0-.574.082-.874.41-.3.328-1.147 1.12-1.147 2.732s1.174 3.17 1.338 3.389c.164.219 2.31 3.526 5.596 4.945.782.338 1.393.54 1.869.69.785.25 1.499.214 2.064.13.63-.094 1.94-.793 2.213-1.559.273-.766.273-1.422.191-1.559-.082-.137-.301-.219-.629-.383Z" />
    </svg>
  );
}
