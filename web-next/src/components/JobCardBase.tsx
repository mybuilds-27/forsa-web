import type { CSSProperties, ReactNode } from "react";
import type { JobCardData } from "@/lib/jobCardData";
import { JOB_TYPE_LABELS, experienceRangeText, salaryDisplay } from "@/lib/jobCardStyles";

// كارت الوظيفة المشترك — عرض بس (من غير Firebase ولا state). اللي بيغلّفه (JobListItem مثلًا) هو
// اللي بيحدد الكارت رابط ولا لأ، وبيبعت أزرار الرأس (حفظ/مشاركة) في actions.
const NAVY = "#14213D";

// "من 3 أيام" / "من ساعتين" — مفرد/مثنى/جمع (نفس اللي كان في JobListItem)
function arabicCount(count: number, singular: string, dual: string, plural: string): string {
  if (count === 1) return singular;
  if (count === 2) return dual;
  if (count >= 3 && count <= 10) return `${count} ${plural}`;
  return `${count} ${singular}`;
}

function formatRelativeTime(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "من لحظات";
  if (diffMinutes < 60) return `من ${arabicCount(diffMinutes, "دقيقة", "دقيقتين", "دقايق")}`;
  if (diffHours < 24) return `من ${arabicCount(diffHours, "ساعة", "ساعتين", "ساعات")}`;
  if (diffDays < 30) return `من ${arabicCount(diffDays, "يوم", "يومين", "أيام")}`;
  return `من ${arabicCount(Math.floor(diffDays / 30), "شهر", "شهرين", "شهور")}`;
}

function benefitLabels(job: JobCardData): string[] {
  const labels: string[] = [];
  if (job.socialInsurance) labels.push("تأمين اجتماعي");
  if (job.privateHealthInsurance) labels.push("تأمين صحي خاص");
  if (job.transportationAvailable) labels.push("مواصلات");
  if (job.housingForExpats) labels.push("سكن للمغتربين");
  return labels;
}

type Props = {
  job: JobCardData;
  // أزرار رأس الكارت (حفظ/مشاركة) — بتتحط جنب شارة "مميزة" والوقت
  actions?: ReactNode;
  // نص زرار الإجراء الأساسي في آخر الكارت. في الكارت الرابط ده span شكله زرار (الكارت كله هو الرابط).
  ctaLabel?: string;
  // اختياريين (كارت الباحث JobCard.tsx): شارة جنب "مميزة" والوقت (حالة الطلب)، وفوتر بدل زرار ctaLabel
  // (أزرار حقيقية). من غيرهم الكارت زي ما هو بالظبط.
  statusBadge?: ReactNode;
  footer?: ReactNode;
  // وظيفة مبقتش متاحة: تنبيه فوق المحتوى والكارت كله رمادي (الضغط نفسه بيقفله اللي بيغلّف الكارت)
  unavailable?: boolean;
};

export default function JobCardBase({ job, actions, ctaLabel = "التفاصيل والتقديم", statusBadge, footer, unavailable = false }: Props) {
  const salary = salaryDisplay(job, "short");
  const salaryHighlighted = salary.specified && !unavailable;
  const benefits = benefitLabels(job);
  const location = [job.city, job.governorate].filter(Boolean).join(" - ");
  const jobType = JOB_TYPE_LABELS[job.jobType] || job.jobType;
  const experience = experienceRangeText(job);
  // الموقع ونوع الدوام والخبرة في سطر واحد، واللي مش موجود بيتشال
  const details = [location, jobType, experience ? `الخبرة المطلوبة: ${experience}` : ""].filter(Boolean).join(" · ");

  return (
    <div style={unavailable ? unavailableContainerStyle : containerStyle}>
      {/* سطر واحد دايمًا: الشارة والوقت بيلفّوا جوه مكانهم لو ضاق، والأزرار ثابتة على الطرف التاني */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: "1 1 auto", minWidth: 0 }}>
          {job.featured && <span style={featuredPillStyle}>مميزة</span>}
          {job.createdAtMs !== null && (
            <span style={{ fontSize: 12, color: "#6B7280" }}>{formatRelativeTime(job.createdAtMs)}</span>
          )}
          {statusBadge}
        </div>
        {actions && <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{actions}</div>}
      </div>

      {unavailable && <div style={unavailableNoticeStyle}>⚠️ الوظيفة دي لم تعد متاحة</div>}

      <div>
        <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: NAVY, lineHeight: 1.4 }}>{job.title}</h3>
        <div style={{ fontSize: 13, color: "#4A5568" }}>{job.companyName ?? "شركة غير معلنة"}</div>
      </div>

      <div>
        <span style={{ fontSize: 13, color: "#6B7280" }}>الراتب: </span>
        <span
          style={
            salaryHighlighted
              ? { fontSize: 15.5, fontWeight: 800, color: NAVY }
              : { fontSize: 14, fontWeight: 500, color: "#6B7280" }
          }
        >
          {salary.text}
        </span>
      </div>

      {details && <div style={{ fontSize: 13, color: "#4A5568" }}>{details}</div>}

      {benefits.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {benefits.map((b) => (
            <span key={b} style={unavailable ? { ...benefitStyle, background: "#E5E1D6", color: "#4A5568" } : benefitStyle}>{b}</span>
          ))}
        </div>
      )}

      {footer !== undefined ? (
        <div style={{ marginTop: "auto" }}>{footer}</div>
      ) : (
        !unavailable && (
          <div style={ctaRowStyle}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: NAVY }}>{ctaLabel} ←</span>
          </div>
        )
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  height: "100%",
  boxSizing: "border-box",
  padding: 16,
  border: "1px solid #14213D1F",
  borderRadius: 12,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(20,33,61,0.06)",
  overflow: "hidden",
};

const unavailableContainerStyle: CSSProperties = {
  ...containerStyle,
  background: "#F0EDE3",
  boxShadow: "none",
};

const unavailableNoticeStyle: CSSProperties = {
  alignSelf: "flex-start",
  fontSize: 12.5,
  fontWeight: 700,
  color: "#B03A14",
  background: "#FBEAE3",
  padding: "4px 12px",
  borderRadius: 999,
};

const featuredPillStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  background: "#FFF3C4",
  color: "#7A5A00",
  padding: "3px 10px",
  borderRadius: 999,
};

const benefitStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  background: "#F4F2EC",
  color: "#37414F",
  padding: "4px 10px",
  borderRadius: 999,
};

// سطر "التفاصيل والتقديم ←" في آخر الكارت (span، الكارت كله هو الرابط)
const ctaRowStyle: CSSProperties = {
  marginTop: "auto",
  paddingTop: 12,
  borderTop: "1px solid #14213D14",
};
