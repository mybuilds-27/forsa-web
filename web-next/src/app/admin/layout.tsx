import { privatePageMetadata } from "@/lib/seoMetadata";

// الصفحة نفسها "use client" فمينفعش تصدّر metadata — هنا عنوان خاص وnoindex,nofollow بدل وراثة الرئيسية
export const metadata = privatePageMetadata("لوحة الإدارة - الشغل");

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
