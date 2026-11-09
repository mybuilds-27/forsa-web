"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toWhatsAppNumber } from "@/lib/phoneAuth";
import RegisterModal from "@/components/RegisterModal";
import { logContactReveal } from "@/lib/contactReveal";

const CONTACT_METHOD_LABELS: Record<string, string> = { email: "إيميل", whatsapp: "واتساب", phone: "تليفون" };

type Props = {
  jobId: string;
  contactMethod: string;
};

type Contact = { value: string; whatsappNumber: string | null; jobTitle: string };

// بوابة واجهة (زي ApplyButton.tsx) — الزائر مش المسجل دخول بيشوف زرار تسجيل بدل وسيلة التواصل،
// وبعد النجاح بيتفعل العرض الحقيقي فورًا من غير إعادة تحميل. contactValue مبقاش بيتبعت من page.tsx
// (كان بيتكتب في HTML الصفحة لأي زائر)؛ بيتقري هنا من job_posts/{jobId} بعد تسجيل الدخول بس.
// ده مش قفل على مستوى البيانات: قواعد Firestore لسه بتسمح بقراية مستند الوظيفة من غير تسجيل.
export default function ContactReveal({ jobId, contactMethod }: Props) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  // undefined = لسه بيتحمّل، null = القراءة فشلت أو مفيش قيمة
  const [contact, setContact] = useState<Contact | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setLoggedIn(!!user));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    getDoc(doc(db, "job_posts", jobId))
      .then((snap) => {
        const data = snap.exists() ? snap.data() : null;
        const value = typeof data?.contactValue === "string" ? data.contactValue : "";
        if (!value) throw new Error("no contactValue");
        // لينك واتساب محتاج الرقم بصيغة دولية (20xxxxxxxxxx) — contactValue في Firestore زي ما هو
        // (ممكن يكون محلي 01xxxxxxxxx). fallback للسلوك القديم (تنضيف الرموز بس) لو الرقم مش بصيغة مصرية معروفة.
        const whatsappNumber = contactMethod === "whatsapp" ? toWhatsAppNumber(value) || value.replace(/\D/g, "") : null;
        if (!cancelled) setContact({ value, whatsappNumber, jobTitle: typeof data?.title === "string" ? data.title : "" });
      })
      .catch((err) => {
        console.error("[ContactReveal] فشل تحميل وسيلة التواصل", err);
        if (!cancelled) setContact(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, jobId, contactMethod]);

  // بيتسجّل لحظة ما العرض الحقيقي يظهر لمستخدم مسجّل دخول — أي وسيلة تواصل (واتساب/إيميل/
  // تليفون)، مش بس ضغطة فعلية على زرار (بعض الطرق زي الإيميل/التليفون أصلًا مالهاش زرار
  // يتضغط، النص بيظهر مباشرة). شوف lib/contactReveal.ts لتفاصيل شكل التخزين.
  useEffect(() => {
    if (loggedIn) logContactReveal(jobId);
  }, [loggedIn, jobId]);

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

  if (contact === undefined) {
    return <p style={{ color: "#4A5568", margin: 0 }}>جاري التحميل...</p>;
  }

  if (contact === null) {
    return <p style={{ color: "#B42318", margin: 0 }}>تعذّر تحميل وسيلة التواصل. أعد تحميل الصفحة وحاول مرة أخرى.</p>;
  }

  if (contactMethod === "whatsapp" && contact.whatsappNumber) {
    return (
      <a
        href={`https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(
          `مرحبًا، شفت إعلان وظيفة ${contact.jobTitle} على موقع الشغل وحابب أتقدملها`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#25D366",
          color: "#fff",
          fontWeight: 700,
          fontSize: 14.5,
          padding: "10px 18px",
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        <WhatsAppIcon size={18} /> تواصل عبر واتساب
      </a>
    );
  }

  return (
    <p style={{ color: "#4A5568", margin: 0 }}>
      <strong>التواصل ({CONTACT_METHOD_LABELS[contactMethod] || contactMethod}):</strong> {contact.value}
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
