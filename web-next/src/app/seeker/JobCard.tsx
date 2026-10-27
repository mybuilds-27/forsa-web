"use client";

import ShareButton from "@/components/ShareButton";
import JobCardBase from "@/components/JobCardBase";
import { ScreeningQuestion } from "@/components/ScreeningQuestionsModal";
import { ApplicationStatus, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_STYLES } from "@/lib/jobCardStyles";
import { toJobCardData } from "@/lib/jobCardData";
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

// كارت الباحث: غلاف حوالين JobCardBase (نفس شكل الكارت العام). المستند الكامل (p) للمنطق بس (تواصل مباشر
// ولا تقديم)، والعرض من toJobCardData(p). الجذر div بـonClick مش رابط، وكل زرار جواه بيوقف الـpropagation
// عشان الضغط عليه ميفتحش التفاصيل.
export default function JobCard({ job: p, applicationStatus, saved, onToggleSave, onClick, unavailable, onApply, applying }: Props) {
  const showAction = !!onApply && !applicationStatus && !unavailable;
  const contactJob = isContactJob(p);

  const actions = (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
        title={saved ? "إلغاء الحفظ" : "حفظ الوظيفة"}
        aria-label={saved ? "إلغاء الحفظ" : "حفظ الوظيفة"}
        aria-pressed={saved}
        style={{
          ...headerButtonStyle,
          width: 44,
          fontSize: 18,
          background: saved ? "#14213D" : "transparent",
          color: saved ? "#fff" : "#14213D",
        }}
      >
        {saved ? "★" : "☆"}
      </button>
      <ShareButton jobId={p.id} title={p.title} iconOnly style={{ ...headerButtonStyle, width: 44, padding: 0 }} />
    </>
  );

  // نفس ألوان APPLICATION_STATUS_STYLES بالظبط — فوق خلفية بيضا عشان الألوان الشفافة تفضل مقروءة على الرأس الكحلي
  const statusBadge = applicationStatus ? (
    <span style={{ background: "#fff", borderRadius: 999, display: "inline-flex" }}>
      <span style={APPLICATION_STATUS_STYLES[applicationStatus]}>✓ {APPLICATION_STATUS_LABELS[applicationStatus]}</span>
    </span>
  ) : undefined;

  const footer = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {/* وظيفة تواصل مباشر: مفيش "قدّم"، والزرار بيفتح تفاصيل الوظيفة اللي فيها ContactReveal (نفس زرار
          صفحة الوظيفة). ContactReveal نفسه مش هنا عمدًا: بيسجّل "شاف وسيلة التواصل" (job_contact_views)
          أول ما يتعرض لمستخدم مسجّل، فلو اتحط في كل كارت هيتسجّل لكل وظيفة تواصل ظاهرة في القايمة. */}
      {showAction && contactJob && onClick && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          title="اعرض وسيلة التواصل مع صاحب الشغل"
          style={{ ...primaryButtonStyle, background: "#25D366" }}
        >
          {p.contactMethod === "whatsapp" ? "تواصل عبر واتساب" : "اعرض وسيلة التواصل"}
        </button>
      )}
      {showAction && !contactJob && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onApply?.(); }}
          disabled={applying}
          title="قدّم على الوظيفة دي"
          style={{ ...primaryButtonStyle, cursor: applying ? "not-allowed" : "pointer", opacity: applying ? 0.6 : 1 }}
        >
          📩 قدم الآن
        </button>
      )}
      <a
        href={`/jobs/${p.id}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="فتح الصفحة الكاملة للوظيفة"
        style={secondaryLinkStyle}
      >
        🔗 الصفحة الكاملة
      </a>
    </div>
  );

  return (
    <div onClick={unavailable ? undefined : onClick} style={{ cursor: unavailable ? "default" : "pointer" }}>
      <JobCardBase job={toJobCardData(p)} actions={actions} statusBadge={statusBadge} footer={footer} unavailable={!!unavailable} />
    </div>
  );
}

// أزرار الحفظ والمشاركة على خلفية الكارت الفاتحة (نفس ستايل JobListItem)
const headerButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 36,
  padding: "0 10px",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid #14213D22",
  background: "transparent",
  color: "#14213D",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  flex: "1 1 auto",
  maxWidth: 320,
  minHeight: 44,
  padding: "0 18px",
  border: "none",
  borderRadius: 8,
  background: "#B03A14",
  color: "#fff",
  fontSize: 14.5,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 14px",
  boxSizing: "border-box",
  border: "1px solid #14213D33",
  borderRadius: 8,
  background: "#fff",
  color: "#14213D",
  fontSize: 13.5,
  fontWeight: 700,
  textDecoration: "none",
};
