import type { CSSProperties, ReactNode } from "react";
import type { JobCardData } from "@/lib/jobCardData";
import { JOB_TYPE_LABELS, experienceRangeText, salaryDisplay } from "@/lib/jobCardStyles";

// كارت الوظيفة المشترك — عرض بس (من غير Firebase ولا state). اللي بيغلّفه (JobListItem مثلًا) هو
// اللي بيحدد الكارت رابط ولا لأ، وبيبعت أزرار الرأس (حفظ/مشاركة) في actions.
const NAVY = "#14213D";
const SALARY_YELLOW = "#F5B800";
const BENEFIT_BG = "#FFF3C4";
const CTA_RED = "#B03A14";

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

function ageText(ageFrom: number | null, ageTo: number | null): string | null {
  if (ageFrom !== null && ageTo !== null) return `السن من ${ageFrom} إلى ${ageTo} سنة`;
  if (ageFrom !== null) return `السن من ${ageFrom} سنة`;
  if (ageTo !== null) return `السن حتى ${ageTo} سنة`;
  return null;
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
};

export default function JobCardBase({ job, actions, ctaLabel = "التفاصيل والتقديم" }: Props) {
  const salary = salaryDisplay(job);
  const benefits = benefitLabels(job);
  const age = ageText(job.ageFrom, job.ageTo);
  const location = [job.city, job.governorate].filter(Boolean).join(" - ");
  const jobType = JOB_TYPE_LABELS[job.jobType] || job.jobType;
  const experience = experienceRangeText(job);

  return (
    <div style={containerStyle}>
      <div style={{ background: NAVY, color: "#fff", padding: "12px 16px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: 44 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {job.featured && <span style={featuredPillStyle}>مميزة</span>}
            {job.createdAtMs !== null && (
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{formatRelativeTime(job.createdAtMs)}</span>
            )}
          </div>
          {actions && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{actions}</div>}
        </div>
        <h3 style={{ margin: "6px 0 4px", fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.4 }}>{job.title}</h3>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{job.companyName ?? "شركة غير معلنة"}</div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div
          style={{
            background: salary.specified ? SALARY_YELLOW : "#F0EDE3",
            color: salary.specified ? NAVY : "#4A5568",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <div style={{ fontSize: 11.5, opacity: 0.8 }}>الراتب</div>
          <div style={{ fontSize: salary.specified ? 16 : 14.5, fontWeight: salary.specified ? 800 : 600 }}>{salary.text}</div>
        </div>

        {(experience || benefits.length > 0) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {experience && <span style={experienceStyle}>الخبرة المطلوبة: {experience}</span>}
            {benefits.map((b) => (
              <span key={b} style={benefitStyle}>{b}</span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13.5, color: "#37414F" }}>
          {location && <div>الموقع: {location}</div>}
          {jobType && <div>نوع الدوام: {jobType}</div>}
          {age && <div>{age}</div>}
        </div>

        <div style={{ marginTop: "auto", display: "flex" }}>
          <span style={ctaStyle}>{ctaLabel}</span>
        </div>
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  boxSizing: "border-box",
  border: "1px solid #14213D33",
  borderRadius: 14,
  background: "#fff",
  boxShadow: "0 1px 3px rgba(20,33,61,0.06)",
  overflow: "hidden",
};

const featuredPillStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  background: SALARY_YELLOW,
  color: NAVY,
  padding: "3px 10px",
  borderRadius: 999,
};

const benefitStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  background: BENEFIT_BG,
  color: NAVY,
  padding: "4px 10px",
  borderRadius: 999,
};

// شارة الخبرة بلون محايد عشان تتميز عن شارات المزايا الصفرا
const experienceStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  background: "#F0EDE3",
  color: NAVY,
  padding: "4px 10px",
  borderRadius: 999,
};

// flex 1 مع maxWidth: عرض الكارت كله على الموبايل وفي الشبكة، ومن غير ما يبقى شريط طويل في قايمة /jobs العريضة
const ctaStyle: CSSProperties = {
  flex: "1 1 auto",
  maxWidth: 320,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 18px",
  boxSizing: "border-box",
  background: CTA_RED,
  color: "#fff",
  borderRadius: 8,
  fontSize: 14.5,
  fontWeight: 700,
};
