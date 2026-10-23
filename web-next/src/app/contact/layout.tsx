import { pageSeo } from "@/lib/seoMetadata";

// صفحة التواصل client component (زرار نسخ الإيميل)، فمينفعش تصدّر metadata بنفسها — الـ layout ده بيعرّفها.
export const metadata = pageSeo({
  title: "تواصل معنا - موقع الشغل",
  description:
    "تواصل مع موقع الشغل بالإيميل أو واتساب أو الاتصال: للشكاوى والاقتراحات وأسئلة الباحثين عن عمل وأصحاب الأعمال وطلبات حذف البيانات.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
