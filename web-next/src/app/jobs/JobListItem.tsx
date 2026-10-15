"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import JobCardBase from "@/components/JobCardBase";
import ShareButton from "@/components/ShareButton";
import type { JobCardData } from "@/lib/jobCardData";

type Props = {
  job: JobCardData;
  // اختياريين — لو مش متوصلين (مثلًا مكان مش عدّيناه من قايمة تديره PublicJobsList)، زرار
  // الحفظ ببساطة مبيظهرش، والمشاركة شغالة دايمًا لأنها مش محتاجة تسجيل دخول.
  saved?: boolean;
  onToggleSave?: () => void;
};

// الأزرار جوه الرابط: preventDefault في الـcapture قبل ما الزرار نفسه يشتغل، عشان الضغط عليها
// ميفتحش صفحة الوظيفة (stopPropagation لوحده بيوقف معالج Link بس، مش التنقل الافتراضي للرابط).
function stopLinkNavigation(e: MouseEvent) {
  e.preventDefault();
}

export default function JobListItem({ job, saved, onToggleSave }: Props) {
  const actions = (
    <span onClickCapture={stopLinkNavigation} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {onToggleSave && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          title={saved ? "إلغاء الحفظ" : "حفظ الوظيفة"}
          aria-label={saved ? "إلغاء الحفظ" : "حفظ الوظيفة"}
          aria-pressed={!!saved}
          style={{
            ...headerButtonStyle,
            width: 44,
            fontSize: 18,
            background: saved ? "#F5B800" : "transparent",
            color: saved ? "#14213D" : "#fff",
          }}
        >
          {saved ? "★" : "☆"}
        </button>
      )}
      <ShareButton jobId={job.id} title={job.title} iconOnly style={{ ...headerButtonStyle, width: 44, padding: 0 }} />
    </span>
  );

  return (
    <Link href={`/jobs/${job.id}`} style={{ display: "block", height: "100%", textDecoration: "none", color: "inherit" }}>
      <JobCardBase job={job} actions={actions} />
    </Link>
  );
}

const headerButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.4)",
  background: "transparent",
  color: "#fff",
  fontSize: 13,
};
