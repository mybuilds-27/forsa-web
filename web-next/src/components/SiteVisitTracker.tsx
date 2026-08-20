"use client";

import { useEffect } from "react";
import { logSiteVisit } from "@/lib/siteVisits";

// مكوّن بلا واجهة — بيتحمّل مرة واحدة في layout.tsx عشان يشتغل على كل صفحات الموقع، ومهمته
// الوحيدة إنه يسجّل زيارة الجلسة دي في site_visits (شوف lib/siteVisits.ts للتفاصيل).
export default function SiteVisitTracker() {
  useEffect(() => {
    logSiteVisit();
  }, []);

  return null;
}
