import Link from "next/link";
import {
  FREE_PLAN_LIMITS,
  PREMIUM_DURATION_MONTHS,
  PREMIUM_PLAN_LIMITS,
  PREMIUM_PRICE_EGP,
  type PlanLimits,
} from "@/lib/planLimits";
import {
  UPGRADE_CONTACT_EMAIL,
  UPGRADE_WHATSAPP_DISPLAY,
  upgradeEmailHref,
  upgradeWhatsAppHref,
} from "@/lib/upgradeContact";

export const metadata = {
  title: "الباقات والأسعار - موقع الشغل",
  description: `مقارنة بين الباقة المجانية والباقة المدفوعة لأصحاب الأعمال على موقع الشغل: ${PREMIUM_PRICE_EGP} جنيه لمدة ${PREMIUM_DURATION_MONTHS} أشهر، مع عدد الوظائف والدعوات ومدة النشر في كل باقة.`,
  alternates: { canonical: "/pricing" },
};

const monthlyPrice = Math.round(PREMIUM_PRICE_EGP / PREMIUM_DURATION_MONTHS);

// صفوف المقارنة — كل القيم من lib/planLimits.ts
const rows: { label: string; value: (p: PlanLimits) => string }[] = [
  { label: "عدد الوظائف المنشورة شهريًا", value: (p) => `${p.jobsPerMonth}` },
  { label: "مدة بقاء الوظيفة نشطة (بالأيام)", value: (p) => `${p.activeDays}` },
  { label: "عدد الدعوات المباشرة للمرشحين شهريًا", value: (p) => `${p.invitationsPerMonth}` },
  {
    label: "عرض بيانات تواصل المرشحين من البحث عن الكوادر (شهريًا)",
    value: (p) => (p.contactRevealsPerMonth > 0 ? `${p.contactRevealsPerMonth}` : "غير متاح"),
  },
  { label: "شارة «مميز» على الوظائف", value: (p) => (p.featured ? "متاحة" : "غير متاحة") },
];

const faq: { q: string; a: string }[] = [
  {
    q: "ماذا يحدث عند انتهاء الاشتراك؟",
    a: "يتحول حساب الشركة تلقائيًا إلى الباقة المجانية خلال يوم من تاريخ الانتهاء، وتبقى بيانات الشركة ووظائفها والمتقدمون عليها كما هي، وتسري حدود الباقة المجانية على ما يُنشر بعد ذلك.",
  },
  {
    q: "هل تتوقف الوظائف المنشورة عند انتهاء الاشتراك؟",
    a: "لا. تبقى كل وظيفة منشورة نشطة حتى تاريخ انتهائها الذي حُدِّد وقت نشرها.",
  },
  {
    q: "هل تبقى شارة «مميز» على الوظائف بعد انتهاء الاشتراك؟",
    a: "لا. تُزال شارة «مميز» التي حصلت عليها الوظائف النشطة بسبب الباقة المدفوعة عند تحويل الحساب إلى الباقة المجانية.",
  },
  {
    q: "ماذا لو جدّدت الاشتراك قبل انتهائه؟",
    a: "تُضاف المدة الجديدة إلى المدة المتبقية من الاشتراك الحالي، فلا يضيع أي جزء منها.",
  },
];

export default function PricingPage() {
  return (
    <div dir="rtl" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>الباقات والأسعار</h1>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 24 }}>
        يتيح موقع الشغل لأصحاب الأعمال نشر الوظائف دون رسوم ضمن حدود الباقة المجانية، مع باقة مدفوعة
        اختيارية لمن يحتاج إلى عدد أكبر من الوظائف والدعوات وإمكانية التواصل المباشر مع المرشحين.
      </p>

      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 480 }}>
          <thead>
            <tr style={{ background: "#F8F6F0" }}>
              <th style={thStyle}></th>
              <th style={thStyle}>الباقة المجانية</th>
              <th style={thStyle}>الباقة المدفوعة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={labelStyle}>السعر</td>
              <td style={tdStyle}>دون رسوم</td>
              <td style={tdStyle}>
                {PREMIUM_PRICE_EGP} جنيه لمدة {PREMIUM_DURATION_MONTHS} أشهر
                <div style={{ fontSize: 12.5, color: "#4A5568", marginTop: 4 }}>
                  (حوالي {monthlyPrice} جنيهًا شهريًا)
                </div>
              </td>
            </tr>
            {rows.map((row) => (
              <tr key={row.label}>
                <td style={labelStyle}>{row.label}</td>
                <td style={tdStyle}>{row.value(FREE_PLAN_LIMITS)}</td>
                <td style={tdStyle}>{row.value(PREMIUM_PLAN_LIMITS)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 19, marginBottom: 10 }}>طريقة الاشتراك</h2>
      <p style={{ color: "#4A5568", lineHeight: 1.8, marginBottom: 14 }}>
        للاشتراك في الباقة المدفوعة، تواصل معنا عبر واتساب أو البريد الإلكتروني، وسيتم تفعيل الباقة لحساب
        شركتك يدويًا بعد الاتفاق.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
        <a href={upgradeWhatsAppHref} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
          واتساب: {UPGRADE_WHATSAPP_DISPLAY}
        </a>
        <a href={upgradeEmailHref} style={buttonStyle}>
          البريد الإلكتروني: {UPGRADE_CONTACT_EMAIL}
        </a>
      </div>

      <h2 style={{ fontSize: 19, marginBottom: 14 }}>أسئلة شائعة</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
        {faq.map((item) => (
          <div key={item.q}>
            <h3 style={{ fontSize: 15.5, marginBottom: 6 }}>{item.q}</h3>
            <p style={{ color: "#4A5568", lineHeight: 1.8, margin: 0 }}>{item.a}</p>
          </div>
        ))}
      </div>

      <Link
        href="/register?role=employer"
        style={{
          display: "inline-block",
          padding: "12px 22px",
          borderRadius: 8,
          background: "#14213D",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        سجّل شركتك
      </Link>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "right",
  borderBottom: "2px solid #14213D33",
  fontSize: 15,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #14213D1A",
  verticalAlign: "top",
};

const labelStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#4A5568",
  fontWeight: 700,
};

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 18px",
  border: "1px solid #14213D",
  borderRadius: 8,
  color: "#14213D",
  textDecoration: "none",
  fontSize: 14,
};
