"use client";

import ShareButton from "@/components/ShareButton";
import { EXPERIENCE_LEVELS } from "@/lib/constants";
import { ScreeningQuestion } from "@/components/ScreeningQuestionsModal";
import { tagStyle, featuredPillStyle, ApplicationStatus, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_STYLES, salaryDisplay } from "@/lib/jobCardStyles";
import { toWhatsAppNumber } from "@/lib/phoneAuth";

export type JobPost = {
  id: string;
  title: string;
  specialization: string;
  city: string;
  governorate: string;
  jobType: string;
  jobLevel?: string;
  screeningQuestions?: ScreeningQuestion[];
  companyName?: string;
  showCompanyName?: boolean;
  description?: string;
  salaryFrom?: number;
  salaryTo?: number;
  salaryNegotiable?: boolean;
  showSalary?: boolean;
  featured?: boolean;
  requirements?: string;
  employerId: string;
  createdAt?: any;
  isActive?: boolean;
  expiresAt?: any;
  receiveMethod?: string;
  contactMethod?: string;
  contactValue?: string;
};

// نفس شرط صفحة الوظيفة العامة (jobs/[id]/page.tsx): الوظيفة بتستقبل المتقدمين عن طريق وسيلة تواصل
// مباشرة (واتساب/إيميل/تليفون) مش عن طريق الموقع، فمفيش زرار "قدّم" — بيظهر ContactReveal بداله.
export function isContactJob(p: JobPost): boolean {
  return p.receiveMethod === "contact" && !!p.contactValue;
}

// نفس حساب رقم الواتساب في jobs/[id]/page.tsx: صيغة دولية لو الرقم مصري معروف، وإلا تنضيف الرموز بس.
export function contactWhatsAppNumber(p: JobPost): string | null {
  if (p.receiveMethod !== "contact" || p.contactMethod !== "whatsapp" || !p.contactValue) return null;
  return toWhatsAppNumber(p.contactValue) || p.contactValue.replace(/\D/g, "");
}

type Props = {
  job: JobPost;
  applicationStatus?: ApplicationStatus;
  saved: boolean;
  onToggleSave: () => void;
  onClick?: () => void;
  unavailable?: boolean;
  onApply?: () => void;
  applying?: boolean;
};

export default function JobCard({ job: p, applicationStatus, saved, onToggleSave, onClick, unavailable, onApply, applying }: Props) {
  return (
    <div
      onClick={unavailable ? undefined : onClick}
      style={{
        border: "1px solid #14213D22",
        borderRadius: 14,
        padding: 18,
        cursor: unavailable ? "default" : "pointer",
        background: unavailable ? "#F0EDE3" : "#fff",
        boxShadow: unavailable ? "none" : "0 1px 3px rgba(20,33,61,0.06)",
      }}
    >
      {unavailable && (
        <div style={unavailablePillStyle}>⚠️ الوظيفة دي لم تعد متاحة</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <h4 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#14213D" }}>{p.title}</h4>
            {p.featured && <span style={featuredPillStyle}>⭐ مميز</span>}
            {applicationStatus && (
              <span style={APPLICATION_STATUS_STYLES[applicationStatus]}>
                ✓ {APPLICATION_STATUS_LABELS[applicationStatus]}
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#4A5568" }}>
            {p.showCompanyName && p.companyName ? p.companyName : "شركة غير معلنة"} · 📍 {p.city} - {p.governorate}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
          {/* وظيفة تواصل مباشر: مفيش "قدّم"، والزرار بيفتح تفاصيل الوظيفة اللي فيها ContactReveal (نفس زرار
              صفحة الوظيفة). ContactReveal نفسه مش هنا عمدًا: بيسجّل "شاف وسيلة التواصل" (job_contact_views)
              أول ما يتعرض لمستخدم مسجّل، فلو اتحط في كل كارت هيتسجّل لكل وظيفة تواصل ظاهرة في القايمة. */}
          {onApply && !applicationStatus && !unavailable && isContactJob(p) && onClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              title="اعرض وسيلة التواصل مع صاحب الشغل"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 999,
                border: "none",
                background: "#25D366",
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              {p.contactMethod === "whatsapp" ? "تواصل عبر واتساب" : "اعرض وسيلة التواصل"}
            </button>
          )}
          {onApply && !applicationStatus && !unavailable && !isContactJob(p) && (
            <button
              onClick={(e) => { e.stopPropagation(); onApply(); }}
              disabled={applying}
              title="قدّم على الوظيفة دي"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 999,
                border: "none",
                background: "#14213D",
                color: "#fff",
                cursor: applying ? "not-allowed" : "pointer",
                opacity: applying ? 0.6 : 1,
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              📩 قدم الآن
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
            title={saved ? "إلغاء الحفظ" : "حفظ الوظيفة"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 999,
              border: "1px solid #14213D22",
              background: saved ? "#14213D" : "#F0EDE3",
              color: saved ? "#fff" : "#14213D",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          >
            {saved ? "★ محفوظة" : "☆ حفظ"}
          </button>
          <ShareButton jobId={p.id} title={p.title} />
          <a
            href={`/jobs/${p.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="فتح الصفحة الكاملة للوظيفة"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 999,
              border: "1px solid #14213D22",
              background: "#F0EDE3",
              color: "#14213D",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            🔗 الصفحة الكاملة
          </a>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid #14213D14" }}>
        <span style={tagStyle}>{p.specialization}</span>
        {p.jobLevel && <span style={tagStyle}>🎯 {EXPERIENCE_LEVELS[p.jobLevel] || p.jobLevel}</span>}
        <span style={tagStyle}>💰 {salaryDisplay(p, "short").text}</span>
      </div>
    </div>
  );
}

const unavailablePillStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 12.5,
  fontWeight: 700,
  color: "#B03A14",
  background: "#FBEAE3",
  padding: "4px 12px",
  borderRadius: 999,
  marginBottom: 12,
};
