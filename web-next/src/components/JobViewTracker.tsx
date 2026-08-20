"use client";

import { useEffect } from "react";
import { logJobView } from "@/lib/jobViews";

// مكوّن بلا واجهة — بيتحمّل جوه صفحة تفاصيل الوظيفة (Server Component) عشان يسجّل مشاهدة
// واحدة بس لكل وظيفة لكل جلسة (شوف lib/jobViews.ts للتفاصيل).
export default function JobViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    logJobView(jobId);
  }, [jobId]);

  return null;
}
