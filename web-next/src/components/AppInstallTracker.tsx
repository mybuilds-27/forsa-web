"use client";

import { useEffect } from "react";
import { logAppInstall } from "@/lib/appInstalls";

// مكوّن بلا واجهة — بيتحمّل مرة واحدة في layout.tsx (نفس نمط SiteVisitTracker.tsx بالظبط)
// عشان يستمع لحدث appinstalled على مستوى الموقع كله، ومهمته الوحيدة إنه يسجّل التثبيت في
// app_installs/total (شوف lib/appInstalls.ts للتفاصيل). الحدث ده بيتفعّل تلقائيًا من
// المتصفح نفسه لما المستخدم يثبّت الـPWA فعليًا (زرار "تثبيت" أو "إضافة للشاشة الرئيسية").
export default function AppInstallTracker() {
  useEffect(() => {
    function handleAppInstalled() {
      logAppInstall();
    }
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, []);

  return null;
}
