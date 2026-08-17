"use client";

import Link from "next/link";
import { jobCardContainerStyle, tagStyle, featuredPillStyle, JOB_TYPE_LABELS } from "@/lib/jobCardStyles";
import ShareButton from "@/components/ShareButton";

// "من 3 أيام" / "من ساعتين" — بصيغة عربية سليمة (مفرد/مثنى/جمع) بدل "منذ" الفصحى الجافة،
// عشان يتناسب مع باقي لهجة الموقع العامية.
function arabicCount(count: number, singular: string, dual: string, plural: string): string {
  if (count === 1) return singular;
  if (count === 2) return dual;
  if (count >= 3 && count <= 10) return `${count} ${plural}`;
  return `${count} ${singular}`;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "من لحظات";
  if (diffMinutes < 60) return `من ${arabicCount(diffMinutes, "دقيقة", "دقيقتين", "دقايق")}`;
  if (diffHours < 24) return `من ${arabicCount(diffHours, "ساعة", "ساعتين", "ساعات")}`;
  if (diffDays < 30) return `من ${arabicCount(diffDays, "يوم", "يومين", "أيام")}`;
  return `من ${arabicCount(Math.floor(diffDays / 30), "شهر", "شهرين", "شهور")}`;
}

type Props = {
  job: any;
  // اختياريين — لو مش متوصلين (مثلًا مكان مش عدّيناه من قايمة تديره PublicJobsList)، زرار
  // الحفظ ببساطة مبيظهرش، والمشاركة شغالة دايمًا لأنها مش محتاجة تسجيل دخول.
  saved?: boolean;
  onToggleSave?: () => void;
};

export default function JobListItem({ job, saved, onToggleSave }: Props) {
  const postedDate = job.createdAt?.toDate ? job.createdAt.toDate() : null;

  return (
    <Link
      href={`/jobs/${job.id}`}
      style={{
        ...jobCardContainerStyle,
        display: "block",
        padding: 18,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#14213D" }}>{job.title}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {job.featured && <span style={featuredPillStyle}>⭐ مميز</span>}
          {onToggleSave && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
              title={saved ? "إلغاء الحفظ" : "حفظ الوظيفة"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: 13,
                padding: "3px 9px",
                borderRadius: 999,
                border: "1px solid #14213D22",
                background: saved ? "#14213D" : "#F0EDE3",
                color: saved ? "#fff" : "#14213D",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {saved ? "★" : "☆"}
            </button>
          )}
          <ShareButton jobId={job.id} title={job.title} />
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#4A5568", marginTop: 6 }}>
        {job.showCompanyName && job.companyName ? job.companyName : "شركة غير معلنة"} · 📍 {job.city} - {job.governorate}
      </div>
      {postedDate && (
        <div style={{ fontSize: 11.5, color: "#4A5568", opacity: 0.8, marginTop: 3 }}>
          {formatRelativeTime(postedDate)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid #14213D14" }}>
        <span style={tagStyle}>{job.specialization}</span>
        <span style={tagStyle}>🕐 {JOB_TYPE_LABELS[job.jobType] || job.jobType}</span>
      </div>
      {/* تلميح بسيط إن الكارت كله قابل للدوسة ووراه تفاصيل أكتر — مش زرار منفصل */}
      <div style={{ marginTop: 10, fontSize: 11.5, color: "#4A5568", opacity: 0.75 }}>
        عرض التفاصيل الكاملة ←
      </div>
    </Link>
  );
}
