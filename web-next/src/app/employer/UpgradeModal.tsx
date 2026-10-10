"use client";

import Link from "next/link";

type Props = {
  onClose: () => void;
};

const WHATSAPP_NUMBER = "201012735333";
const CONTACT_EMAIL = "elshoghl27@gmail.com";

// قايمة مزايا الباقة المدفوعة — مُصدّرة عشان CompanyTab.tsx يستخدم نفس القايمة بالظبط في قسم
// "حالة الباقة" لصاحب باقة مدفوعة بالفعل، مش نسخة تانية منفصلة ممكن تتفرّق عن دي بمرور الوقت.
export function PremiumFeaturesList() {
  return (
    <ul style={{ margin: 0, padding: "0 20px", lineHeight: 2, fontSize: 14.5 }}>
      <li>10 وظائف شهريًا (بدلًا من 5)، وتبقى كل وظيفة نشطة 60 يومًا (بدلًا من 30)</li>
      <li>30 دعوة مباشرة للمرشحين شهريًا (بدلًا من 5)</li>
      <li>إمكانية تمييز وظائفك بشارة <strong>مميزة</strong> لتظهر في مقدمة نتائج بحث الباحثين عن عمل</li>
      <li>
        التواصل المباشر مع المرشحين (الهاتف والبريد الإلكتروني) من تبويب <strong>"البحث عن كوادر"</strong>،
        بحد أقصى 30 عملية كشف بيانات تواصل شهريًا
      </li>
    </ul>
  );
}

export default function UpgradeModal({ onClose }: Props) {
  const whatsappMessage = encodeURIComponent("مرحبًا، أرغب في ترقية باقة الشركة على موقع الشغل إلى الباقة المدفوعة.");
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

        <h2 style={{ marginBottom: 6 }}>الترقية للباقة المدفوعة</h2>

        <p style={{ color: "#4A5568", fontSize: 13.5, marginBottom: 6, fontWeight: 700 }}>تتضمن الباقة المجانية:</p>
        <ul style={{ margin: "0 0 16px", padding: "0 20px", lineHeight: 1.9, fontSize: 13.5, color: "#4A5568" }}>
          <li>5 وظائف شهريًا، وتبقى كل وظيفة نشطة 30 يومًا</li>
          <li>5 دعوات مباشرة للمرشحين شهريًا</li>
          <li>بدون إمكانية التواصل المباشر مع المرشحين</li>
        </ul>

        <Link href="/why-free" style={{ display: "inline-block", fontSize: 12.5, color: "#14213D", marginBottom: 16 }}>
          لماذا النشر مجاني؟
        </Link>

        <p style={{ color: "#4A5568", fontSize: 14, marginBottom: 6, fontWeight: 700 }}>تتضمن الباقة المدفوعة:</p>
        <div style={{ marginBottom: 20 }}>
          <PremiumFeaturesList />
        </div>

        <p style={{ fontSize: 13.5, color: "#4A5568", marginBottom: 12 }}>
          للترقية، تواصل معنا وسيتم تفعيل الباقة لك يدويًا:
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtnStyle}
          >
            واتساب: 01012735333
          </a>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${emailSubject}`} style={linkBtnStyle}>
            البريد الإلكتروني: {CONTACT_EMAIL}
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
