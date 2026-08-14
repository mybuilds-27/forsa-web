"use client";

import Link from "next/link";

type Props = {
  onClose: () => void;
};

const WHATSAPP_NUMBER = "201012735333";
const CONTACT_EMAIL = "elshoghl27@gmail.com";

export default function UpgradeModal({ onClose }: Props) {
  const whatsappMessage = encodeURIComponent("أهلاً، عايز أرقّي باقتي على موقع الشغل للباقة المدفوعة.");
  const emailSubject = encodeURIComponent("طلب ترقية باقة صاحب عمل");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,33,61,0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1.5px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          ✕
        </button>

        <h2 style={{ marginBottom: 6 }}>⭐ الترقية للباقة المدفوعة</h2>

        <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 6, fontWeight: 700 }}>الباقة المجانية بتديك:</p>
        <ul style={{ margin: "0 0 16px", padding: "0 20px", lineHeight: 1.9, fontSize: 13.5, color: "#4A5568" }}>
          <li>5 إعلانات وظائف شهريًا، كل وظيفة نشطة 30 يوم</li>
          <li>5 دعوات مباشرة للكوادر شهريًا</li>
          <li>من غير إمكانية التواصل المباشر مع الكوادر</li>
        </ul>

        <Link href="/why-free" style={{ display: "inline-block", fontSize: 12.5, color: "#14213D", marginBottom: 16 }}>
          عايز تعرف ليه مجاني؟ ←
        </Link>

        <p style={{ color: "#4A5568", fontSize: 14, marginBottom: 6, fontWeight: 700 }}>الترقية للباقة المدفوعة بتديك:</p>
        <ul style={{ margin: "0 0 20px", padding: "0 20px", lineHeight: 2, fontSize: 14.5 }}>
          <li>10 إعلانات وظائف شهريًا (بدل 5) — كل وظيفة نشطة 60 يوم (بدل 30)</li>
          <li>30 دعوة مباشرة للكوادر شهريًا (بدل 5)</li>
          <li>إمكانية تمييز إعلاناتك بشارة <strong>⭐ مميز</strong> — تظهر أول نتائج بحث الباحثين عن عمل</li>
          <li>
            التواصل المباشر مع الكوادر (تليفون وإيميل) من تبويب <strong>"البحث عن كوادر"</strong> —
            لحد 30 عملية فتح بيانات تواصل شهريًا
          </li>
        </ul>

        <p style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 12 }}>
          للترقية، تواصل معانا وهنفعّلها لك يدويًا:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtnStyle}
          >
            💬 تواصل واتساب: 01012735333
          </a>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${emailSubject}`} style={linkBtnStyle}>
            📧 راسلنا: {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
}

const linkBtnStyle: React.CSSProperties = {
  padding: "12px 16px",
  border: "1px solid #14213D22",
  borderRadius: 8,
  background: "#fff",
  textAlign: "right",
  cursor: "pointer",
  fontSize: 14,
  textDecoration: "none",
  color: "inherit",
  display: "block",
};
