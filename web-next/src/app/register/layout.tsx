import type { Metadata } from "next";
import { NOINDEX_FOLLOW } from "@/lib/seoMetadata";

// الصفحة نفسها "use client" فمينفعش تصدّر metadata — هنا عنوان خاص وnoindex,follow بدل وراثة الرئيسية.
// /register مش ممنوعة في robots.ts، عشان جوجل يقدر يزحف عليها ويشوف الـnoindex (بأي query زي ?role=...).
export const metadata: Metadata = { title: "التسجيل وتسجيل الدخول - الشغل", robots: NOINDEX_FOLLOW };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
