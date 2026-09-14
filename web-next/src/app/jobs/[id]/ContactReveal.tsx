"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import RegisterModal from "@/components/RegisterModal";
import WhatsAppContactLink from "@/components/WhatsAppContactLink";

const CONTACT_METHOD_LABELS: Record<string, string> = { email: "إيميل", whatsapp: "واتساب", phone: "تليفون" };

type Props = {
  jobId: string;
  jobTitle: string;
  contactMethod: string;
  contactValue: string;
  whatsappNumber: string | null;
};

// بوابة واجهة بس (زي ApplyButton.tsx بالظبط) — مش قفل تقني على البيانات. الزائر مش المسجل
// دخول بيشوف زرار تسجيل بدل وسيلة التواصل الفعلية، وبعد النجاح بيتفعل العرض الحقيقي فورًا من
// غير أي إعادة تحميل. contactValue لسه بيوصل للمتصفح جوه الـRSC payload بتاع الصفحة (page.tsx
// Server Component بيبعتها كـprop مهما كانت حالة الدخول) — الهدف هنا تشجيع التسجيل، مش منع
// حقيقي على مستوى البيانات (قرار متفق عليه، مش قفل صارم).
export default function ContactReveal({ jobId, jobTitle, contactMethod, contactValue, whatsappNumber }: Props) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setLoggedIn(!!user));
    return () => unsubscribe();
  }, []);

  if (loggedIn === null) return null;

  if (!loggedIn) {
    return (
      <>
        <button
          onClick={() => setShowRegisterModal(true)}
          style={{
            padding: "14px 30px",
            fontSize: 15.5,
            fontWeight: 700,
            background: "#14213D",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          🔒 سجّل عشان تشوف وسيلة التواصل
        </button>
        {showRegisterModal && (
          <RegisterModal
            onClose={() => setShowRegisterModal(false)}
            onSuccess={() => {
              setShowRegisterModal(false);
              setLoggedIn(true);
            }}
          />
        )}
      </>
    );
  }

  if (contactMethod === "whatsapp" && whatsappNumber) {
    return (
      <WhatsAppContactLink
        jobId={jobId}
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
          `مرحبًا، شفت إعلان وظيفة ${jobTitle} على موقع الشغل وحابب أتقدملها`
        )}`}
      >
        <WhatsAppIcon size={18} /> تواصل عبر واتساب
      </WhatsAppContactLink>
    );
  }

  return (
    <p style={{ color: "#4A5568", margin: 0 }}>
      <strong>التواصل ({CONTACT_METHOD_LABELS[contactMethod] || contactMethod}):</strong> {contactValue}
    </p>
  );
}

// نفس أيقونة WhatsAppFloatingButton.tsx بالظبط، بس بحجم قابل للتحكم عشان تتحط جوه زرار
// التواصل هنا (مش عائمة).
function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
      <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.36.687 4.56 1.872 6.41L4 29l7.77-1.836A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.818a9.77 9.77 0 0 1-4.98-1.362l-.357-.212-4.612 1.09 1.104-4.49-.233-.368A9.77 9.77 0 0 1 5.182 15c0-5.972 4.85-10.818 10.822-10.818S26.818 9.028 26.818 15 21.976 24.818 16.004 24.818Zm5.98-8.14c-.328-.164-1.94-.957-2.24-1.066-.3-.11-.518-.164-.737.164-.219.328-.846 1.066-1.037 1.285-.19.219-.382.246-.71.082-.328-.164-1.384-.51-2.636-1.626-.975-.87-1.633-1.943-1.824-2.271-.19-.328-.02-.505.144-.669.148-.147.328-.383.492-.574.164-.192.219-.328.328-.547.11-.219.055-.41-.027-.574-.082-.164-.737-1.776-1.01-2.434-.266-.64-.537-.554-.737-.564l-.628-.01c-.219 0-.574.082-.874.41-.3.328-1.147 1.12-1.147 2.732s1.174 3.17 1.338 3.389c.164.219 2.31 3.526 5.596 4.945.782.338 1.393.54 1.869.69.785.25 1.499.214 2.064.13.63-.094 1.94-.793 2.213-1.559.273-.766.273-1.422.191-1.559-.082-.137-.301-.219-.629-.383Z" />
    </svg>
  );
}
